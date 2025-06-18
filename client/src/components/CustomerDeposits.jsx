import { useState, useEffect } from 'react';
import { getCustomerDeposits } from '../api/api';
import InstalmentPaymentPopup from './InstalmentPaymentPopup';

export default function CustomerDeposits() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [paymentPopup, setPaymentPopup] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [filter, setFilter] = useState('all');

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

  const handleSavePayment = (updatedInstalment) => {
    setBookings((prevBookings) =>
      prevBookings.map((booking) => {
        // Find the old instalment to check its previous status
        const oldInstalment = booking.instalments.find((inst) => inst.id === updatedInstalment.id);
        // Determine if the instalment is newly paid (was PENDING/OVERDUE, now PAID)
        const isNewlyPaid =
          updatedInstalment.status === 'PAID' &&
          oldInstalment &&
          ['PENDING', 'OVERDUE'].includes(oldInstalment.status);
        return {
          ...booking,
          instalments: booking.instalments.map((inst) =>
            inst.id === updatedInstalment.id ? updatedInstalment : inst
          ),
          totalInstalments: booking.instalments
            .reduce((sum, inst) =>
              sum + (inst.id === updatedInstalment.id ? parseFloat(updatedInstalment.amount) : parseFloat(inst.amount)),
              0
            )
            .toFixed(2),
          received: isNewlyPaid
            ? (booking.received || 0) + parseFloat(updatedInstalment.amount)
            : booking.received,
          balance: isNewlyPaid
            ? (booking.revenue || 0) - ((booking.received || 0) + parseFloat(updatedInstalment.amount))
            : booking.balance,
        };
      })
    );
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
    const today = new Date('2025-06-18');
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
    const allPaid = booking.instalments.every((inst) => inst.status === 'PAID');
    if (filter === 'ongoing') return !allPaid;
    if (filter === 'completed') return allPaid;
    return true;
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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-6">{errorMessage}</p>
          <button
            onClick={fetchBookings}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-2xl rounded-2xl overflow-hidden p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Customer Deposits</h2>
        <div className="relative">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="appearance-none p-2 border border-gray-300 rounded-lg bg-white text-gray-700 focus:ring-2 focus:ring-blue-500 pr-8"
          >
            <option value="all">All Bookings</option>
            <option value="ongoing">Ongoing</option>
            <option value="completed">Completed</option>
          </select>
          <svg
            className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      {filteredBookings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">PC Date</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Folder Number</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Passenger Name</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Agent</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Travel Date</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Total Instalments (£)</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Initial Payment (£)</th>
                <th className="py-3 px-6 text-left text-sm font-semibold text-gray-700">Instalments</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredBookings.map((booking) => {
                const nextUnpaidInstalment = getNextUnpaidInstalment(booking.instalments);
                const isExpanded = expandedRows[booking.id] || false;
                const daysLeft = calculateDaysLeft(booking.travelDate);

                return (
                  <tr key={booking.id} className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="py-4 px-6 text-sm text-gray-600">{formatDate(booking.pcDate)}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.refNo}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.paxName}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">{booking.agentName}</td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {formatDate(booking.travelDate)}
                      <br />
                      {daysLeft !== null && (
                        <span
                          className={`text-xs font-medium ${
                            daysLeft <= 7 ? 'text-red-700' : 'text-blue-700'
                          }`}
                        >
                          {daysLeft} days left
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {booking.totalInstalments ? parseFloat(booking.totalInstalments).toFixed(2) : '0.00'}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      {booking.received ? parseFloat(booking.received).toFixed(2) : '0.00'}
                    </td>
                    <td className="py-4 px-6 text-sm text-gray-600">
                      <div className="space-y-2">
                        {(isExpanded ? booking.instalments : nextUnpaidInstalment ? [nextUnpaidInstalment] : []).map(
                          (instalment) => (
                            <div key={instalment.id} className="flex items-center space-x-3">
                              <>
                                <span
                                  className={`${
                                    instalment.status === 'OVERDUE'
                                      ? 'text-red-500'
                                      : instalment.status === 'PAID'
                                      ? 'text-green-500'
                                      : 'text-gray-600'
                                  }`}
                                >
                                  Due: {formatDate(instalment.dueDate)} - £{parseFloat(instalment.amount).toFixed(2)} (
                                  {instalment.status}) - {getTransactionMethod(instalment)}
                                </span>
                                {instalment.status !== 'PAID' && (
                                  <button
                                    onClick={() => handleOpenPaymentPopup(instalment, booking)}
                                    className="px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
                                  >
                                    Record Payment
                                  </button>
                                )}
                              </>
                            </div>
                          )
                        )}
                        {booking.instalments.length > 1 && (
                          <button
                            onClick={() => toggleExpand(booking.id)}
                            className="mt-2 text-blue-600 hover:text-blue-800 text-sm font-medium"
                          >
                            {isExpanded ? 'Collapse' : 'Show All Instalments'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-12">
          <svg
            className="h-16 w-16 text-gray-400 mx-auto mb-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">No Customer Deposits Found</h3>
          <p className="text-gray-500">Create a booking with INTERNAL payment method to get started.</p>
        </div>
      )}
      {paymentPopup && (
        <InstalmentPaymentPopup
          instalment={paymentPopup.instalment}
          booking={paymentPopup.booking}
          onClose={() => setPaymentPopup(null)}
          onSubmit={handleSavePayment}
        />
      )}
    </div>
  );
}