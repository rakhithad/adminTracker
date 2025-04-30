import { useEffect, useState } from 'react';
import { getBookings, updateBooking } from '../api/api';
import CreateBooking from '../components/CreateBooking';

export default function AdminPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});

  const fetchBookings = async () => {
    try {
      const response = await getBookings();
      const bookingsData = Array.isArray(response.data.data) ? response.data.data : [];
      setBookings(bookingsData);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      setError("Failed to load bookings. Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleNewBooking = (newBooking) => {
    setBookings(prevBookings => [newBooking, ...prevBookings]);
  };

  const handleEditClick = (booking) => {
    setEditingId(booking.id);
    setEditFormData({
      refNo: booking.refNo,
      paxName: booking.paxName,
      agentName: booking.agentName,
      teamName: booking.teamName,
      pnr: booking.pnr,
      airline: booking.airline,
      fromTo: booking.fromTo,
      bookingType: booking.bookingType,
      bookingStatus: booking.bookingStatus,
      pcDate: booking.pcDate,
      issuedDate: booking.issuedDate,
      paymentMethod: booking.paymentMethod,
      lastPaymentDate: booking.lastPaymentDate,
      revenue: booking.revenue,
      prodCost: booking.prodCost,
      transFee: booking.transFee,
      surcharge: booking.surcharge,
      received: booking.received,
      balance: booking.balance,
      profit: booking.profit,
      invoiced: booking.invoiced
    });
  };

  const handleCancelClick = () => {
    setEditingId(null);
  };

  const handleEditFormChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditFormData({
      ...editFormData,
      [name]: type === 'checkbox' ? checked : value
    });
  };

  const handleSaveClick = async (id) => {
    try {
      await updateBooking(id, editFormData);
      setBookings(bookings.map(booking => 
        booking.id === id ? { ...booking, ...editFormData } : booking
      ));
      setEditingId(null);
    } catch (error) {
      console.error("Failed to update booking:", error);
      setError("Failed to update booking. Please try again.");
    }
  };

  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return (
      booking.refNo?.toLowerCase().includes(searchLower) ||
      booking.paxName?.toLowerCase().includes(searchLower) ||
      booking.agentName?.toLowerCase().includes(searchLower) ||
      booking.pnr?.toLowerCase().includes(searchLower) ||
      booking.airline?.toLowerCase().includes(searchLower) ||
      booking.fromTo?.toLowerCase().includes(searchLower) ||
      booking.bookingType?.toLowerCase().includes(searchLower) ||
      booking.bookingStatus?.toLowerCase().includes(searchLower) ||
      booking.teamName?.toLowerCase().includes(searchLower) ||
      booking.pcDate?.toLowerCase().includes(searchLower) ||
      booking.issuedDate?.toLowerCase().includes(searchLower) ||
      booking.paymentMethod?.toLowerCase().includes(searchLower) ||
      booking.lastPaymentDate?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-md">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg font-medium text-gray-700">Loading bookings...</p>
      </div>
    </div>
  );
  
  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center p-8 bg-white rounded-xl shadow-md max-w-md">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button 
          onClick={fetchBookings}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Bookings Management</h1>
            <p className="text-gray-600 mt-1">View and manage all bookings</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
            <div className="relative flex-grow max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search bookings..."
                className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            
            <CreateBooking onBookingCreated={handleNewBooking} />
          </div>
        </div>

        <div className="bg-white shadow-xl rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-800">
                <tr>
                  {[
                    "Ref No", "Passenger", "Agent", "Team", "PNR", "Airline", 
                    "Route", "Type", "Status", "Pc Date", "Issued", "Payment", 
                    "Last Payment", "Revenue", "Cost", "Fee", "Surcharge", 
                    "Received", "Balance", "Profit", "Invoiced", "Actions"
                  ].map((header) => (
                    <th 
                      key={header}
                      className="px-4 py-3 text-left text-xs font-semibold text-gray-100 uppercase tracking-wider"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => (
                    <tr 
                      key={booking.id} 
                      className="hover:bg-gray-50 transition-colors duration-150"
                    >
                      {editingId === booking.id ? (
                        <>
                          {/* Editable Fields */}
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="refNo"
                              value={editFormData.refNo}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="paxName"
                              value={editFormData.paxName}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="agentName"
                              value={editFormData.agentName}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="teamName"
                              value={editFormData.teamName || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="pnr"
                              value={editFormData.pnr}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm font-mono"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="airline"
                              value={editFormData.airline}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="fromTo"
                              value={editFormData.fromTo}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <select
                              name="bookingType"
                              value={editFormData.bookingType}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            >
                              <option value="Flight">Flight</option>
                              <option value="Hotel">Hotel</option>
                              <option value="Package">Package</option>
                              <option value="Other">Other</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <select
                              name="bookingStatus"
                              value={editFormData.bookingStatus}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            >
                              <option value="Confirmed">Confirmed</option>
                              <option value="Pending">Pending</option>
                              <option value="Cancelled">Cancelled</option>
                            </select>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="date"
                              name="pcDate"
                              value={editFormData.pcDate}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="date"
                              name="issuedDate"
                              value={editFormData.issuedDate || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="text"
                              name="paymentMethod"
                              value={editFormData.paymentMethod}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="date"
                              name="lastPaymentDate"
                              value={editFormData.lastPaymentDate || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="revenue"
                              value={editFormData.revenue || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="prodCost"
                              value={editFormData.prodCost || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="transFee"
                              value={editFormData.transFee || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="surcharge"
                              value={editFormData.surcharge || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="received"
                              value={editFormData.received || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="balance"
                              value={editFormData.balance || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="number"
                              name="profit"
                              value={editFormData.profit || ''}
                              onChange={handleEditFormChange}
                              className="w-full px-2 py-1 border rounded text-sm"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <input
                              type="checkbox"
                              name="invoiced"
                              checked={editFormData.invoiced || false}
                              onChange={handleEditFormChange}
                              className="h-4 w-4"
                            />
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <div className="flex space-x-2">
                              <button
                                onClick={() => handleSaveClick(booking.id)}
                                className="text-green-600 hover:text-green-900"
                              >
                                Save
                              </button>
                              <button
                                onClick={handleCancelClick}
                                className="text-red-600 hover:text-red-900"
                              >
                                Cancel
                              </button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* Read-only Fields */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                            {booking.refNo}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.paxName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.agentName}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {booking.teamName || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">
                            {booking.pnr}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.airline}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.fromTo}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              booking.bookingType === 'Flight' ? 'bg-blue-100 text-blue-800' :
                              booking.bookingType === 'Hotel' ? 'bg-green-100 text-green-800' :
                              booking.bookingType === 'Package' ? 'bg-purple-100 text-purple-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {booking.bookingType}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <span className={`px-2 py-1 text-xs rounded-full ${
                              booking.bookingStatus === 'Confirmed' ? 'bg-green-100 text-green-800' :
                              booking.bookingStatus === 'Pending' ? 'bg-yellow-100 text-yellow-800' :
                              booking.bookingStatus === 'Cancelled' ? 'bg-red-100 text-red-800' :
                              'bg-gray-100 text-gray-800'
                            }`}>
                              {booking.bookingStatus}
                            </span>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {booking.pcDate}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {booking.issuedDate || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.paymentMethod}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                            {booking.lastPaymentDate || '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                            {booking.revenue ? `£${booking.revenue}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600">
                            {booking.prodCost ? `£${booking.prodCost}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.transFee ? `£${booking.transFee}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                            {booking.surcharge ? `£${booking.surcharge}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-600">
                            {booking.received ? `£${booking.received}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium ${
                            booking.balance > 0 ? 'text-red-600' : 'text-green-600'
                          }">
                            {booking.balance ? `£${Math.abs(booking.balance)}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-bold ${
                            booking.profit > 0 ? 'text-green-600' : 'text-red-600'
                          }">
                            {booking.profit ? `£${booking.profit}` : '-'}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm">
                            {booking.invoiced ? (
                              <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">Yes</span>
                            ) : (
                              <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">No</span>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium">
                            <button
                              onClick={() => handleEditClick(booking)}
                              className="text-blue-600 hover:text-blue-900"
                            >
                              Edit
                            </button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={22} className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <svg className="h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <h3 className="text-lg font-medium text-gray-700 mb-1">
                          {searchTerm ? 'No matching bookings found' : 'No bookings available'}
                        </h3>
                        <p className="text-gray-500 max-w-md">
                          {searchTerm ? 'Try adjusting your search query' : 'Create a new booking to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}