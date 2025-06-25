import { useState, useEffect } from 'react';
import { getCustomerDeposits, recordSettlementPayment } from '../api/api';
import InstalmentPaymentPopup from './InstalmentPaymentPopup';
import FinalSettlementPopup from './FinalSettlementPopup';
import PaymentHistoryPopup from './PaymentHistoryPopup'; // Make sure this is imported
import { FaSearch, FaExclamationCircle } from 'react-icons/fa';

export default function CustomerDeposits() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentPopup, setPaymentPopup] = useState(null);
  const [settlementPopup, setSettlementPopup] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  
  // State for the new history popup
  const [historyPopupBooking, setHistoryPopupBooking] = useState(null);

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

  const handleOpenPaymentPopup = (instalment, booking) => {
    setPaymentPopup({ instalment, booking });
  };

  const handleOpenSettlementPopup = (booking) => {
    setSettlementPopup(booking);
  };

  const handleSavePayment = (payload) => {
    const { updatedInstalment, bookingUpdate } = payload;
    setBookings((prevBookings) =>
      prevBookings.map((booking) => {
        if (booking.id !== bookingUpdate.id) {
          return booking;
        }
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
  };

  const handleSaveSettlement = async (bookingId, paymentData) => {
    await recordSettlementPayment(bookingId, paymentData);
    fetchBookings();
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const toggleExpand = (bookingId) => {
    setExpandedRows((prev) => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const getNextUnpaidInstalment = (instalments) => {
    return instalments.find((inst) => inst.status === 'PENDING' || inst.status === 'OVERDUE') || null;
  };

  const calculateDaysLeft = (travelDate) => {
    if (!travelDate) return null;
    const today = new Date();
    const travel = new Date(travelDate);
    const diffTime = travel - today;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays >= 0 ? diffDays : null;
  };

  const getTransactionMethod = (instalment) => {
    if (!instalment.payments || instalment.payments.length === 0) return 'N/A';
    const latestPayment = instalment.payments.reduce((latest, payment) =>
      new Date(payment.createdAt) > new Date(latest.createdAt) ? payment : latest
    );
    return latestPayment.transactionMethod.replace('_', ' ');
  };

  const filteredBookings = bookings.filter((booking) => {
    const balance = parseFloat(booking.balance);
    const statusMatch =
      (filter === 'ongoing' && balance > 0) ||
      (filter === 'completed' && balance <= 0) ||
      filter === 'all';
    
    if (!statusMatch) {
      return false;
    }

    if (searchTerm.trim() === '') {
      return true;
    }

    const searchLower = searchTerm.toLowerCase();

    const refNoMatch = booking.refNo.toLowerCase().includes(searchLower);
    const paxNameMatch = booking.paxName.toLowerCase().includes(searchLower);
    const agentNameMatch = booking.agentName.toLowerCase().includes(searchLower);

    return refNoMatch || paxNameMatch || agentNameMatch;
  });

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
    <div className="bg-white shadow-2xl rounded-2xl overflow-hidden p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6 flex-wrap gap-4">
        <h2 className="text-2xl font-bold text-gray-800">Customer Deposits</h2>
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FaSearch className="h-4 w-4 text-gray-400" />
            </div>
            <input type="text" placeholder="Search by Ref, Passenger, Agent..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition" />
          </div>
          <div className="relative">
            <select value={filter} onChange={(e) => setFilter(e.target.value)} className="appearance-none p-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 pr-8">
              <option value="all">All Bookings</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
            </select>
            <svg className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>
      </div>
      
      {filteredBookings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">PC Date</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Ref No</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Passenger Name</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Agent</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Travel Date</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Revenue (£)</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Initial Deposit (£)</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Total Paid (£)</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Balance (£)</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Instalments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.map((booking) => {
                const hasPendingInstalments = booking.instalments.some(inst => ['PENDING', 'OVERDUE'].includes(inst.status));
                const isFinalSettlementMode = parseFloat(booking.balance) > 0 && !hasPendingInstalments;
                const nextUnpaidInstalment = getNextUnpaidInstalment(booking.instalments);
                const isExpanded = expandedRows[booking.id] || false;
                const daysLeft = calculateDaysLeft(booking.travelDate);
                const balance = parseFloat(booking.balance);

                return (
                  <tr key={booking.id} className="hover:bg-blue-50 transition-colors duration-150 cursor-pointer" onClick={() => setHistoryPopupBooking(booking)}>
                    <td className="py-4 px-6 text-sm text-gray-600">{formatDate(booking.pcDate)}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.refNo}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.paxName}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.agentName}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {formatDate(booking.travelDate)}
                      <br />
                      {daysLeft !== null && (<span className={`text-xs font-medium ${daysLeft <= 7 ? 'text-red-700' : 'text-blue-700'}`}>{daysLeft} days left</span>)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-800 font-medium">{parseFloat(booking.revenue).toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{parseFloat(booking.initialDeposit).toFixed(2)}</td>
                    <td className="py-4 px-6 text-sm text-gray-800 font-medium">{parseFloat(booking.received).toFixed(2)}</td>
                    <td className={`py-4 px-6 text-sm font-bold ${balance > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {balance.toFixed(2)}
                        {balance < 0 && (<span className="block text-xs font-normal">(Overpaid by {Math.abs(balance).toFixed(2)})</span>)}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {isFinalSettlementMode ? (
                        <div onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center space-x-3 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                           <FaExclamationCircle className="h-5 w-5 text-yellow-500 flex-shrink-0"/>
                           <div className="flex-grow">
                            <span className="font-semibold text-yellow-800">Final Balance Due: £{balance.toFixed(2)}</span>
                            <button onClick={() => handleOpenSettlementPopup(booking)} className="block mt-1 w-full text-center px-3 py-1 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors duration-200 text-xs font-bold">Record Settlement</button>
                           </div>
                          </div>
                        </div>
                      ) : (
                        <div onClick={(e) => e.stopPropagation()}>
                          {(isExpanded ? booking.instalments : nextUnpaidInstalment ? [nextUnpaidInstalment] : []).map(
                            (instalment) => (
                              <div key={instalment.id} className="flex items-center space-x-3">
                                  <span className={`${instalment.status === 'OVERDUE' ? 'text-red-500' : instalment.status === 'PAID' ? 'text-green-500' : 'text-gray-600'}`}>
                                    Due: {formatDate(instalment.dueDate)} - £{parseFloat(instalment.amount).toFixed(2)} ({instalment.status}) - {getTransactionMethod(instalment)}
                                  </span>
                                  {instalment.status !== 'PAID' && (
                                    <button onClick={() => handleOpenPaymentPopup(instalment, booking)} className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">Pay</button>
                                  )}
                              </div>
                            )
                          )}
                          {booking.instalments.length > 1 && (
                            <button onClick={(e) => { e.stopPropagation(); toggleExpand(booking.id); }} className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium">
                              {isExpanded ? 'Collapse' : 'Show All Instalments'}
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Customer Deposits Found</h3>
          <p className="text-gray-500">Create a booking with INTERNAL payment method to get started.</p>
        </div>
      )}

      {/* RENDER POPUPS CONDITIONALLY */}
      {paymentPopup && (
        <InstalmentPaymentPopup
          instalment={paymentPopup.instalment}
          booking={paymentPopup.booking}
          onClose={() => setPaymentPopup(null)}
          onSubmit={handleSavePayment}
        />
      )}
      {settlementPopup && (
        <FinalSettlementPopup
          booking={settlementPopup}
          onClose={() => setSettlementPopup(null)}
          onSubmit={handleSaveSettlement}
        />
      )}
      {/* THIS IS THE FIX: Use the state variable to conditionally render the popup */}
      {historyPopupBooking && (
        <PaymentHistoryPopup 
          booking={historyPopupBooking}
          onClose={() => setHistoryPopupBooking(null)}
        />
      )}
    </div>
  );
}