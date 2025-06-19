import { useState, useEffect } from 'react';
import { getPendingBookings, approveBooking, rejectBooking, updatePendingBooking } from '../api/api';

export default function PendingBookingsReview({ searchTerm = '' }) {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);

  useEffect(() => {
    fetchPendingBookings();
  }, []);

  const fetchPendingBookings = async () => {
    try {
      setLoading(true);
      const response = await getPendingBookings();
      setPendingBookings(response.data.data || []);
    } catch (err) {
      setError('Failed to load pending bookings.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (bookingId) => {
    try {
      await approveBooking(bookingId);
      setPendingBookings(pendingBookings.filter(b => b.id !== bookingId));
      setSelectedBooking(null);
      setEditMode(false);
    } catch (err) {
      setError('Failed to approve booking.');
      console.error(err);
    }
  };

  const handleReject = async (bookingId) => {
    try {
      await rejectBooking(bookingId);
      setPendingBookings(pendingBookings.filter(b => b.id !== bookingId));
      setSelectedBooking(null);
      setEditMode(false);
    } catch (err) {
      setError('Failed to reject booking.');
      console.error(err);
    }
  };

  const viewDetails = (booking) => {
    setSelectedBooking(selectedBooking && selectedBooking.id === booking.id ? null : booking);
    setEditMode(false);
    setEditForm(null);
  };

  const startEdit = (booking) => {
    setSelectedBooking(booking);
    setEditMode(true);
    setEditForm({
      id: booking.id,
      refNo: booking.refNo || '',
      paxName: booking.paxName || '',
      agentName: booking.agentName || '',
      pnr: booking.pnr || '',
      airline: booking.airline || '',
      fromTo: booking.fromTo || '',
      travelDate: booking.travelDate ? new Date(booking.travelDate).toISOString().split('T')[0] : '',
      revenue: booking.revenue ? parseFloat(booking.revenue).toFixed(2) : '',
      teamName: booking.teamName || '',
      bookingType: booking.bookingType || '',
      paymentMethod: booking.paymentMethod || '',
      pcDate: booking.pcDate ? new Date(booking.pcDate).toISOString().split('T')[0] : '',
      issuedDate: booking.issuedDate ? new Date(booking.issuedDate).toISOString().split('T')[0] : '',
      lastPaymentDate: booking.lastPaymentDate ? new Date(booking.lastPaymentDate).toISOString().split('T')[0] : '',
    });
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        refNo: editForm.refNo,
        paxName: editForm.paxName,
        agentName: editForm.agentName,
        pnr: editForm.pnr,
        airline: editForm.airline,
        fromTo: editForm.fromTo,
        travelDate: editForm.travelDate ? new Date(editForm.travelDate).toISOString() : null,
        revenue: editForm.revenue ? parseFloat(editForm.revenue) : null,
        teamName: editForm.teamName || null,
        bookingType: editForm.bookingType || null,
        paymentMethod: editForm.paymentMethod || null,
        pcDate: editForm.pcDate ? new Date(editForm.pcDate).toISOString() : null,
        issuedDate: editForm.issuedDate ? new Date(editForm.issuedDate).toISOString() : null,
        lastPaymentDate: editForm.lastPaymentDate ? new Date(editForm.lastPaymentDate).toISOString() : null,
      };

      // Basic client-side validation
      const requiredFields = ['refNo', 'paxName', 'agentName', 'pnr', 'airline', 'fromTo', 'bookingType', 'paymentMethod', 'pcDate'];
      const missingFields = requiredFields.filter(field => !updatedData[field]);
      if (missingFields.length > 0) {
        setError(`Missing required fields: ${missingFields.join(', ')}`);
        return;
      }

      await updatePendingBooking(editForm.id, updatedData);
      await fetchPendingBookings(); // Refresh the list
      setEditMode(false);
      setSelectedBooking(null);
      setEditForm(null);
      setError('');
    } catch (err) {
      setError('Failed to update booking: ' + (err.response?.data?.message || err.message));
      console.error(err);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString();
  };

  const filteredBookings = pendingBookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      booking.refNo?.toLowerCase().includes(searchLower) ||
      booking.paxName?.toLowerCase().includes(searchLower) ||
      booking.agentName?.toLowerCase().includes(searchLower) ||
      booking.pnr?.toLowerCase().includes(searchLower) ||
      booking.airline?.toLowerCase().includes(searchLower) ||
      booking.fromTo?.toLowerCase().includes(searchLower) ||
      booking.bookingType?.toLowerCase().includes(searchLower) ||
      booking.status?.toLowerCase().includes(searchLower) ||
      booking.teamName?.toLowerCase().includes(searchLower) ||
      formatDate(booking.pcDate)?.toLowerCase().includes(searchLower) ||
      formatDate(booking.issuedDate)?.toLowerCase().includes(searchLower) ||
      booking.paymentMethod?.toLowerCase().includes(searchLower) ||
      formatDate(booking.lastPaymentDate)?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center py-8 bg-white rounded-xl shadow-md">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg font-medium text-gray-700">Loading pending bookings...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-8 bg-white rounded-xl shadow-md">
      <div className="text-center max-w-md">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={fetchPendingBookings}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="bg-white shadow-xl rounded-xl overflow-hidden">
      <div className="p-6">
        <h2 className="text-xl font-semibold mb-4 text-gray-700">Pending Bookings</h2>
        {filteredBookings.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white rounded-lg">
              <thead>
                <tr className="bg-gray-200 text-gray-700">
                  <th className="py-2 px-4">Ref No</th>
                  <th className="py-2 px-4">Passenger</th>
                  <th className="py-2 px-4">Agent</th>
                  <th className="py-2 px-4">PNR</th>
                  <th className="py-2 px-4">From/To</th>
                  <th className="py-2 px-4">Travel Date</th>
                  <th className="py-2 px-4">Revenue (£)</th>
                  <th className="py-2 px-4">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredBookings.map(booking => (
                  <tr key={booking.id} className="border-b hover:bg-gray-50">
                    <td className="py-2 px-4">{booking.refNo}</td>
                    <td className="py-2 px-4">{booking.paxName}</td>
                    <td className="py-2 px-4">{booking.agentName}</td>
                    <td className="py-2 px-4">{booking.pnr}</td>
                    <td className="py-2 px-4">{booking.fromTo}</td>
                    <td className="py-2 px-4">{formatDate(booking.travelDate)}</td>
                    <td className="py-2 px-4">{booking.revenue ? parseFloat(booking.revenue).toFixed(2) : 'N/A'}</td>
                    <td className="py-2 px-4">
                      <div className="flex space-x-2">
                        <button
                          onClick={() => viewDetails(booking)}
                          className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
                        >
                          {selectedBooking && selectedBooking.id === booking.id && !editMode ? 'Hide Details' : 'View Details'}
                        </button>
                        <button
                          onClick={() => startEdit(booking)}
                          className="px-3 py-1 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleApprove(booking.id)}
                          className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(booking.id)}
                          className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {selectedBooking && !editMode && (
              <div className="mt-4 p-4 bg-gray-200 rounded">
                <h3 className="text-lg font-semibold mb-2">Booking Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <p><strong>Reference No:</strong> {selectedBooking.refNo}</p>
                  <p><strong>Passenger Name:</strong> {selectedBooking.paxName}</p>
                  <p><strong>Agent Name:</strong> {selectedBooking.agentName}</p>
                  <p><strong>Team:</strong> {selectedBooking.teamName || 'N/A'}</p>
                  <p><strong>PNR:</strong> {selectedBooking.pnr}</p>
                  <p><strong>Airline:</strong> {selectedBooking.airline}</p>
                  <p><strong>From/To:</strong> {selectedBooking.fromTo}</p>
                  <p><strong>Booking Type:</strong> {selectedBooking.bookingType}</p>
                  <p><strong>Status:</strong> {selectedBooking.status || 'PENDING'}</p>
                  <p><strong>PC Date:</strong> {formatDate(selectedBooking.pcDate)}</p>
                  <p><strong>Issued Date:</strong> {formatDate(selectedBooking.issuedDate)}</p>
                  <p><strong>Payment Method:</strong> {selectedBooking.paymentMethod}</p>
                  <p><strong>Last Payment Date:</strong> {formatDate(selectedBooking.lastPaymentDate)}</p>
                  <p><strong>Supplier:</strong> {selectedBooking.supplier || 'N/A'}</p>
                  <p><strong>Travel Date:</strong> {formatDate(selectedBooking.travelDate)}</p>
                  <p><strong>Revenue (£):</strong> {selectedBooking.revenue ? parseFloat(selectedBooking.revenue).toFixed(2) : 'N/A'}</p>
                  <p><strong>Production Cost (£):</strong> {selectedBooking.prodCost ? parseFloat(selectedBooking.prodCost).toFixed(2) : '0.00'}</p>
                  {selectedBooking.costItems?.length > 0 && (
                    <p>
                      <strong>Cost Breakdown:</strong>
                      {selectedBooking.costItems.map(item => (
                        <span key={item.id} className="mr-2">
                          {item.category}: £{parseFloat(item.amount).toFixed(2)}
                        </span>
                      ))}
                    </p>
                  )}
                  {selectedBooking.instalments?.length > 0 && (
                    <p>
                      <strong>Instalments:</strong>
                      {selectedBooking.instalments.map((inst, index) => (
                        <span key={index} className="mr-2 block">
                          Due: {formatDate(inst.dueDate)} - £{parseFloat(inst.amount).toFixed(2)} ({inst.status})
                        </span>
                      ))}
                    </p>
                  )}
                  <p><strong>Transaction Fee (£):</strong> {selectedBooking.transFee ? parseFloat(selectedBooking.transFee).toFixed(2) : '0.00'}</p>
                  <p><strong>Surcharge (£):</strong> {selectedBooking.surcharge ? parseFloat(selectedBooking.surcharge).toFixed(2) : '0.00'}</p>
                  <p><strong>Amount Received (£):</strong> {selectedBooking.received ? parseFloat(selectedBooking.received).toFixed(2) : '0.00'}</p>
                  <p><strong>Balance (£):</strong> {selectedBooking.balance ? parseFloat(selectedBooking.balance).toFixed(2) : '0.00'}</p>
                  <p><strong>Profit (£):</strong> {selectedBooking.profit ? parseFloat(selectedBooking.profit).toFixed(2) : '0.00'}</p>
                  <p><strong>Invoiced:</strong> {selectedBooking.invoiced || 'N/A'}</p>
                  <p><strong>Submitted At:</strong> {selectedBooking.createdAt ? new Date(selectedBooking.createdAt).toLocaleString() : 'N/A'}</p>
                </div>
              </div>
            )}
            {editMode && editForm && (
              <div className="mt-4 p-4 bg-gray-200 rounded">
                <h3 className="text-lg font-semibold mb-2">Edit Booking</h3>
                <form onSubmit={handleEditSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Reference No</label>
                    <input
                      type="text"
                      name="refNo"
                      value={editForm.refNo}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Passenger Name</label>
                    <input
                      type="text"
                      name="paxName"
                      value={editForm.paxName}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Agent Name</label>
                    <input
                      type="text"
                      name="agentName"
                      value={editForm.agentName}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">PNR</label>
                    <input
                      type="text"
                      name="pnr"
                      value={editForm.pnr}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Airline</label>
                    <input
                      type="text"
                      name="airline"
                      value={editForm.airline}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">From/To</label>
                    <input
                      type="text"
                      name="fromTo"
                      value={editForm.fromTo}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Travel Date</label>
                    <input
                      type="date"
                      name="travelDate"
                      value={editForm.travelDate}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Revenue (£)</label>
                    <input
                      type="number"
                      name="revenue"
                      value={editForm.revenue}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      step="0.01"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Team</label>
                    <select
                      name="teamName"
                      value={editForm.teamName}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                    >
                      <option value="">Select Team</option>
                      <option value="PH">PH</option>
                      <option value="TOURS">TOURS</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Booking Type</label>
                    <select
                      name="bookingType"
                      value={editForm.bookingType}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    >
                      <option value="">Select Type</option>
                      <option value="FRESH">FRESH</option>
                      <option value="DATE_CHANGE">DATE_CHANGE</option>
                      <option value="CANCELLATION">CANCELLATION</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Payment Method</label>
                    <select
                      name="paymentMethod"
                      value={editForm.paymentMethod}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    >
                      <option value="">Select Method</option>
                      <option value="FULL">FULL</option>
                      <option value="INTERNAL">INTERNAL</option>
                      <option value="REFUND">REFUND</option>
                      <option value="HUMM">HUMM</option>
                      <option value="FULL_HUMM">FULL_HUMM</option>
                      <option value="INTERNAL_HUMM">INTERNAL_HUMM</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">PC Date</label>
                    <input
                      type="date"
                      name="pcDate"
                      value={editForm.pcDate}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Issued Date</label>
                    <input
                      type="date"
                      name="issuedDate"
                      value={editForm.issuedDate}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Last Payment Date</label>
                    <input
                      type="date"
                      name="lastPaymentDate"
                      value={editForm.lastPaymentDate}
                      onChange={handleEditChange}
                      className="mt-1 p-2 w-full border rounded"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      type="submit"
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 mr-2"
                    >
                      Save Changes
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setEditMode(false);
                        setEditForm(null);
                        setSelectedBooking(null);
                      }}
                      className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-8">
            <svg className="h-12 w-12 text-gray-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-lg font-medium text-gray-700 mb-1">
              {searchTerm ? 'No matching pending bookings found' : 'No pending bookings available'}
            </h3>
            <p className="text-gray-500">
              {searchTerm ? 'Try adjusting your search query' : 'Create a new booking to get started'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}