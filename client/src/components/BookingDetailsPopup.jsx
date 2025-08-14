import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaPencilAlt, FaSave, FaBan, FaCalendarAlt, FaExclamationTriangle, FaHistory, FaSpinner } from 'react-icons/fa';
import { updateBooking, createCancellation, getAuditHistory } from '../api/api';
import CancellationPopup from './CancellationPopup';

// --- Reusable Styled Components ---

const TabButton = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-3 text-sm font-semibold rounded-t-lg transition-all duration-200 focus:outline-none ${
      isActive
        ? 'bg-white border-b-2 border-blue-600 text-blue-600'
        : 'text-slate-500 hover:bg-slate-100 hover:text-slate-700'
    }`}
  >
    {label}
  </button>
);

const EditInput = ({ label, ...props }) => (
    <div>
        <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
        <input {...props} className="w-full py-2 px-3 border border-slate-300 rounded-lg bg-slate-50 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" />
    </div>
);

const InfoItem = ({ label, children, className = '' }) => (
  <div className={className}>
    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
    <p className="text-base text-slate-800 break-words">{children || '—'}</p>
  </div>
);

const ActionButton = ({ icon, children, onClick, className = '', ...props }) => (
  <button
    onClick={onClick}
    className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg shadow-sm transition-transform hover:scale-105 disabled:bg-slate-300 disabled:cursor-not-allowed disabled:transform-none ${className}`}
    {...props}
  >
    {icon}
    {children}
  </button>
);

