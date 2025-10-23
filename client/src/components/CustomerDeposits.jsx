import React, { useState, useEffect, useMemo } from 'react';
import { getCustomerDeposits, generateCustomerDepositReportPDF } from '../api/api';
import InstalmentPaymentPopup from './InstalmentPaymentPopup';
import FinalSettlementPopup from './FinalSettlementPopup';
import PaymentHistoryPopup from './PaymentHistoryPopup';
import { FaSearch, FaExclamationCircle, FaCheckCircle, FaBan, FaMoneyBillWave, FaHandHoldingUsd, FaReceipt, FaDownload, FaSpinner } from 'react-icons/fa';
import SettleCustomerPayablePopup from '../components/SettleCustomerPayablePopup';
import RecordRefundPopup from '../components/RecordRefundPopup';

// --- Reusable Styled Components (ActionButton, StatusBadge) remain the same ---
const ActionButton = ({ onClick, icon, children, color = 'blue' }) => {
    const colorClasses = {
        blue: 'bg-blue-600 hover:bg-blue-700 text-white',
        red: 'bg-red-600 hover:bg-red-700 text-white',
        green: 'bg-green-600 hover:bg-green-700 text-white',
        yellow: 'bg-yellow-500 hover:bg-yellow-600 text-white',
    };
    return (
        <button
            onClick={onClick}
            className={`flex items-center justify-center gap-1 w-full px-2 py-1.5 text-xs font-bold rounded-lg shadow-sm transition-all duration-200 transform hover:scale-105 ${colorClasses[color]}`}
        >
            {icon}
            <span>{children}</span>
        </button>
    );
};
const StatusBadge = ({ children, color = 'gray' }) => {
    const colorClasses = {
        gray: 'bg-gray-100 text-gray-700',
        green: 'bg-green-100 text-green-800',
        red: 'bg-red-100 text-red-800',
        blue: 'bg-blue-100 text-blue-800' // Added blue for overpaid
    };
    return (
        <div className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold rounded-full ${colorClasses[color]}`}>
            {children}
        </div>
    );
};
// --- End Reusable Components ---

// --- Action Status Logic (extracted for reusability) ---
const getActionStatus = (booking) => {
    if (booking.bookingStatus === 'CANCELLED') {
        const cancellation = booking.cancellation;
        if (cancellation?.createdCustomerPayable?.pendingAmount > 0) return 'CUSTOMER_OWES';
        if (cancellation?.refundStatus === 'PENDING') return 'REFUND_PENDING';
        if (cancellation?.refundStatus === 'PAID') return 'REFUND_PAID';
        return 'CANCELLED_SETTLED';
    }
    const balance = parseFloat(booking.balance);
    if (balance > 0) {
        const hasPendingInstalments = (booking.instalments || []).some(inst => ['PENDING', 'OVERDUE'].includes(inst.status));
        return hasPendingInstalments ? 'INSTALMENT_DUE' : 'FINAL_SETTLEMENT_DUE';
    }
    if (balance < 0) return 'OVERPAID';
    return 'COMPLETED';
};


// --- ActionCell Component (uses getActionStatus) ---
const ActionCell = ({ booking, onAction, expanded, onToggleExpand }) => {
    const status = getActionStatus(booking); // Use the extracted logic

    switch (status) {
        case 'CUSTOMER_OWES': {
            const payable = booking.cancellation.createdCustomerPayable;
            return (
                <div className="text-center space-y-1">
                    <ActionButton color="red" icon={<FaHandHoldingUsd />} onClick={() => onAction('settlePayable', { payable, booking })}>
                        Settle Debt
                    </ActionButton>
                    <p className="text-xs text-red-600 font-medium">Owes: £{payable.pendingAmount.toFixed(2)}</p>
                </div>
            );
        }
        case 'REFUND_PENDING':
            return (
                <div className="text-center space-y-1">
                    <ActionButton color="green" icon={<FaReceipt />} onClick={() => onAction('recordRefund', { cancellation: booking.cancellation, booking })}>
                        Record Refund
                    </ActionButton>
                    <p className="text-xs text-green-700 font-medium">Due: £{booking.cancellation.refundToPassenger.toFixed(2)}</p>
                </div>
            );
        case 'REFUND_PAID': return <StatusBadge color="green"><FaCheckCircle /> Refund Paid</StatusBadge>;
        case 'CANCELLED_SETTLED': return <StatusBadge color="gray"><FaBan /> Cancelled</StatusBadge>;
        case 'FINAL_SETTLEMENT_DUE':
            return (
                <div className="text-center space-y-1">
                    <ActionButton color="yellow" icon={<FaExclamationCircle />} onClick={() => onAction('finalSettlement', booking)}>
                        Final Settlement
                    </ActionButton>
                    <p className="text-xs text-yellow-700 font-medium">Balance: £{parseFloat(booking.balance).toFixed(2)}</p>
                </div>
            );
        case 'INSTALMENT_DUE': {
            const nextInstalment = (booking.instalments || []).find(inst => ['PENDING', 'OVERDUE'].includes(inst.status));
            if (!nextInstalment) return <StatusBadge color="gray">Processing...</StatusBadge>;
            return (
                <div className="text-center space-y-1">
                    <ActionButton icon={<FaMoneyBillWave />} onClick={() => onAction('payInstalment', { instalment: nextInstalment, booking })}>
                        Pay Instalment
                    </ActionButton>
                    <div className="text-xs text-gray-600">
                        <p>Next: £{nextInstalment.amount.toFixed(2)}</p>
                        <p className={nextInstalment.status === 'OVERDUE' ? 'text-red-600 font-semibold' : ''}>
                           Due: {new Date(nextInstalment.dueDate).toLocaleDateString('en-GB')}
                        </p>
                    </div>
                     {(booking.instalments || []).length > 1 && (
                        <button onClick={onToggleExpand} className="text-blue-600 hover:underline text-xs font-medium mt-1">
                            {expanded ? 'Collapse' : 'Show All'}
                        </button>
                    )}
                </div>
            );
        }
        case 'OVERPAID': return <StatusBadge color="blue"><FaCheckCircle /> Overpaid</StatusBadge>;
        case 'COMPLETED': default: return <StatusBadge color="green"><FaCheckCircle /> Completed</StatusBadge>;
    }
};


// --- Main Component ---
export default function CustomerDeposits() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentPopup, setPaymentPopup] = useState(null);
  const [settlementPopup, setSettlementPopup] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  // CHANGED: Updated filter state and default
  const [filter, setFilter] = useState('all'); 
  const [searchTerm, setSearchTerm] = useState('');
  const [historyPopupBooking, setHistoryPopupBooking] = useState(null);
  const [customerPayablePopup, setCustomerPayablePopup] = useState(null);
  const [recordRefundPopup, setRecordRefundPopup] = useState(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 3); 
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]); 
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  useEffect(() => {
    fetchBookings();
  }, []);

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const response = await getCustomerDeposits();
      const data = response.data.data || response.data || [];
      setBookings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('Error fetching customer deposits:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to load customer deposits.');
    } finally {
      setLoading(false);
    }
  };

  const handleSavePayment = (payload) => {
    const { updatedInstalment, bookingUpdate } = payload;
    setBookings((prevBookings) =>
      prevBookings.map((booking) => {
        if (booking.id !== bookingUpdate.id) return booking;
        return {
          ...booking,
          received: bookingUpdate.received,
          balance: bookingUpdate.balance,
          instalments: booking.instalments.map((inst) =>
            inst.id === updatedInstalment.id ? updatedInstalment : inst
          ),
        };
      })
    );
    setPaymentPopup(null);
  };

  const handleActionCompletion = () => {
    fetchBookings(); // Refetch all data on completion
    setSettlementPopup(null);
    setCustomerPayablePopup(null);
    setRecordRefundPopup(null);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const toggleExpand = (bookingId) => {
    setExpandedRows((prev) => ({ ...prev, [bookingId]: !prev[bookingId] }));
  };

  // REMOVED: calculateDaysLeft function

  const filteredBookings = useMemo(() => { // CHANGED: Renamed from just 'filteredBookings'
      return bookings.filter((booking) => {
          const actionStatus = getActionStatus(booking);
          let statusMatch = true;

          // CHANGED: New filter logic based on action status
          switch (filter) {
              case 'customer_owes': statusMatch = actionStatus === 'CUSTOMER_OWES'; break;
              case 'refund_pending': statusMatch = actionStatus === 'REFUND_PENDING'; break;
              case 'final_settlement': statusMatch = actionStatus === 'FINAL_SETTLEMENT_DUE'; break;
              case 'instalment_due': statusMatch = actionStatus === 'INSTALMENT_DUE'; break;
              case 'completed_settled': 
                  statusMatch = ['COMPLETED', 'OVERPAID', 'REFUND_PAID', 'CANCELLED_SETTLED'].includes(actionStatus); 
                  break;
              case 'all': // Explicitly handle 'all'
              default: statusMatch = true; break;
          }

          if (!statusMatch) return false;

          // Search logic remains the same
          if (searchTerm.trim() === '') return true;
          const searchLower = searchTerm.toLowerCase();
          return (
              (booking.folderNo || '').toString().toLowerCase().includes(searchLower) ||
              (booking.refNo || '').toLowerCase().includes(searchLower) ||
              (booking.paxName || '').toLowerCase().includes(searchLower) ||
              (booking.agentName || '').toLowerCase().includes(searchLower) ||
              (booking.paymentMethod || '').toLowerCase().includes(searchLower) 
          );
      });
  }, [bookings, filter, searchTerm]); // Added dependencies

  const handleAction = (actionType, payload) => {
      switch (actionType) {
          case 'settlePayable': setCustomerPayablePopup(payload); break;
          case 'recordRefund': setRecordRefundPopup(payload); break;
          case 'finalSettlement': setSettlementPopup(payload); break;
          case 'payInstalment': setPaymentPopup(payload); break;
          default: console.warn('Unknown action type:', actionType);
      }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    const filters = { status: filter, searchTerm, startDate, endDate };
    const result = await generateCustomerDepositReportPDF(filters);
    if (!result.success) alert(result.message);
    setIsGeneratingReport(false);
  };

  if (loading) {

    return (

      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-lg">

        <div className="text-center">

          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>

          <p className="text-lg font-semibold text-gray-700">Loading customer deposits...</p>

        </div>

      </div>

    );

  }



  if (errorMessage) {

    return (

      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-lg">

        <div className="text-center max-w-md p-6">

          <div className="text-red-500 mb-4">

            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">

              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />

            </svg>

          </div>

          <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>

          <p className="text-gray-600 mb-6">{errorMessage}</p>

          <button onClick={fetchBookings} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">

            Retry

          </button>

        </div>

      </div>

    );

  }

  return (
    <div className="bg-white shadow-2xl rounded-2xl overflow-hidden p-6 max-w-full mx-auto">
      <div className="flex justify-between items-center mb-5 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Customer Deposits</h2>
        <div className="flex items-center gap-4 flex-wrap"> 
          {/* Date Filters remain */}
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">From:</label>
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-700">To:</label>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="p-2 border rounded-lg text-sm" />
          </div>
          
          <div className="relative">
            <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input type="text" placeholder="Search..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border rounded-lg" />
          </div>

          {/* CHANGED: Updated filter dropdown */}
          <select value={filter} onChange={(e) => setFilter(e.target.value)} className="p-2 border rounded-lg">
            <option value="all">All Statuses</option>
            <option value="instalment_due">Instalment Due</option>
            <option value="final_settlement">Final Settlement Due</option>
            <option value="customer_owes">Customer Owes (Cancelled)</option>
            <option value="refund_pending">Refund Pending (Cancelled)</option>
            <option value="completed_settled">Completed / Settled</option>
          </select>
          
          <button onClick={handleGenerateReport} disabled={isGeneratingReport} className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 disabled:bg-gray-400 transition-colors">
            <FaDownload /> <span>{isGeneratingReport ? 'Generating...' : 'Download Report'}</span>
          </button>
        </div>
      </div>
      
      {filteredBookings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Folder No</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">PC Date</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Ref No</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Passenger</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Agent</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Payment Method</th>
                {/* REMOVED: Travel Date Header */}
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Revenue (£)</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Initial Deposit (£)</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Total Paid (£)</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 whitespace-nowrap">Balance (£)</th>
                <th className="py-2 px-3 text-left text-xs font-semibold text-gray-700 w-[150px]">Action / Outcome</th> 
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.map((booking) => {
                const isCancelled = booking.bookingStatus === 'CANCELLED';
                const balance = parseFloat(booking.balance);

                return (
                  <tr key={booking.id} className={`${isCancelled ? 'bg-gray-50' : 'hover:bg-blue-50/50'} transition-colors duration-150`} >
                    <td className={`py-3 px-3 text-sm font-semibold ${isCancelled ? 'text-gray-400' : 'text-blue-600'} cursor-pointer`} onClick={() => setHistoryPopupBooking(booking)}>{booking.folderNo}</td>
                    <td className={`py-3 px-3 text-sm ${isCancelled ? 'text-gray-500' : 'text-gray-600'}`}>{formatDate(booking.pcDate)}</td>
                    <td className={`py-3 px-3 text-sm ${isCancelled ? 'text-gray-500' : 'text-gray-600'}`}>{booking.refNo}</td>
                    <td className={`py-3 px-3 text-sm ${isCancelled ? 'text-gray-500' : 'text-gray-600'}`}>{booking.paxName}</td>
                    <td className={`py-3 px-3 text-sm ${isCancelled ? 'text-gray-500' : 'text-gray-600'}`}>{booking.agentName}</td>
                    <td className={`py-3 px-3 text-sm ${isCancelled ? 'text-gray-500' : 'text-gray-600'} whitespace-nowrap`}>{booking.paymentMethod}</td>
                    {/* REMOVED: Travel Date Cell */}
                    <td className={`py-3 px-3 text-sm font-medium ${isCancelled ? 'text-gray-500' : 'text-gray-800'}`}>{parseFloat(booking.revenue).toFixed(2)}</td>
                    <td className={`py-3 px-3 text-sm ${isCancelled ? 'text-gray-500' : 'text-gray-600'}`}>{parseFloat(booking.initialDeposit || 0).toFixed(2)}</td> {/* Added default 0 */}
                    <td className={`py-3 px-3 text-sm font-medium ${isCancelled ? 'text-gray-500' : 'text-gray-800'}`}>{parseFloat(booking.received || 0).toFixed(2)}</td> {/* Added default 0 */}
                    <td className={`py-3 px-3 text-sm font-bold ${isCancelled ? 'text-gray-500' : (balance > 0 ? 'text-red-600' : (balance < 0 ? 'text-blue-600' : 'text-green-600'))}`}>
                        {balance.toFixed(2)}
                        {balance < 0 && !isCancelled && (<span className="block text-xs font-normal">(Overpaid)</span>)}
                        {balance < 0 && isCancelled && (<span className="block text-xs font-normal">(Refund Due)</span>)}
                    </td>
                    <td className="py-3 px-3 text-sm w-[150px]" onClick={e => e.stopPropagation()}>
                        <ActionCell booking={booking} onAction={handleAction} expanded={expandedRows[booking.id]} onToggleExpand={() => toggleExpand(booking.id)} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : ( 
        <div className="text-center py-16">
          <p className="text-gray-500">No bookings match your current filter.</p>
        </div>
      )}
      
      {/* Popups remain the same */}
      {paymentPopup && (<InstalmentPaymentPopup {...paymentPopup} onClose={() => setPaymentPopup(null)} onSubmit={handleSavePayment} />)}
      {settlementPopup && (<FinalSettlementPopup booking={settlementPopup} onClose={() => setSettlementPopup(null)} onSubmit={handleActionCompletion} />)}
      {historyPopupBooking && (<PaymentHistoryPopup booking={historyPopupBooking} onClose={() => setHistoryPopupBooking(null)} />)}
      {customerPayablePopup && ( <SettleCustomerPayablePopup payable={customerPayablePopup.payable} booking={customerPayablePopup.booking} onClose={() => setCustomerPayablePopup(null)} onSubmit={handleActionCompletion} /> )}
      {recordRefundPopup && ( <RecordRefundPopup cancellation={recordRefundPopup.cancellation} booking={recordRefundPopup.booking} onClose={() => setRecordRefundPopup(null)} onSubmit={handleActionCompletion} /> )}
    </div>
  );
}