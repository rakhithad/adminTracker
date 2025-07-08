import React from 'react';
import { useEffect, useState } from 'react';
import { FaSearch, FaSpinner, FaExclamationTriangle, FaFolderOpen } from 'react-icons/fa';
import { getBookings } from '../api/api';
import BookingDetailsPopup from '../components/BookingDetailsPopup';

export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});

  const toggleExpandRow = (bookingId) => {
    setExpandedRows(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB');
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      setError(null);
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

  const handleBookingUpdate = () => {
    setSelectedBooking(null);
    fetchBookings();
  };

  const filteredBookings = bookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    const inBooking = 
      booking.refNo?.toLowerCase().includes(searchLower) ||
      booking.paxName?.toLowerCase().includes(searchLower) ||
      booking.agentName?.toLowerCase().includes(searchLower) ||
      booking.pnr?.toLowerCase().includes(searchLower);
      
    const inCancellation = booking.cancellation?.description?.toLowerCase().includes(searchLower);
    return inBooking || inCancellation;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <FaSpinner className="animate-spin text-blue-500 h-10 w-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        {/* Header and other elements are fine */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-1">View and manage all bookings.</p>
        </div>
        <div className="relative mb-6 w-full max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FaSearch className="h-5 w-5 text-gray-400" /></div>
          <input
            type="text"
            placeholder="Search by Ref, Passenger, Agent, PNR..."
            className="block w-full pl-10 pr-4 py-2 border rounded-lg"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg"><FaExclamationTriangle className="inline mr-2"/>{error}</div>}
        
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-800">
                <tr>
                  <th scope="col" className="w-10 px-2 py-3"></th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">FolderNo</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Ref No</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Passenger</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Agent</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">PNR</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Airline</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Route</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Status</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Travel Date</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Revenue</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Balance</th>
                  <th scope="col" className="px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider">Profit</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => (
                    <React.Fragment key={booking.id}>
                      {/* --- MAIN ROW --- */}
                      <tr 
                        className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <td onClick={(e) => e.stopPropagation()} className="px-2 py-3 text-center align-middle">
                          {booking.cancellation && (
                            <button onClick={() => toggleExpandRow(booking.id)} className="p-1 w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-300 text-gray-500 font-bold">
                              {expandedRows[booking.id] ? '−' : '+'}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600">{booking.folderNo}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{booking.refNo}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{booking.paxName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.agentName}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">{booking.pnr}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.airline}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.fromTo}</td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs"><span className={`px-2 py-1 font-semibold rounded-full ${ booking.bookingType === 'FRESH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800' }`}>{booking.bookingType}</span></td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs"><span className={`px-2 py-1 font-semibold rounded-full ${ booking.bookingStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : booking.bookingStatus === 'CONFIRMED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800' }`}>{booking.bookingStatus}</span></td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm ${booking.cancellation ? 'text-gray-500 line-through' : 'text-gray-500'}`}>{formatDateDisplay(booking.travelDate)}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${booking.cancellation ? 'text-gray-500 line-through' : 'text-green-700'}`}>{booking.revenue ? `£${parseFloat(booking.revenue).toFixed(2)}` : '—'}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${booking.cancellation ? 'text-gray-500 line-through' : (parseFloat(booking.balance) > 0 ? 'text-red-700' : 'text-green-700')}`}>{booking.balance != null ? `£${parseFloat(booking.balance).toFixed(2)}` : '—'}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${booking.cancellation ? 'text-red-700' : (parseFloat(booking.profit) > 0 ? 'text-green-700' : 'text-red-700')}`}>
                          {booking.cancellation ? `£${parseFloat(booking.cancellation.profitOrLoss).toFixed(2)}` : (booking.profit != null ? `£${parseFloat(booking.profit).toFixed(2)}` : '—')}
                        </td>
                      </tr>

                      {/* --- SUB-ROW for CANCELLATION --- */}
                      {expandedRows[booking.id] && booking.cancellation && (
                        <tr key={`${booking.id}-cancel`} className="bg-red-50 text-xs">
                           <td></td> {/* Empty cell for alignment */}
                           <td className="px-4 py-2 whitespace-nowrap font-bold text-red-800">
                              ↳ {booking.cancellation.folderNo}
                           </td>
                           <td className="px-4 py-2 whitespace-nowrap text-red-800">{booking.refNo}-C</td>
                           <td className="px-4 py-2 whitespace-nowrap" colSpan="5">{booking.cancellation.description}</td>
                           <td className="px-4 py-2 whitespace-nowrap">CANCELLATION</td>
                           <td className="px-4 py-2 whitespace-nowrap">COMPLETED</td>
                           <td className="px-4 py-2 whitespace-nowrap">{formatDateDisplay(booking.cancellation.createdAt)}</td>
                           <td className="px-4 py-2 whitespace-nowrap font-medium text-green-700" colSpan="2">
                              Refund via: {booking.cancellation.refundTransactionMethod.replace(/_/g, ' ')}
                           </td>
                           <td className="px-4 py-2 whitespace-nowrap font-bold text-red-700">£{booking.cancellation.profitOrLoss.toFixed(2)}</td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                ) : (
                  <tr>
                    <td colSpan="14" className="px-6 py-16 text-center">
                      <FaFolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-gray-800">{searchTerm ? 'No Matching Bookings Found' : 'No Bookings Available'}</h3>
                      <p className="text-gray-500 mt-2">{searchTerm ? 'Try a different search term.' : 'Bookings will appear here.'}</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {selectedBooking && (
        <BookingDetailsPopup 
            booking={selectedBooking} 
            onClose={() => setSelectedBooking(null)}
            onSave={handleBookingUpdate}
        />
      )}
    </div>
  );
}