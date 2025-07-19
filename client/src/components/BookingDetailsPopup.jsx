import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaTimes, FaPencilAlt, FaSave, FaBan, FaRandom  } from 'react-icons/fa';
import { updateBooking, createCancellation  } from '../api/api';
import CancellationPopup from './CancellationPopup'

// Reusable tab button
const TabButton = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
      isActive
        ? 'bg-white border-b-2 border-blue-600 text-blue-600'
        : 'text-gray-500 hover:text-gray-700'
    }`}
  >
    {label}
  </button>
);

// Reusable input for the edit form inside the popup
const EditInput = ({ label, ...props }) => (
    <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
        <input {...props} className="w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500" />
    </div>
);

export default function BookingDetailsPopup({ booking, onClose, onSave }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('details');
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [error, setError] = useState('');
  const [showCancelPopup, setShowCancelPopup] = useState(false);

  useEffect(() => {
    // When a new booking is selected, reset the state
    setEditData({
      ...booking,
      pcDate: booking.pcDate?.split('T')[0] || '',
      issuedDate: booking.issuedDate?.split('T')[0] || '',
      lastPaymentDate: booking.lastPaymentDate?.split('T')[0] || '',
      travelDate: booking.travelDate?.split('T')[0] || '',
    });
    setIsEditing(false);
    setActiveTab('details');
  }, [booking]);

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
      
      const { ...dataToUpdate } = editData;
      
      const payload = {
        ...dataToUpdate,
        revenue: dataToUpdate.revenue ? parseFloat(dataToUpdate.revenue) : null,
        prodCost: dataToUpdate.prodCost ? parseFloat(dataToUpdate.prodCost) : null,
        transFee: dataToUpdate.transFee ? parseFloat(dataToUpdate.transFee) : null,
        surcharge: dataToUpdate.surcharge ? parseFloat(dataToUpdate.surcharge) : null,
        received: dataToUpdate.received ? parseFloat(dataToUpdate.received) : null,
        balance: dataToUpdate.balance ? parseFloat(dataToUpdate.balance) : null,
        profit: dataToUpdate.profit ? parseFloat(dataToUpdate.profit) : null,
      };

      await updateBooking(booking.id, payload);
      onSave(); // This will trigger a re-fetch in the parent
      setIsEditing(false);
    } catch (err) {
      console.error("Update failed:", err);
      setError(err.response?.data?.message || "Failed to save changes.");
    }
  };

  const handleDateChange = () => {
    navigate('/create-booking', { state: { originalBookingForDateChange: booking } });
    onClose(); 
  };
  
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB') : 'N/A';

  const renderDetailsTab = () => (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-4">
      <div><p className="text-xs text-gray-500">Agent</p><p>{booking.agentName} ({booking.teamName})</p></div>
      <div><p className="text-xs text-gray-500">PNR</p><p className="font-mono">{booking.pnr}</p></div>
      <div><p className="text-xs text-gray-500">Airline</p><p>{booking.airline}</p></div>
      <div><p className="text-xs text-gray-500">Route</p><p>{booking.fromTo}</p></div>
      <div><p className="text-xs text-gray-500">PC Date</p><p>{formatDate(booking.pcDate)}</p></div>
      <div><p className="text-xs text-gray-500">Travel Date</p><p>{formatDate(booking.travelDate)}</p></div>
      <div><p className="text-xs text-gray-500">Issued Date</p><p>{formatDate(booking.issuedDate)}</p></div>
      <div><p className="text-xs text-gray-500">Payment Method</p><p>{booking.paymentMethod?.replace(/_/g, ' ')}</p></div>
      <div className="col-span-full"><p className="text-xs text-gray-500">Description</p><p className="text-sm italic text-gray-700">{booking.description || 'None'}</p></div>
    </div>
  );
  
  const renderEditDetailsTab = () => (
     <form>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-x-4">
            <EditInput label="Agent Name" name="agentName" value={editData.agentName} onChange={handleEditChange} />
            <EditInput label="PNR" name="pnr" value={editData.pnr} onChange={handleEditChange} />
            <EditInput label="Airline" name="airline" value={editData.airline} onChange={handleEditChange} />
            <EditInput label="Route" name="fromTo" value={editData.fromTo} onChange={handleEditChange} />
            <EditInput label="Travel Date" name="travelDate" type="date" value={editData.travelDate} onChange={handleEditChange} />
            <EditInput label="Issued Date" name="issuedDate" type="date" value={editData.issuedDate} onChange={handleEditChange} />
        </div>
     </form>
  );

  const renderFinancialsTab = () => (
      isEditing ? (
          <form>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4">
                <EditInput label="Revenue (£)" name="revenue" type="number" step="0.01" value={editData.revenue} onChange={handleEditChange} />
                <EditInput label="Product Cost (£)" name="prodCost" type="number" step="0.01" value={editData.prodCost} onChange={handleEditChange} />
                <EditInput label="Trans. Fee (£)" name="transFee" type="number" step="0.01" value={editData.transFee} onChange={handleEditChange} />
                <EditInput label="Surcharge (£)" name="surcharge" type="number" step="0.01" value={editData.surcharge} onChange={handleEditChange} />
                <EditInput label="Received (£)" name="received" type="number" step="0.01" value={editData.received} onChange={handleEditChange} />
                <EditInput label="Balance (£)" name="balance" type="number" step="0.01" value={editData.balance} onChange={handleEditChange} />
                <EditInput label="Profit (£)" name="profit" type="number" step="0.01" value={editData.profit} onChange={handleEditChange} />
                <EditInput label="Invoice #" name="invoiced" value={editData.invoiced || ''} onChange={handleEditChange} />
            </div>
          </form>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-4">
            <div><p className="text-xs text-gray-500">Revenue</p><p className="font-semibold text-green-700">£{booking.revenue?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Product Cost</p><p className="font-semibold text-red-700">£{booking.prodCost?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Trans. Fee</p><p>£{booking.transFee?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Surcharge</p><p>£{booking.surcharge?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Total Received</p><p className="font-semibold text-green-700">£{booking.received?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Balance Due</p><p className={`font-semibold ${booking.balance > 0 ? 'text-red-700' : 'text-green-700'}`}>£{booking.balance?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Profit</p><p className={`font-bold ${booking.profit > 0 ? 'text-green-700' : 'text-red-700'}`}>£{booking.profit?.toFixed(2)}</p></div>
            <div><p className="text-xs text-gray-500">Invoice #</p><p>{booking.invoiced || 'N/A'}</p></div>
        </div>
      )
  );

  const renderCustomerPaymentsTab = () => (
    <table className="min-w-full divide-y divide-y-gray-200">
        <thead className="bg-gray-50"><tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Date</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Type</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Amount</th>
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-200">
            {/* First, safely check if the initial deposit exists */}
            {booking.initialDeposit > 0 && (
                <tr>
                    <td className="px-4 py-2">{formatDate(booking.receivedDate)}</td>
                    <td className="px-4 py-2">Initial Deposit</td>
                    <td className="px-4 py-2 text-right font-medium">£{booking.initialDeposit?.toFixed(2)}</td>
                </tr>
            )}
            
            {/* --- THIS IS THE CORRECTED PART --- */}
            {/* Safely map over instalments, and for each instalment, safely map over its payments */}
            {booking.instalments?.map(inst =>
                // Check if inst.payments is a truthy value (i.e., not null/undefined) and is an array
                // before attempting to map over it.
                inst.payments?.map(p => (
                    <tr key={p.id}>
                        <td className="px-4 py-2">{formatDate(p.paymentDate)}</td>
                        <td className="px-4 py-2">Instalment</td>
                        <td className="px-4 py-2 text-right font-medium">£{p.amount?.toFixed(2)}</td>
                    </tr>
                ))
            )}
        </tbody>
    </table>
  );

  const renderSupplierPaymentsTab = () => (
    <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50"><tr>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Supplier</th>
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Category</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Total Due</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Paid</th>
            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Pending</th>
        </tr></thead>
        <tbody className="bg-white divide-y divide-gray-200">
            {booking.costItems.flatMap(item => 
                item.suppliers.map(supplier => (
                    <tr key={supplier.id}>
                        <td className="px-4 py-2 font-medium">{supplier.supplier}</td>
                        <td className="px-4 py-2">{item.category}</td>
                        <td className="px-4 py-2 text-right">£{supplier.amount?.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-green-600">£{supplier.paidAmount?.toFixed(2)}</td>
                        <td className="px-4 py-2 text-right text-red-600">£{supplier.pendingAmount?.toFixed(2)}</td>
                    </tr>
                ))
            )}
        </tbody>
    </table>
  );


  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-60 flex items-center justify-center p-4 z-40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Booking Details</h2>
            <p className="text-sm text-gray-500">Ref No: <span className="font-semibold text-blue-600">{booking.refNo}</span> | Passenger: <span className="font-semibold">{booking.paxName}</span></p>
          </div>
          <div className="flex items-center space-x-2">
            {isEditing ? (
                <>
                    <button onClick={handleSave} className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700"><FaSave className="mr-2"/>Save</button>
                    <button onClick={() => setIsEditing(false)} className="flex items-center px-3 py-1 bg-gray-500 text-white rounded-lg hover:bg-gray-600"><FaBan className="mr-2"/>Cancel</button>
                </>
            ) : (
                <> {/* 5. MODIFY this block to add the new button */}
                    <button onClick={() => setIsEditing(true)} className="flex items-center px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><FaPencilAlt className="mr-2"/>Edit</button>
                    {booking.bookingStatus !== 'CANCELLED' && (
                       <button
  onClick={handleDateChange}
  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
  // THIS IS THE KEY CHANGE:
  disabled={booking.isChainCancelled || booking.bookingStatus === 'CANCELLED'}
  // Add a title to explain why it's disabled for a better user experience
  title={booking.isChainCancelled ? "This booking chain has been cancelled and cannot be modified." : ""}
>
  Create Date Change
</button>
                    )}
                </>
            )}
            {!isEditing && booking.bookingStatus !== 'CANCELLED' && (
                <button onClick={() => setShowCancelPopup(true)} className="flex items-center px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700">Cancel Booking</button>
            )}
            <button onClick={onClose} className="p-2 rounded-full text-gray-500 hover:bg-gray-100"><FaTimes /></button>
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b px-4">
          <nav className="flex space-x-2">
            <TabButton label="Main Details" isActive={activeTab === 'details'} onClick={() => setActiveTab('details')} />
            <TabButton label="Financials" isActive={activeTab === 'financials'} onClick={() => setActiveTab('financials')} />
            <TabButton label="Customer Payments" isActive={activeTab === 'customer'} onClick={() => setActiveTab('customer')} />
            <TabButton label="Supplier Payments" isActive={activeTab === 'supplier'} onClick={() => setActiveTab('supplier')} />
          </nav>
        </div>
        
        {/* Content */}
        <div className="p-6 overflow-y-auto flex-grow">
            {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">{error}</div>}
            {activeTab === 'details' && (isEditing ? renderEditDetailsTab() : renderDetailsTab())}
            {activeTab === 'financials' && renderFinancialsTab()}
            {activeTab === 'customer' && renderCustomerPaymentsTab()}
            {activeTab === 'supplier' && renderSupplierPaymentsTab()}
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