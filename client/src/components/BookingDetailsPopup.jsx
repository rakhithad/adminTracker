import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
    FaTimes, 
    FaPencilAlt, 
    FaSave, 
    FaBan, 
    FaCalendarAlt, 
    FaExclamationTriangle, 
    FaHistory, 
    FaSpinner, 
    FaUndo, 
    FaFileInvoice,
    FaCreditCard, 
    FaHandHoldingUsd, 
    FaMoneyBillWave, 
    FaReceipt, 
    FaExclamationCircle 
} from 'react-icons/fa';
import { updateBooking, createCancellation, getAuditHistory, voidBooking, unvoidBooking, generateInvoicePDF, getAgentsList } from '../api/api'; 
import CancellationPopup from './CancellationPopup';
import ProductCostBreakdown from './ProductCostBreakdown';

const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const buildPaymentHistory = (booking) => {
    if (!booking) return [];
    
    const history = [];

    (booking.initialPayments || []).forEach(payment => {
        let methodDisplay = payment.transactionMethod;
        let details = 'Initial payment';
        let icon = <FaHandHoldingUsd className="text-green-500" />;

        if (payment.transactionMethod === 'CUSTOMER_CREDIT_NOTE' && payment.appliedCustomerCreditNoteUsage) {
            methodDisplay = 'Customer Credit';
            const creditNote = payment.appliedCustomerCreditNoteUsage.creditNote;
            const originalRefNo = creditNote?.generatedFromCancellation?.originalBooking?.refNo?.trim();
            details = `Used Note ID: ${creditNote?.id || 'N/A'} (from ${originalRefNo || 'N/A'})`;
            icon = <FaCreditCard className="text-blue-500" />;
        }

        history.push({
            id: `initial-${payment.id}`,
            date: payment.paymentDate,
            type: 'Initial Payment',
            method: methodDisplay.replace(/_/g, ' '),
            amount: parseFloat(payment.amount || 0),
            details: details,
            icon: icon,
        });
    });

    (booking.instalments || []).forEach(instalment => {
        (instalment.payments || []).forEach(payment => {
            history.push({
                id: `instalment-${payment.id}`,
                date: payment.paymentDate,
                type: 'Instalment Payment',
                method: payment.transactionMethod.replace(/_/g, ' '),
                amount: parseFloat(payment.amount || 0),
                details: `For instalment due ${formatDate(instalment.dueDate)}`,
                icon: <FaMoneyBillWave className="text-gray-500" />,
            });
        });
    });

    if (booking.cancellation) {
        const cancellation = booking.cancellation;

        if (cancellation.createdCustomerPayable) {
            (cancellation.createdCustomerPayable.settlements || []).forEach(settlement => {
                history.push({
                    id: `cp-settle-${settlement.id}`,
                    date: settlement.paymentDate,
                    type: 'Cancellation Debt Paid',
                    method: settlement.transactionMethod.replace(/_/g, ' '),
                    amount: parseFloat(settlement.amount || 0),
                    details: `Settled payable for ${cancellation.folderNo || booking.folderNo}`,
                    icon: <FaExclamationCircle className="text-orange-500" />,
                });
            });
        }
        
        if (cancellation.refundPayment) {
             history.push({
                id: 'refund-paid',
                date: cancellation.refundPayment.refundDate,
                type: 'Passenger Refund (Cash)',
                method: cancellation.refundPayment.transactionMethod.replace(/_/g, ' '),
                amount: -parseFloat(cancellation.refundPayment.amount || 0), // Negative
                details: `Refund processed for ${cancellation.folderNo || booking.folderNo}`,
                icon: <FaUndo className="text-red-500" />,
            });
        }

        if (cancellation.generatedCustomerCreditNote) {
            const creditNote = cancellation.generatedCustomerCreditNote;
            const originalRefNo = creditNote.generatedFromCancellation?.originalBooking?.refNo?.trim();
            
            let usageDetails = (creditNote.usageHistory || []).map(usage => {
                const refNo = usage.usedOnInitialPayment?.booking?.refNo?.trim() || 'N/A';
                const amountUsed = usage.amountUsed || 0;
                return `Used £${amountUsed.toFixed(2)} on ${refNo}`;
            }).join(', ');

            history.push({
                id: `ccn-issued-${creditNote.id}`,
                date: creditNote.createdAt,
                type: 'Credit Note Issued',
                method: 'CUSTOMER_CREDIT_NOTE',
                amount: parseFloat(creditNote.initialAmount || 0),
                details: `Note ID: ${creditNote.id} (from ${originalRefNo || 'N/A'}) ${usageDetails ? `| ${usageDetails}` : ''}`,
                icon: <FaReceipt className="text-purple-500" />,
            });
        }
    }
    
    history.sort((a, b) => new Date(a.date) - new Date(b.date));
    return history;
};

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
  
  const InlineInput = (props) => (
      <input {...props} className="w-full py-1 px-2 border border-slate-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow" />
  );

  const InlineSelect = ({ children, ...props }) => (
    <select {...props} className="w-full py-1 px-2 border border-slate-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-shadow">
        {children}
    </select>
  );
  
  const InfoItem = ({ label, children, className = '' }) => (
    <div className={className}>
      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="text-base text-slate-800 break-words mt-1">{children || '—'}</div>
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
  
  const VoidReasonPopup = ({ onSubmit, onCancel }) => {
      const [reason, setReason] = useState('');
      return (
          <div className="fixed inset-0 bg-slate-900 bg-opacity-80 flex items-center justify-center z-50">
              <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md animate-slide-up">
                  <h3 className="text-lg font-bold text-slate-800">Reason for Voiding</h3>
                  <p className="text-sm text-slate-600 mt-2">
                      Please provide a clear reason for voiding this booking. This will be recorded in the audit history.
                  </p>
                  <textarea
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                      rows="4"
                      className="w-full mt-4 p-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                      placeholder="e.g., Created in error by agent, duplicate entry..."
                  />
                  <div className="flex justify-end space-x-3 mt-4">
                      <button onClick={onCancel} className="px-4 py-2 text-sm font-semibold text-slate-700 bg-slate-200 rounded-md hover:bg-slate-300">
                          Cancel
                      </button>
                      <button
                          onClick={() => onSubmit(reason)}
                          disabled={!reason.trim()}
                          className="px-4 py-2 text-sm font-semibold text-white bg-red-600 rounded-md hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed"
                      >
                          Confirm Void
                      </button>
                  </div>
              </div>
          </div>
      );
  };
  
  
  const HistoryItem = ({ log }) => {
      let message = 'performed an unknown action.';
      const formattedDate = new Date(log.createdAt).toLocaleString('en-GB', {
          day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
      });
  
      switch(log.action) {
          case 'CREATE': message = 'created this booking.'; break;
          case 'UPDATE': message = `updated '${log.fieldName}' from '${log.oldValue}' to '${log.newValue}'.`; break;
          case 'DATE_CHANGE': message = `processed a date change, marking this booking as COMPLETED.`; break;
          case 'CREATE_CANCELLATION': message = 'initiated the cancellation process for this booking.'; break;
          case 'SETTLEMENT_PAYMENT': message = `processed a payment: ${log.newValue}.`; break;
          case 'REFUND_PAYMENT': message = `processed a refund: ${log.newValue}.`; break;
          case 'VOID_BOOKING': message = `voided this booking. Reason: "${log.newValue}"`; break;
          case 'UNVOID_BOOKING': message = `restored this booking from a voided state.`; break;
          default: message = `performed action: ${log.action}`;
      }
  
      return (
          <li className="flex items-start space-x-4 py-3 border-b border-slate-100 last:border-b-0">
              <div className="flex-shrink-0 h-8 w-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm font-bold">
                  {log.user.firstName.charAt(0)}
              </div>
              <div>
                  <p className="text-sm text-slate-800"><span className="font-semibold">{log.user.firstName}</span> {message}</p>
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
    const [showVoidPopup, setShowVoidPopup] = useState(false);
    const [auditHistory, setAuditHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [isGeneratingInvoice, setIsGeneratingInvoice] = useState(false);
    const [showCostEditor, setShowCostEditor] = useState(false);
    const [agents, setAgents] = useState([]); 

    const permissions = booking._permissions || {
      canEdit: false,
      canCancel: false,
      canVoid: false,
      canDateChange: false
    };

    const paymentHistory = useMemo(() => buildPaymentHistory(booking), [booking]);
    const totalReceived = useMemo(() => {
        return paymentHistory.reduce((sum, item) => {
            if (item.amount > 0 && (item.type === 'Initial Payment' || item.type === 'Instalment Payment' || item.type === 'Cancellation Debt Paid')) {
                return sum + item.amount;
            }
            return sum;
        }, 0);
    }, [paymentHistory]);

    useEffect(() => {
        const fetchAgents = async () => {
          try {
            const response = await getAgentsList();
            setAgents(response.data);
          } catch (error) {
            console.error("Failed to fetch agents list for popup", error);
          }
        };
        fetchAgents();
      }, []);

    useEffect(() => {
        if (booking) {
            const initialEditData = { ...booking };
            const dateFields = ['pcDate', 'issuedDate', 'lastPaymentDate', 'travelDate'];
            dateFields.forEach(field => {
                if (booking[field]) {
                    initialEditData[field] = booking[field].split('T')[0];
                }
            });
            initialEditData.teamName = booking.teamName || ''; 
            setEditData(initialEditData);
            setIsEditing(false);
            setActiveTab('details');
        }
    }, [booking]);

    useEffect(() => {
        const fetchAuditHistory = async () => {
            if (activeTab === 'history' && booking?.id) {
                try {
                    setLoadingHistory(true);
                    const response = await getAuditHistory('Booking', booking.id);
                    const historyData = Array.isArray(response.data) ? response.data : response.data.data;
                    setAuditHistory(historyData || []);
                } catch (err) {
                    console.error("Failed to fetch audit history", err);
                    setError("Could not load booking history.");
                    setAuditHistory([]);
                } finally {
                    setLoadingHistory(false);
                }
            }
        };
        fetchAuditHistory();
    }, [activeTab, booking?.id]);

    if (!booking) {
        return null;
    }
    
    const numberFields = ['revenue', 'prodCost', 'transFee', 'surcharge', 'balance', 'profit'];
    const dateFields = ['pcDate', 'issuedDate', 'lastPaymentDate', 'travelDate'];
    const isVoided = booking.bookingStatus === 'VOID';
    const hasMissingSuppliers = !booking.costItems || booking.costItems.length === 0 || booking.costItems.every(item => !item.suppliers || item.suppliers.length === 0);
    
    const handleConfirmCancellation = async (data) => {
        await createCancellation(booking.id, data);
        onSave(); 
        onClose();
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditData(prev => ({ ...prev, [name]: value }));
    };

    const handleAgentChange = (e) => {
        const selectedAgentName = e.target.value;
        const selectedAgent = agents.find(agent => agent.fullName === selectedAgentName);
        setEditData(prev => ({
          ...prev,
          agentName: selectedAgentName,
          teamName: selectedAgent ? selectedAgent.team : '' 
        }));
      };

    const handleGenerateInvoice = async () => {
        setIsGeneratingInvoice(true);
        setError('');
        try {
            const result = await generateInvoicePDF(booking.id, booking.invoiced);
            if (result.success) {
                if (!booking.invoiced) onSave();
            } else {
                setError(result.message || 'Failed to generate invoice.');
            }
        } catch (err) {
            setError("An unexpected error occurred while generating the invoice.", err);
        } finally {
            setIsGeneratingInvoice(false);
        }
    };

    const handleCostBreakdownSave = async (updatedBreakdown) => {
        const totalProdCost = updatedBreakdown.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);
        const changes = { prodCost: totalProdCost, prodCostBreakdown: updatedBreakdown };
        setError('');
        try {
            await updateBooking(booking.id, changes);
            setShowCostEditor(false);
            onSave();
        } catch (err) {
            setError(err.response?.data?.error || "Failed to save cost breakdown.");
        }
    };

    const handleSave = async () => {
        setError('');
        try {
            const changedFields = {};
            const initialBookingDataForComparison = { ...booking }; 
             dateFields.forEach(field => {
                if (initialBookingDataForComparison[field]) {
                    initialBookingDataForComparison[field] = initialBookingDataForComparison[field].split('T')[0];
                }
            });

            Object.keys(editData).forEach(key => {
                if (['initialPayments', 'costItems', 'passengers', 'instalments', 'id', 'folderNo', 'cancellation', 'createdBy', 'voidedBy'].includes(key)) return; 

                const originalValue = initialBookingDataForComparison[key];
                let editedValue = editData[key];
                
                const comparableOriginal = originalValue ?? ''; 
                const comparableEdited = editedValue ?? '';

                if (String(comparableOriginal) !== String(comparableEdited)) {
                    if (dateFields.includes(key)) {
                        changedFields[key] = editedValue ? new Date(editedValue) : null;
                    } else if (numberFields.includes(key)) {
                        const editedNum = editedValue ? parseFloat(editedValue) : null;
                        changedFields[key] = editedValue === '' || editedValue === null ? null : editedNum;
                    } else {
                        changedFields[key] = editedValue === '' ? null : editedValue;
                    }
                }
            });

            if (Object.keys(changedFields).length === 0) {
                setIsEditing(false); 
                return; 
            }

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

    const handleVoid = async (reason) => {
        try {
            await voidBooking(booking.id, reason);
            setShowVoidPopup(false);
            onSave();
        } catch (err) {
            setError(err.response?.data?.message || "Failed to void booking.");
            setShowVoidPopup(false);
        }
    };

    const handleUnvoid = async () => {
        if (window.confirm("Are you sure you want to restore this booking? It will return to its previous status.")) {
            try {
                await unvoidBooking(booking.id);
                onSave();
            } catch (err) {
                setError(err.response?.data?.message || "Failed to restore booking.");
            }
        }
    };
    
    const renderDetailsTab = () => (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-x-8 gap-y-6">
            <InfoItem label="Agent / Team">
                {isEditing ? (
                    <div className="flex flex-col space-y-2">
                        <InlineSelect name="agentName" value={editData.agentName || ''} onChange={handleAgentChange}>
                            <option value="">Select an Agent</option>
                            {agents.map(agent => (
                                <option key={agent.id} value={agent.fullName}>
                                    {agent.fullName}
                                </option>
                            ))}
                        </InlineSelect>
                        <InlineSelect name="teamName" value={editData.teamName || ''} onChange={handleEditChange} disabled={!!editData.agentName} >
                            <option value="">Select Team</option>
                            <option value="PH">PH</option>
                            <option value="TOURS">TOURS</option>
                        </InlineSelect>
                    </div>
                ) : (
                    <p>{booking.agentName} ({booking.teamName || 'N/A'})</p>
                )}
            </InfoItem>
            <InfoItem label="PNR">
                {isEditing ? <InlineInput name="pnr" value={editData.pnr || ''} onChange={handleEditChange} /> : <p className="font-mono">{booking.pnr}</p>}
            </InfoItem>
            <InfoItem label="Airline">
                {isEditing ? <InlineInput name="airline" value={editData.airline || ''} onChange={handleEditChange} /> : <p>{booking.airline}</p>}
            </InfoItem>
            <InfoItem label="Route">
                {isEditing ? <InlineInput name="fromTo" value={editData.fromTo || ''} onChange={handleEditChange} /> : <p>{booking.fromTo}</p>}
            </InfoItem>
            <InfoItem label="PC Date">
                {isEditing ? <InlineInput name="pcDate" type="date" value={editData.pcDate || ''} onChange={handleEditChange} /> : <p>{formatDate(booking.pcDate)}</p>}
            </InfoItem>
            <InfoItem label="Travel Date">
                {isEditing ? <InlineInput name="travelDate" type="date" value={editData.travelDate || ''} onChange={handleEditChange} /> : <p>{formatDate(booking.travelDate)}</p>}
            </InfoItem>
            <InfoItem label="Issued Date">
                {isEditing ? <InlineInput name="issuedDate" type="date" value={editData.issuedDate || ''} onChange={handleEditChange} /> : <p>{formatDate(booking.issuedDate)}</p>}
            </InfoItem>
            <InfoItem label="Payment Method"><p>{booking.paymentMethod?.replace(/_/g, ' ')}</p></InfoItem>
            <InfoItem label="Description" className="col-span-full">
                {isEditing ? <textarea name="description" value={editData.description || ''} onChange={handleEditChange} rows="3" className="w-full py-1 px-2 border border-slate-300 rounded-md bg-white shadow-sm focus:ring-2 focus:ring-blue-500"/> : (
                    <div className="text-sm italic text-slate-700 bg-slate-50 p-2 rounded-md min-h-[4rem]">
                        {booking.description || 'No description provided.'}
                    </div>
                )}
            </InfoItem>
        </div>
    );

    const renderFinancialsTab = () => (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-6">
            <InfoItem label="Revenue">
                {isEditing ? <InlineInput name="revenue" type="number" step="0.01" value={editData.revenue ?? ''} onChange={handleEditChange} /> : <p className="font-semibold text-green-600">£{booking.revenue?.toFixed(2)}</p>}
            </InfoItem>
            <InfoItem label="Product Cost">
                <div className="flex items-center gap-4">
                    <p className="font-semibold text-red-600">£{booking.prodCost?.toFixed(2)}</p>
                    
                    {/* --- ROLE CHECK FOR EDIT COSTS BUTTON --- */}
                    {/* Show if (editing OR missing suppliers) AND user has edit permission */}
                    {(isEditing || hasMissingSuppliers) && permissions.canEdit && (
                        <button 
                            onClick={() => setShowCostEditor(true)}
                            className="px-3 py-1 text-xs font-semibold bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200"
                            disabled={isVoided}
                        >
                            Edit Costs
                        </button>
                    )}
                </div>
            </InfoItem>
            <InfoItem label="Trans. Fee">
                {isEditing ? <InlineInput name="transFee" type="number" step="0.01" value={editData.transFee ?? ''} onChange={handleEditChange} /> : <p>£{booking.transFee?.toFixed(2)}</p>}
            </InfoItem>
            <InfoItem label="Surcharge">
                {isEditing ? <InlineInput name="surcharge" type="number" step="0.01" value={editData.surcharge ?? ''} onChange={handleEditChange} /> : <p>£{booking.surcharge?.toFixed(2)}</p>}
            </InfoItem>
            <InfoItem label="Total Received"><p className="font-semibold text-green-600">£{totalReceived.toFixed(2)}</p></InfoItem>
            <InfoItem label="Balance Due">
                {isEditing ? <InlineInput name="balance" type="number" step="0.01" value={editData.balance ?? ''} onChange={handleEditChange} /> : <p className={`font-semibold ${booking.balance > 0 ? 'text-red-600' : 'text-green-600'}`}>£{booking.balance?.toFixed(2)}</p>}
            </InfoItem>
            <InfoItem label="Profit">
                {isEditing ? <InlineInput name="profit" type="number" step="0.01" value={editData.profit ?? ''} onChange={handleEditChange} /> : <p className={`font-bold text-2xl ${booking.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>£{booking.profit?.toFixed(2)}</p>}
            </InfoItem>
             <InfoItem label="Invoice #">
                {isEditing ? <InlineInput name="invoiced" value={editData.invoiced || ''} onChange={handleEditChange} /> : <p>{booking.invoiced}</p>}
            </InfoItem>
        </div>
    );

    const customerPaymentsData = paymentHistory.map(payment => (
        <tr key={payment.id}>
            <td className="px-4 py-3 whitespace-nowrap">{formatDate(payment.date)}</td>
            <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center gap-2">
                    {payment.icon} <span>{payment.type}</span>
                </div>
            </td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{payment.method}</td>
            <td className="px-4 py-3 whitespace-nowrap text-sm text-slate-500">{payment.details}</td>
            <td className={`px-4 py-3 whitespace-nowrap text-right font-semibold ${payment.amount < 0 ? 'text-red-600' : 'text-slate-700'}`}>
                £{payment.amount?.toFixed(2)}
            </td>
        </tr>
    ));

    const supplierPaymentsData = booking.costItems?.flatMap(item => 
        (item.suppliers || []).map(supplier => (
            <tr key={supplier.id}>
                <td className="px-4 py-3 whitespace-nowrap font-semibold">{supplier.supplier}</td>
                <td className="px-4 py-3 whitespace-nowrap">{item.category}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-slate-700">£{supplier.amount?.toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-green-600">£{supplier.paidAmount?.toFixed(2)}</td>
                <td className="px-4 py-3 whitespace-nowrap text-right text-red-600">£{supplier.pendingAmount?.toFixed(2)}</td>
            </tr>
        ))
    );

    const renderPaymentsTable = (headers, data) => (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="min-w-full">
                <thead className="bg-slate-50"><tr>
                    {headers.map(h => <th key={h} className={`px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider ${h === 'Amount' ? 'text-right' : ''}`}>{h}</th>)}
                </tr></thead>
                <tbody className="bg-white divide-y divide-slate-200">
                    {data && data.length > 0 ? data : (
                        <tr><td colSpan={headers.length} className="text-center py-10 text-slate-500">No payment records found.</td></tr>
                    )}
                </tbody>
            </table>
        </div>
    );

    const renderHistoryTab = () => {
        if (loadingHistory) { return <div className="flex justify-center items-center p-10"><FaSpinner className="animate-spin h-8 w-8 text-blue-500" /><span className="ml-4 text-slate-600">Loading History...</span></div>; }
        if (auditHistory.length === 0) { return <div className="text-center p-10"><FaHistory className="h-12 w-12 text-slate-300 mx-auto mb-4" /><h3 className="text-lg font-medium text-slate-700">No History Found</h3><p className="text-sm text-slate-500 mt-1">There are no recorded changes for this booking.</p></div>; }
        return <ul className="divide-y divide-slate-100">{auditHistory.map(log => <HistoryItem key={log.id} log={log} />)}</ul>;
    };

    return (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-75 flex items-center justify-center p-4 z-40 animate-fade-in" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col transform animate-slide-up" onClick={e => e.stopPropagation()}>
                <header className="flex justify-between items-start p-5 border-b border-slate-200 bg-slate-50/50 rounded-t-xl">
                    <div>
                        <h2 className="text-2xl font-bold text-slate-900">Booking Details</h2>
                        <p className="text-sm text-slate-500 mt-1">Ref: <span className="font-semibold text-blue-600">{booking.refNo}</span> | Passenger: <span className="font-semibold">{booking.paxName}</span></p>
                    </div>
                    
                    {/* --- 4. UPDATED HEADER ACTIONS --- */}
                    <div className="flex items-center space-x-2 flex-shrink-0">
                        {isEditing ? (
                            // This part is only reachable if user has edit permission
                            <>
                                <ActionButton onClick={handleSave} icon={<FaSave />} className="bg-green-600 text-white hover:bg-green-700">Save Changes</ActionButton>
                                <ActionButton onClick={() => { setIsEditing(false); setEditData(booking); }} icon={<FaBan />} className="bg-slate-500 text-white hover:bg-slate-600">Cancel</ActionButton>
                            </>
                        ) : (
                            // View Mode
                            <>
                                {/* --- BUTTON FOR EVERYONE --- */}
                                <ActionButton 
                                    onClick={handleGenerateInvoice} 
                                    icon={isGeneratingInvoice ? <FaSpinner className="animate-spin" /> : <FaFileInvoice />}
                                    className="bg-teal-600 text-white hover:bg-teal-700"
                                    disabled={isGeneratingInvoice || isVoided}
                                >
                                    {isGeneratingInvoice ? 'Generating...' : (booking.invoiced ? 'Re-Download Invoice' : 'Generate Invoice')}
                                </ActionButton>

                                {/* --- ADMIN-ONLY BUTTONS --- */}
                                {permissions.canEdit && (
                                    <ActionButton onClick={() => setIsEditing(true)} disabled={isVoided} icon={<FaPencilAlt />} className="bg-blue-600 text-white hover:bg-blue-700">Edit</ActionButton>
                                )}
                                {permissions.canDateChange && booking.bookingStatus !== 'CANCELLED' && (
                                    <ActionButton
                                        onClick={handleDateChange} icon={<FaCalendarAlt />}
                                        className="bg-purple-600 text-white hover:bg-purple-700"
                                        disabled={isVoided || booking.isChainCancelled || booking.bookingStatus === 'CANCELLED'}
                                        title={booking.isChainCancelled ? "Cannot create date change for a cancelled booking chain." : ""}
                                    >Date Change</ActionButton>
                                )}
                                {permissions.canCancel && !booking.cancellation && booking.bookingStatus !== 'CANCELLED' && (
                                    <ActionButton onClick={() => setShowCancelPopup(true)} disabled={isVoided} icon={<FaBan />} className="bg-red-600 text-white hover:bg-red-700">Cancel Booking</ActionButton>
                                )}
                                {permissions.canVoid && (
                                    isVoided ? (
                                        <ActionButton onClick={handleUnvoid} icon={<FaUndo />} className="bg-green-600 text-white hover:bg-green-700">Unvoid</ActionButton>
                                    ) : (
                                        <ActionButton onClick={() => setShowVoidPopup(true)} icon={<FaExclamationTriangle />} className="bg-orange-500 text-white hover:bg-orange-600">Void Booking</ActionButton>
                                    )
                                )}
                            </>
                        )}
                        <button onClick={onClose} className="p-2 rounded-full text-slate-500 hover:bg-slate-200 hover:text-slate-800 transition-colors"><FaTimes size={20} /></button>
                    </div>
                </header>
                
                {isVoided && (
                    <div className="p-4 bg-gray-700 text-white text-center">
                        <h4 className="font-bold text-lg">THIS BOOKING IS VOID</h4>
                        <p className="text-sm text-gray-300 mt-1"><strong>Reason:</strong> {booking.voidReason}</p>
                        <p className="text-xs text-gray-400 mt-1">Voided on {new Date(booking.voidedAt).toLocaleDateString()}</p>
                    </div>
                )}

                <div className="border-b border-slate-200 px-5 bg-slate-50/50">
                    <nav className="flex space-x-2 -mb-px">
                        <TabButton label="Main Details" isActive={activeTab === 'details'} onClick={() => setActiveTab('details')} />
                        <TabButton label="Financials" isActive={activeTab === 'financials'} onClick={() => setActiveTab('financials')} />
                        <TabButton label="Customer Payments" isActive={activeTab === 'customer'} onClick={() => setActiveTab('customer')} />
                        <TabButton label="Supplier Payments" isActive={activeTab === 'supplier'} onClick={() => setActiveTab('supplier')} />
                        <TabButton label="History" isActive={activeTab === 'history'} onClick={() => setActiveTab('history')} />  
                    </nav>
                </div>
                
                <div className="p-6 overflow-y-auto flex-grow bg-white rounded-b-xl">
                    {error && <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-lg flex items-center gap-3"><FaExclamationTriangle />{error}</div>}
                    
                    {activeTab === 'details' && renderDetailsTab()}
                    {activeTab === 'financials' && renderFinancialsTab()}
                    
                    {activeTab === 'customer' && renderPaymentsTable(
                        ['Date', 'Description', 'Method', 'Details', 'Amount'], 
                        customerPaymentsData
                    )}
                    
                    {activeTab === 'supplier' && renderPaymentsTable(
                        ['Supplier', 'Category', 'Total Due', 'Paid', 'Pending'], 
                        supplierPaymentsData
                    )}
                    
                    {activeTab === 'history' && renderHistoryTab()}
                </div>

                {showCancelPopup && <CancellationPopup booking={booking} onClose={() => setShowCancelPopup(false)} onConfirm={handleConfirmCancellation} />}
                {showVoidPopup && <VoidReasonPopup onCancel={() => setShowVoidPopup(false)} onSubmit={handleVoid} />}
                {showCostEditor && <ProductCostBreakdown initialBreakdown={booking.costItems} totalCost={booking.prodCost} onClose={() => setShowCostEditor(false)} onSubmit={handleCostBreakdownSave} />}
            </div>
        </div>
    );
}