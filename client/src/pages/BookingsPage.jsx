import { useEffect, useState } from 'react';
import { FaSearch, FaPencilAlt, FaSave, FaTimesCircle, FaSpinner, FaExclamationTriangle, FaFolderOpen } from 'react-icons/fa';
import { getBookings, updateBooking } from '../api/api';

// A small, reusable input for the inline edit form
const EditCellInput = (props) => (
  <input {...props} className="w-full p-1 border border-blue-300 rounded-md shadow-sm text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-blue-50" />
);

// A small, reusable select for the inline edit form
const EditCellSelect = ({ children, ...props }) => (
  <select {...props} className="w-full p-1 border border-blue-300 rounded-md shadow-sm text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-blue-50">
    {children}
  </select>
);




export default function BookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
 

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '-';
    return dateString.split('T')[0];
  };

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

  const handleEditClick = (booking) => {
    setEditingId(booking.id);
    setEditFormData({
      ...booking,
      pcDate: booking.pcDate?.split('T')[0] || '',
      issuedDate: booking.issuedDate?.split('T')[0] || '',
      lastPaymentDate: booking.lastPaymentDate?.split('T')[0] || '',
      travelDate: booking.travelDate?.split('T')[0] || ''
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
      const {
        refNo,
        paxName,
        agentName,
        teamName,
        pnr,
        airline,
        fromTo,
        bookingType,
        bookingStatus,
        pcDate,
        issuedDate,
        paymentMethod,
        lastPaymentDate,
        supplier,
        revenue,
        prodCost,
        transFee,
        surcharge,
        received,
        balance,
        profit,
        invoiced,
        travelDate,
      } = editFormData;

      const updatedData = {
        refNo,
        paxName,
        agentName,
        teamName,
        pnr,
        airline,
        fromTo,
        bookingType,
        bookingStatus,
        pcDate: pcDate || null,
        issuedDate: issuedDate || null,
        paymentMethod,
        lastPaymentDate: lastPaymentDate || null,
        supplier: supplier || null,
        revenue: revenue ? parseFloat(revenue) : null,
        prodCost: prodCost ? parseFloat(prodCost) : null,
        transFee: transFee ? parseFloat(transFee) : null,
        surcharge: surcharge ? parseFloat(surcharge) : null,
        received: received ? parseFloat(received) : null,
        balance: balance ? parseFloat(balance) : null,
        profit: profit ? parseFloat(profit) : null,
        invoiced: invoiced || null,
        travelDate: travelDate || null,
      };

      await updateBooking(id, updatedData);
      setBookings(bookings.map(booking => 
        booking.id === id ? { ...booking, ...updatedData } : booking
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
      formatDateDisplay(booking.pcDate)?.toLowerCase().includes(searchLower) ||
      formatDateDisplay(booking.issuedDate)?.toLowerCase().includes(searchLower) ||
      booking.paymentMethod?.toLowerCase().includes(searchLower) ||
      formatDateDisplay(booking.lastPaymentDate)?.toLowerCase().includes(searchLower)
    );
  });

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <FaSpinner className="animate-spin text-blue-500 h-10 w-10 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700">Loading Bookings...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Confirmed Bookings</h1>
          <p className="text-gray-600 mt-1">View and manage all confirmed bookings.</p>
        </div>

        <div className="relative mb-6 w-full max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <FaSearch className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search all fields..."
            className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center shadow-sm">
                <FaExclamationTriangle className="mr-2"/> {error}
            </div>
        )}

        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-800">
                <tr>
                  {[ "Ref No", "Passenger", "Agent", "Team", "PNR", "Airline", "Route", "Type", "Status", "PC Date", "Travel Date", "Issued", "Payment", "Last Payment", "Revenue", "Cost", "Fee", "Surcharge", "Received", "Balance", "Profit", "Invoiced", "Actions" ].map((header) => (
                    <th key={header} scope="col" className={`px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider sticky top-0 z-20 ${ header === 'Ref No' ? 'left-0 z-30' : header === 'Actions' ? 'right-0 z-30' : '' } bg-gray-800`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => (
                    <tr key={booking.id} className={`${editingId === booking.id ? 'bg-blue-50' : 'hover:bg-gray-50'} transition-colors duration-150`}>
                      {editingId === booking.id ? (
                        <>
                          {/* --- EDIT MODE CELLS --- */}
                          <td className="px-2 py-2 whitespace-nowrap sticky left-0 z-10 bg-blue-50"><EditCellInput name="refNo" value={editFormData.refNo} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput name="paxName" value={editFormData.paxName} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput name="agentName" value={editFormData.agentName} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellSelect name="teamName" value={editFormData.teamName || ''} onChange={handleEditFormChange}><option value="PH">PH</option><option value="TOURS">TOURS</option></EditCellSelect></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput name="pnr" value={editFormData.pnr} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput name="airline" value={editFormData.airline} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput name="fromTo" value={editFormData.fromTo} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellSelect name="bookingType" value={editFormData.bookingType} onChange={handleEditFormChange}><option value="FRESH">FRESH</option><option value="DATE_CHANGE">DATE_CHANGE</option><option value="CANCELLATION">CANCELLATION</option></EditCellSelect></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellSelect name="bookingStatus" value={editFormData.bookingStatus} onChange={handleEditFormChange}><option value="PENDING">PENDING</option><option value="CONFIRMED">CONFIRMED</option><option value="COMPLETED">COMPLETED</option></EditCellSelect></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="date" name="pcDate" value={editFormData.pcDate} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="date" name="travelDate" value={editFormData.travelDate} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="date" name="issuedDate" value={editFormData.issuedDate} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellSelect name="paymentMethod" value={editFormData.paymentMethod} onChange={handleEditFormChange}><option value="FULL">FULL</option><option value="INTERNAL">INTERNAL</option><option value="REFUND">REFUND</option><option value="FULL_HUMM">FULL_HUMM</option><option value="INTERNAL_HUMM">INTERNAL_HUMM</option></EditCellSelect></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="date" name="lastPaymentDate" value={editFormData.lastPaymentDate} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="revenue" value={editFormData.revenue || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="prodCost" value={editFormData.prodCost || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="transFee" value={editFormData.transFee || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="surcharge" value={editFormData.surcharge || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="received" value={editFormData.received || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="balance" value={editFormData.balance || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput type="number" step="0.01" name="profit" value={editFormData.profit || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap"><EditCellInput name="invoiced" value={editFormData.invoiced || ''} onChange={handleEditFormChange} /></td>
                          <td className="px-2 py-2 whitespace-nowrap sticky right-0 z-10 bg-blue-50">
                            <div className="flex items-center space-x-3">
                              <button onClick={() => handleSaveClick(booking.id)} title="Save" className="p-2 text-green-600 hover:text-green-800"><FaSave size={16} /></button>
                              <button onClick={handleCancelClick} title="Cancel" className="p-2 text-red-600 hover:text-red-800"><FaTimesCircle size={16} /></button>
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          {/* --- VIEW MODE CELLS --- */}
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-blue-600 sticky left-0 z-10 bg-white hover:bg-gray-50">{booking.refNo}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-800">{booking.paxName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.agentName}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{booking.teamName || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-mono text-gray-700">{booking.pnr}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.airline}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.fromTo}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs"><span className={`px-2 py-1 font-semibold leading-tight rounded-full ${ booking.bookingType === 'FRESH' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800' }`}>{booking.bookingType}</span></td>
                          <td className="px-4 py-3 whitespace-nowrap text-xs"><span className={`px-2 py-1 font-semibold leading-tight rounded-full ${ booking.bookingStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : booking.bookingStatus === 'CONFIRMED' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800' }`}>{booking.bookingStatus}</span></td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDateDisplay(booking.pcDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDateDisplay(booking.travelDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDateDisplay(booking.issuedDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.paymentMethod?.replace(/_/g, ' ')}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{formatDateDisplay(booking.lastPaymentDate)}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-700">{booking.revenue ? `£${parseFloat(booking.revenue).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-red-700">{booking.prodCost ? `£${parseFloat(booking.prodCost).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.transFee ? `£${parseFloat(booking.transFee).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.surcharge ? `£${parseFloat(booking.surcharge).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-green-700">{booking.received ? `£${parseFloat(booking.received).toFixed(2)}` : '—'}</td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${parseFloat(booking.balance) > 0 ? 'text-red-700' : 'text-green-700'}`}>{booking.balance != null ? `£${parseFloat(booking.balance).toFixed(2)}` : '—'}</td>
                          <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${parseFloat(booking.profit) > 0 ? 'text-green-700' : 'text-red-700'}`}>{booking.profit != null ? `£${parseFloat(booking.profit).toFixed(2)}` : '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">{booking.invoiced || '—'}</td>
                          <td className="px-4 py-3 whitespace-nowrap text-center text-sm sticky right-0 z-10 bg-white hover:bg-gray-50">
                            <button onClick={() => handleEditClick(booking)} title="Edit Booking" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"><FaPencilAlt /></button>
                          </td>
                        </>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="23" className="px-6 py-16 text-center">
                      <FaFolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-gray-800">
                        {searchTerm ? 'No Matching Bookings Found' : 'No Bookings Available'}
                      </h3>
                      <p className="text-gray-500 mt-2">
                        {searchTerm ? 'Try a different search term.' : 'Confirmed bookings will appear here.'}
                      </p>
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