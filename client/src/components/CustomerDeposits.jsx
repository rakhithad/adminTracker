import { useState, useEffect } from 'react';
import { getCustomerDeposits, updateInstalment } from '../api/api';

export default function CustomerDeposits() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [editingInstalment, setEditingInstalment] = useState(null);

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

  const handleEditInstalment = (instalment) => {
    setEditingInstalment({ ...instalment });
  };

  const handleSaveInstalment = async (instalmentId) => {
    try {
      if (!editingInstalment?.amount || parseFloat(editingInstalment.amount) <= 0) {
        setErrorMessage('Amount must be a positive number');
        return;
      }

      await updateInstalment(instalmentId, {
        amount: parseFloat(editingInstalment.amount),
        status: editingInstalment.status,
      });

      setBookings((prevBookings) =>
        prevBookings.map((booking) => ({
          ...booking,
          instalments: booking.instalments.map((inst) =>
            inst.id === instalmentId
              ? { ...inst, amount: parseFloat(editingInstalment.amount), status: editingInstalment.status }
              : inst
          ),
          totalInstalments: booking.instalments
            .reduce(
              (sum, inst) =>
                sum + (inst.id === instalmentId ? parseFloat(editingInstalment.amount) : parseFloat(inst.amount)),
              0
            )
            .toFixed(2),
        }))
      );

      setEditingInstalment(null);
      setErrorMessage('');
    } catch (error) {
      console.error('Error updating instalment:', error);
      setErrorMessage(error.response?.data?.error || 'Failed to update instalment.');
    }
  };

  const handleTogglePaid = (instalmentId, currentStatus) => {
    const newStatus = currentStatus === 'PAID' ? 'PENDING' : 'PAID';
    setEditingInstalment((prev) =>
      prev && prev.id === instalmentId ? { ...prev, status: newStatus } : { id: instalmentId, status: newStatus, amount: 0 }
    );
  };

  const handleAmountChange = (e) => {
    const value = e.target.value;
    if (value === '' || /^\d*\.?\d*$/.test(value)) {
      setEditingInstalment((prev) => (prev ? { ...prev, amount: value } : null));
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 bg-white rounded-xl shadow-md">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700">Loading customer deposits...</p>
        </div>
      </div>
    );
  }

  if (errorMessage) {
    return (
      <div className="flex items-center justify-center py-8 bg-white rounded-xl shadow-md">
        <div className="text-center max-w-md">
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
          <p className="text-gray-600 mb-4">{errorMessage}</p>
          <button
            onClick={fetchBookings}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden p-6">
      <h2 className="text-xl font-semibold mb-4 text-gray-700">Customer Deposits</h2>
      {bookings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full bg-white rounded-lg">
            <thead>
              <tr className="bg-gray-200 text-gray-700">
                <th className="py-2 px-4 text-left">PC Date</th>
                <th className="py-2 px-4 text-left">Folder Number</th>
                <th className="py-2 px-4 text-left">Passenger Name</th>
                <th className="py-2 px-4 text-left">Agent</th>
                <th className="py-2 px-4 text-left">Travel Date</th>
                <th className="py-2 px-4 text-left">Total Instalments (£)</th>
                <th className="py-2 px-4 text-left">Initial Payment (£)</th>
                <th className="py-2 px-4 text-left">Instalments</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="border-b hover:bg-gray-50">
                  <td className="py-2 px-4">{formatDate(booking.pcDate)}</td>
                  <td className="py-2 px-4">{booking.refNo}</td>
                  <td className="py-2 px-4">{booking.paxName}</td>
                  <td className="py-2 px-4">{booking.agentName}</td>
                  <td className="py-2 px-4">{formatDate(booking.travelDate)}</td>
                  <td className="py-2 px-4">{booking.totalInstalments}</td>
                  <td className="py-2 px-4">{booking.received ? parseFloat(booking.received).toFixed(2) : '0.00'}</td>
                  <td className="py-2 px-4">
                    <div className="space-y-2">
                      {booking.instalments.map((instalment) => (
                        <div key={instalment.id} className="flex items-center space-x-2">
                          {editingInstalment && editingInstalment.id === instalment.id ? (
                            <>
                              <input
                                type="number"
                                step="0.01"
                                value={editingInstalment.amount}
                                onChange={handleAmountChange}
                                className="w-24 p-1 border rounded"
                                placeholder="Amount"
                              />
                              <input
                                type="checkbox"
                                checked={editingInstalment.status === 'PAID'}
                                onChange={() => handleTogglePaid(instalment.id, editingInstalment.status)}
                                className="h-4 w-4"
                              />
                              <button
                                onClick={() => handleSaveInstalment(instalment.id)}
                                className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingInstalment(null)}
                                className="px-2 py-1 bg-gray-500 text-white rounded hover:bg-gray-600"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <>
                              <span>
                                Due: {formatDate(instalment.dueDate)} - £{parseFloat(instalment.amount).toFixed(2)}
                              </span>
                              <input
                                type="checkbox"
                                checked={instalment.status === 'PAID'}
                                onChange={() => handleTogglePaid(instalment.id, instalment.status)}
                                disabled={instalment.status === 'OVERDUE'}
                                className="h-4 w-4"
                              />
                              <button
                                onClick={() => handleEditInstalment(instalment)}
                                className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                              >
                                Edit
                              </button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-8">
          <svg className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <h3 className="text-lg font-medium text-gray-700 mb-1">No customer deposits found</h3>
          <p className="text-gray-500">Create a booking with INTERNAL payment method to get started.</p>
        </div>
      )}
    </div>
  );
}