const HistoryItem = ({ log }) => {
    let message = 'performed an unknown action.';
    const formattedDate = new Date(log.createdAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    switch(log.action) {
        case 'CREATE':
            message = 'created this booking.';
            break;
        case 'UPDATE':
            message = `updated '${log.fieldName}' from '${log.oldValue}' to '${log.newValue}'.`;
            break;
        case 'DATE_CHANGE':
            message = `processed a date change, marking this booking as COMPLETED.`;
            break;
        case 'CREATE_CANCELLATION':
            message = 'initiated the cancellation process for this booking.';
            break;
        case 'SETTLEMENT_PAYMENT':
            message = `processed a payment: ${log.newValue}.`;
            break;
        case 'REFUND_PAYMENT':
            message = `processed a refund: ${log.newValue}.`;
            break;
        default:
            message = `performed action: ${log.action}`;
    }

    return (
        <li className="flex items-start space-x-4 py-3 border-b border-slate-100 last:border-b-0">
            <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                {log.user.firstName.charAt(0)}
            </div>
            <div>
                <p className="text-sm text-slate-800">
                    <span className="font-semibold">{log.user.firstName}</span> {message}
                </p>
                <p className="text-xs text-slate-500">{formattedDate}</p>
            </div>
        </li>
    );
};

export default function BookingDetailsPopup({ booking, onClose, onSave }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [error, setError] = useState('');
  const [showCancelPopup, setShowCancelPopup] = useState(false);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const numberFields = ['revenue', 'prodCost', 'transFee', 'surcharge', 'received', 'balance', 'profit'];
  const dateFields = ['pcDate', 'issuedDate', 'lastPaymentDate', 'travelDate'];

  useEffect(() => {
    // Initialize editData with formatted values for form inputs
    const initialEditData = { ...booking };
    dateFields.forEach(field => {
        if (booking[field]) {
            initialEditData[field] = booking[field].split('T')[0];
        }
    });
    setEditData(initialEditData);
    setIsEditing(false);
    setActiveTab('details');
  }, [booking]);

  useEffect(() => {
        const fetchAuditHistory = async () => {
            // Only fetch if the tab is active and history hasn't been loaded yet
            if (activeTab === 'history' && auditHistory.length === 0) {
                try {
                    setLoadingHistory(true);
                    const response = await getAuditHistory('Booking', booking.id);
                    setAuditHistory(response.data.data || []);
                } catch (err) {
                    console.error("Failed to fetch audit history", err);
                    setError("Could not load booking history.");
                } finally {
                    setLoadingHistory(false);
                }
            }
        };

        fetchAuditHistory();
    }, [activeTab, booking.id, auditHistory.length]);

  const handleConfirmCancellation = async (data) => {
    await createCancellation(booking.id, data);
    onSave(); 
    onClose();
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setError('');
    try {
        // --- MODIFIED LOGIC: Build a payload with ONLY the changed fields ---
        const changedFields = {};

        Object.keys(editData).forEach(key => {
            const originalValue = booking[key];
            let editedValue = editData[key];

            // Normalize values for accurate comparison
            let comparableOriginal = originalValue;
            if (dateFields.includes(key) && originalValue) {
                comparableOriginal = originalValue.split('T')[0];
            }
            if (numberFields.includes(key)) {
                // Treat null/undefined/empty string as 0 for comparison if original is 0
                const originalNum = originalValue ?? 0;
                const editedNum = parseFloat(editedValue) || 0;
                if (originalNum !== editedNum) {
                    changedFields[key] = editedValue === '' || editedValue === null ? null : parseFloat(editedValue);
                }
            } else if (comparableOriginal !== editedValue) {
                 // For other fields, if they are different, add to payload
                 changedFields[key] = editedValue === '' ? null : editedValue;
            }
        });

        // If nothing changed, don't make an API call
        if (Object.keys(changedFields).length === 0) {
            setIsEditing(false);
            return;
        }

        // Send only the changed fields to the backend
        await updateBooking(booking.id, changedFields);
        onSave();
        setIsEditing(false);
    } catch (err) {
        console.error("Update failed:", err);
        setError(err.response?.data?.error || "Failed to save changes. Please try again.");
    }
  };

  const handleDateChange = () => {
    navigate('/create-booking', { state: { originalBookingForDateChange: booking } });
    onClose(); 
  };
  
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : 'N/A';

  const renderDetailsTab = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
      <InfoItem label="Agent / Team">{booking.agentName} ({booking.teamName})</InfoItem>
      <InfoItem label="PNR"><span className="font-mono">{booking.pnr}</span></InfoItem>
      <InfoItem label="Airline">{booking.airline}</InfoItem>
      <InfoItem label="Route">{booking.fromTo}</InfoItem>
      <InfoItem label="PC Date">{formatDate(booking.pcDate)}</InfoItem>
      <InfoItem label="Travel Date">{formatDate(booking.travelDate)}</InfoItem>
      <InfoItem label="Issued Date">{formatDate(booking.issuedDate)}</InfoItem>
      <InfoItem label="Payment Method">{booking.paymentMethod?.replace(/_/g, ' ')}</InfoItem>
      <InfoItem label="Description" className="col-span-full">
    <div className="text-sm italic text-slate-700 bg-slate-50 p-2 rounded-md">
        {booking.description || 'No description provided.'}
    </div>
</InfoItem>
    </div>
  );
  
  const renderEditDetailsTab = () => (
     <form className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <EditInput label="Agent Name" name="agentName" value={editData.agentName || ''} onChange={handleEditChange} />
        <EditInput label="PNR" name="pnr" value={editData.pnr || ''} onChange={handleEditChange} />
        <EditInput label="Airline" name="airline" value={editData.airline || ''} onChange={handleEditChange} />
        <EditInput label="Route (From-To)" name="fromTo" value={editData.fromTo || ''} onChange={handleEditChange} />
        <EditInput label="Travel Date" name="travelDate" type="date" value={editData.travelDate || ''} onChange={handleEditChange} />
        <EditInput label="Issued Date" name="issuedDate" type="date" value={editData.issuedDate || ''} onChange={handleEditChange} />
        <div className="md:col-span-3">
          <label className="block text-xs font-semibold text-slate-600 mb-1">Description</label>
          <textarea name="description" value={editData.description || ''} onChange={handleEditChange} rows="3" className="w-full py-2 px-3 border border-slate-300 rounded-lg bg-slate-50 shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
        </div>
     </form>
  );

  const renderFinancialsTab = () => (
    isEditing ? (
        <form className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <EditInput label="Revenue (£)" name="revenue" type="number" step="0.01" value={editData.revenue ?? ''} onChange={handleEditChange} />
            <EditInput label="Product Cost (£)" name="prodCost" type="number" step="0.01" value={editData.prodCost ?? ''} onChange={handleEditChange} />
            <EditInput label="Trans. Fee (£)" name="transFee" type="number" step="0.01" value={editData.transFee ?? ''} onChange={handleEditChange} />
            <EditInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={editData.surcharge ?? ''} onChange={handleEditChange} />
            <EditInput label="Total Received (£)" name="received" type="number" step="0.01" value={editData.received ?? ''} onChange={handleEditChange} />
            <EditInput label="Balance Due (£)" name="balance" type="number" step="0.01" value={editData.balance ?? ''} onChange={handleEditChange} />
            <EditInput label="Profit (£)" name="profit" type="number" step="0.01" value={editData.profit ?? ''} onChange={handleEditChange} />
            <EditInput label="Invoice #" name="invoiced" value={editData.invoiced || ''} onChange={handleEditChange} />
        </form>
    ) : (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
          <InfoItem label="Revenue"><p className="font-semibold text-green-600">£{booking.revenue?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Product Cost"><p className="font-semibold text-red-600">£{booking.prodCost?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Trans. Fee"><p>£{booking.transFee?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Surcharge"><p>£{booking.surcharge?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Total Received"><p className="font-semibold text-green-600">£{booking.received?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Balance Due"><p className={`font-semibold ${booking.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>£{booking.balance?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Profit"><p className={`font-bold text-2xl ${booking.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{booking.profit?.toFixed(2)}</p></InfoItem>
          <InfoItem label="Invoice #">{booking.invoiced}</InfoItem>
      </div>
    )
  );

  const renderPaymentsTable = (headers, data) => (
      <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="min-w-full">
              <thead className="bg-slate-50"><tr>
                  {headers.map(h => <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">{h}</th>)}
              </tr></thead>
              <tbody className="bg-white divide-y divide-slate-200">
                  {data}
              </tbody>
          </table>
      </div>
  );

  const customerPaymentsData = [
      ...(booking.initialDeposit > 0 ? [{ id: 'initial', date: booking.receivedDate, type: 'Initial Deposit', amount: booking.initialDeposit }] : []),
      ...(booking.instalments?.flatMap(inst => inst.payments?.map(p => ({ id: p.id, date: p.paymentDate, type: 'Instalment', amount: p.amount }))) || [])
  ].map(p => (
      <tr key={p.id}><td className="px-4 py-3 whitespace-nowrap">{formatDate(p.date)}</td><td className="px-4 py-3 whitespace-nowrap">{p.type}</td><td className="px-4 py-3 whitespace-nowrap text-right font-semibold text-slate-700">£{p.amount?.toFixed(2)}</td></tr>
  ));

  const supplierPaymentsData = booking.costItems?.flatMap(item => 
      item.suppliers.map(supplier => (
          <tr key={supplier.id}>
              <td className="px-4 py-3 whitespace-nowrap font-semibold">{supplier.supplier}</td><td className="px-4 py-3 whitespace-nowrap">{item.category}</td>
              <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700">£{supplier.amount?.toFixed(2)}</td><td className="px-4 py-3 whitespace-nowrap text-right text-green-600">£{supplier.paidAmount?.toFixed(2)}</td><td className="px-4 py-3 whitespace-nowrap text-right text-red-600">£{supplier.pendingAmount?.toFixed(2)}</td>
          </tr>
      ))
  );

  const renderHistoryTab = () => {
        if (loadingHistory) {
            return (
                <div className="flex justify-center items-center p-10">
                    <FaSpinner className="animate-spin h-8 w-8 text-blue-500" />
                    <span className="ml-4 text-slate-600">Loading History...</span>
                </div>
            );
        }

        if (auditHistory.length === 0) {
            return (
                <div className="text-center p-10">
                    <FaHistory className="h-12 w-12 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-slate-700">No History Found</h3>
                    <p className="text-sm text-slate-500 mt-1">There are no recorded changes for this booking.</p>
                </div>
            );
        }

        return (
            <ul className="divide-y divide-slate-100">
                {auditHistory.map(log => <HistoryItem key={log.id} log={log} />)}
            </ul>
        );
    };

  return (
    <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center p-4 z-40 animate-fade-in" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col transform animate-slide-up" onClick={e => e.stopPropagation()}>
        
        {/* Header */}
        <header className="flex justify-between items-start p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-xl">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Booking Details</h2>
            <p className="text-sm text-slate-500 mt-1">Ref: <span className="font-semibold text-blue-600">{booking.refNo}</span>  |  Passenger: <span className="font-semibold">{booking.paxName}</span></p>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            {isEditing ? (
              <>
                <ActionButton onClick={handleSave} icon={<FaSave />} className="bg-green-600 text-white hover:bg-green-700">Save Changes</ActionButton>
                <ActionButton onClick={() => setIsEditing(false)} icon={<FaBan />} className="bg-slate-500 text-white hover:bg-slate-600">Cancel</ActionButton>
              </>
            ) : (
              <>
                <ActionButton onClick={() => setIsEditing(true)} icon={<FaPencilAlt />} className="bg-blue-600 text-white hover:bg-blue-700">Edit</ActionButton>
                {booking.bookingStatus !== 'CANCELLED' && (
                  <ActionButton
                    onClick={handleDateChange} icon={<FaCalendarAlt />}
                    className="bg-purple-600 text-white hover:bg-purple-700"
                    disabled={booking.isChainCancelled || booking.bookingStatus === 'CANCELLED'}
                    title={booking.isChainCancelled ? "Cannot create date change for a cancelled booking chain." : ""}
                  >Date Change</ActionButton>
                )}
                {!booking.cancellation && booking.bookingStatus !== 'CANCELLED' && (
                  <ActionButton onClick={() => setShowCancelPopup(true)} icon={<FaBan />} className="bg-red-600 text-white hover:bg-red-700">Cancel Booking</ActionButton>
                )}
              </>
            )}
            <button onClick={onClose} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"><FaTimes size={20} /></button>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-slate-200 px-5 bg-slate-50/50">
          <nav className="flex space-x-2 -mb-px">
            <TabButton label="Main Details" isActive={activeTab === 'details'} onClick={() => setActiveTab('details')} />
            <TabButton label="Financials" isActive={activeTab === 'financials'} onClick={() => setActiveTab('financials')} />
            <TabButton label="Customer Payments" isActive={activeTab === 'customer'} onClick={() => setActiveTab('customer')} />
            <TabButton label="Supplier Payments" isActive={activeTab === 'supplier'} onClick={() => setActiveTab('supplier')} />
            <TabButton label="History" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />  
          </nav>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow bg-white rounded-b-xl">
          {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg flex items-center gap-3"><FaExclamationTriangle />{error}</div>}
          
          {activeTab === 'details' && (isEditing ? renderEditDetailsTab() : renderDetailsTab())}
          {activeTab === 'financials' && renderFinancialsTab()}
          {activeTab === 'customer' && renderPaymentsTable(['Date', 'Type', 'Amount'], customerPaymentsData)}
          {activeTab === 'supplier' && renderPaymentsTable(['Supplier', 'Category', 'Total Due', 'Paid', 'Pending'], supplierPaymentsData)}
          {activeTab === 'history' && renderHistoryTab()}
        </div>

        {showCancelPopup && (
            <CancellationPopup 
              booking={booking}
              onClose={() => setShowCancelPopup(false)}
              onConfirm={handleConfirmCancellation}
            />
        )}
      </div>
    </div>
  );
}