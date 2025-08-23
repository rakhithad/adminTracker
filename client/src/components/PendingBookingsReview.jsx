import React, { useState, useEffect } from 'react';
import { FaEye, FaPencilAlt, FaCheck, FaTimes, FaSpinner, FaExclamationTriangle, FaInfoCircle, FaFolderOpen, FaHistory } from 'react-icons/fa';
import { getPendingBookings, approveBooking, rejectBooking, updatePendingBooking, getAuditHistory } from '../api/api';

// Reusable input component for the Edit Form
const EditInput = ({ label, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <input {...props} className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition" />
  </div>
);

// Reusable select component for the Edit Form
const EditSelect = ({ label, children, ...props }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700">{label}</label>
    <select {...props} className="mt-1 p-2 w-full border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 transition bg-white">
      {children}
    </select>
  </div>
);

// Reusable component for the Details View
const DetailItem = ({ label, children, className = '' }) => (
  <div className={`p-2 rounded-md ${className}`}>
    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</p>
    <p className="text-sm text-gray-800 mt-1">{children || 'N/A'}</p>
  </div>
);

const HistoryItem = ({ log }) => {
    let message = 'performed an unknown action.';
    const formattedDate = new Date(log.createdAt).toLocaleString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    switch(log.action) {
        case 'CREATE':
            message = 'created this pending booking.';
            break;
        case 'UPDATE':
            message = `updated field '${log.fieldName}' from '${log.oldValue}' to '${log.newValue}'.`;
            break;
        case 'APPROVE_PENDING':
            message = 'approved this booking.';
            break;
        case 'REJECT_PENDING':
            message = 'rejected this booking.';
            break;
        default:
            message = `performed action: ${log.action}`;
    }

    return (
        <li className="flex items-start space-x-3 py-2 border-b border-gray-200 last:border-b-0">
            <div className="flex-shrink-0 h-5 w-5 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs font-bold">
                {log.user.firstName.charAt(0)}
            </div>
            <div>
                <p className="text-sm text-gray-800">
                    <span className="font-semibold">{log.user.firstName}</span> {message}
                </p>
                <p className="text-xs text-gray-500">{formattedDate}</p>
            </div>
        </li>
    );
};


export default function PendingBookingsReview({ searchTerm = '', refreshKey }) {
  const [pendingBookings, setPendingBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState(''); // For specific action errors
  const [selectedBookingId, setSelectedBookingId] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [editForm, setEditForm] = useState(null);
  const [auditHistory, setAuditHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const fetchPendingBookings = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getPendingBookings();
      setPendingBookings(response.data.data || []);
    } catch (err) {
      setError('Failed to load pending bookings.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPendingBookings();
  }, [refreshKey]);

  useEffect(() => {
    const fetchAuditHistory = async () => {
        if (selectedBookingId && !editMode) {
            try {
                setLoadingHistory(true);
                const response = await getAuditHistory('PendingBooking', selectedBookingId);

                // ==========================================================
                // == DEBUGGING STEP: Log the response to see its shape    ==
                // ==========================================================
                console.log("Audit History API Response:", response.data); 

                setAuditHistory(response.data.data || []); // This is the line we are testing
            } catch (err) {
                console.error("Failed to fetch audit history", err);
                setAuditHistory([]);
            } finally {
                setLoadingHistory(false);
            }
        } else {
            setAuditHistory([]);
        }
    };

    fetchAuditHistory();
}, [selectedBookingId, editMode]);

  const handleAction = async (action, bookingId, successMessage) => {
    try {
      setActionError('');
      await action(bookingId);
      setPendingBookings(prev => prev.filter(b => b.id !== bookingId));
      if (selectedBookingId === bookingId) {
        setSelectedBookingId(null);
        setEditMode(false);
      }
      // Optionally show a success toast/message here
    } catch (err) {
      setActionError(`Failed to ${successMessage} booking. Please try again.`);
      console.error(err);
    }
  };

  const handleApprove = (bookingId) => handleAction(approveBooking, bookingId, 'approve');
  const handleReject = (bookingId) => handleAction(rejectBooking, bookingId, 'reject');
  
  const viewDetails = (bookingId) => {
    setSelectedBookingId(prevId => (prevId === bookingId && !editMode ? null : bookingId));
    setEditMode(false);
  };

  const startEdit = (booking) => {
    setSelectedBookingId(booking.id);
    setEditMode(true);
    setEditForm({
      id: booking.id,
      refNo: booking.refNo || '', paxName: booking.paxName || '', agentName: booking.agentName || '', pnr: booking.pnr || '', airline: booking.airline || '', fromTo: booking.fromTo || '',
      travelDate: booking.travelDate ? new Date(booking.travelDate).toISOString().split('T')[0] : '',
      revenue: booking.revenue ? parseFloat(booking.revenue).toFixed(2) : '',
      teamName: booking.teamName || '', bookingType: booking.bookingType || 'FRESH', paymentMethod: booking.paymentMethod || 'FULL',
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
    setActionError('');
    try {
      const { id, ...formData } = editForm;
      const updatedData = {
          ...formData,
          travelDate: formData.travelDate ? new Date(formData.travelDate).toISOString() : null,
          revenue: formData.revenue ? parseFloat(formData.revenue) : null,
          pcDate: formData.pcDate ? new Date(formData.pcDate).toISOString() : null,
          issuedDate: formData.issuedDate ? new Date(formData.issuedDate).toISOString() : null,
          lastPaymentDate: formData.lastPaymentDate ? new Date(formData.lastPaymentDate).toISOString() : null,
      };

      await updatePendingBooking(id, updatedData);
      await fetchPendingBookings();
      setEditMode(false);
      setSelectedBookingId(null);
    } catch (err) {
      setActionError('Failed to update booking: ' + (err.response?.data?.message || err.message));
      console.error(err);
    }
  };
  
  const cancelEdit = () => {
    setEditMode(false);
    setSelectedBookingId(null);
    setActionError('');
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return null;
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const filteredBookings = pendingBookings.filter(booking => {
    const searchLower = searchTerm.toLowerCase();
    return Object.values(booking).some(value => 
        String(value).toLowerCase().includes(searchLower)
    );
  });
  
  const selectedBooking = pendingBookings.find(b => b.id === selectedBookingId);

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="text-center">
        <FaSpinner className="animate-spin text-blue-500 h-10 w-10 mx-auto mb-4" />
        <p className="text-lg font-medium text-gray-700">Loading pending bookings...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center py-12 text-center">
      <div>
        <FaExclamationTriangle className="text-red-400 h-10 w-10 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={fetchPendingBookings} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
          Retry
        </button>
      </div>
    </div>
  );
  

    return (
    <div className="w-full">
      {actionError && (
        <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center">
            <FaInfoCircle className="mr-2"/> {actionError}
        </div>
      )}
      {filteredBookings.length > 0 ? (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Folder / Ref No / PNR</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Passenger / Agent</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Route / Travel Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase tracking-wider">Revenue (£)</th>
                <th scope="col" className="px-6 py-3 text-center text-xs font-bold text-gray-600 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredBookings.map(booking => (
                <React.Fragment key={booking.id}>
                  <tr className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                        {booking.folderNo && <div className="text-sm font-bold text-blue-600">Folder: {booking.folderNo}</div>}
                        <div className="text-sm font-medium text-gray-900">{booking.refNo}</div>
                        <div className="text-xs text-gray-500">{booking.pnr}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{booking.paxName}</div>
                        <div className="text-xs text-gray-500">{booking.agentName} ({booking.teamName})</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{booking.fromTo}</div>
                        <div className="text-xs text-gray-500">{formatDate(booking.travelDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">
                      {booking.revenue ? parseFloat(booking.revenue).toFixed(2) : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">
                      <div className="flex items-center justify-center space-x-2">
                          <button onClick={() => viewDetails(booking.id)} title="View Details" className="p-2 text-blue-600 hover:bg-blue-100 rounded-full transition"><FaEye /></button>
                          <button onClick={() => startEdit(booking)} title="Edit" className="p-2 text-yellow-600 hover:bg-yellow-100 rounded-full transition"><FaPencilAlt /></button>
                          <button onClick={() => handleApprove(booking.id)} title="Approve" className="p-2 text-green-600 hover:bg-green-100 rounded-full transition"><FaCheck /></button>
                          <button onClick={() => handleReject(booking.id)} title="Reject" className="p-2 text-red-600 hover:bg-red-100 rounded-full transition"><FaTimes /></button>
                      </div>
                    </td>
                  </tr>
                  {selectedBookingId === booking.id && (
                    <tr>
                      <td colSpan="5" className="p-0">
                        <div className="bg-gray-50 p-4 md:p-6">
                        {editMode && editForm ? (
                            // --- EDIT FORM (UNCHANGED) ---
                            <form onSubmit={handleEditSubmit} className="space-y-6">
                                <h3 className="text-xl font-bold text-gray-800">Editing Booking: <span className="text-blue-600">{editForm.refNo}</span></h3>
                                {actionError && <div className="p-3 bg-red-100 text-red-700 rounded-lg">{actionError}</div>}
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                    <EditInput label="Reference No" name="refNo" value={editForm.refNo} onChange={handleEditChange} required />
                                    <EditInput label="Passenger Name" name="paxName" value={editForm.paxName} onChange={handleEditChange} required />
                                    <EditInput label="Agent Name" name="agentName" value={editForm.agentName} onChange={handleEditChange} required />
                                    <EditInput label="PNR" name="pnr" value={editForm.pnr} onChange={handleEditChange} required />
                                    <EditInput label="Airline" name="airline" value={editForm.airline} onChange={handleEditChange} required />
                                    <EditInput label="From/To" name="fromTo" value={editForm.fromTo} onChange={handleEditChange} required />
                                    <EditInput label="Travel Date" name="travelDate" type="date" value={editForm.travelDate} onChange={handleEditChange} />
                                    <EditInput label="Revenue (£)" name="revenue" type="number" step="0.01" value={editForm.revenue} onChange={handleEditChange} />
                                    <EditSelect label="Team" name="teamName" value={editForm.teamName} onChange={handleEditChange}><option value="PH">PH</option><option value="TOURS">TOURS</option></EditSelect>
                                    <EditSelect label="Booking Type" name="bookingType" value={editForm.bookingType} onChange={handleEditChange} required><option value="FRESH">FRESH</option><option value="DATE_CHANGE">DATE_CHANGE</option><option value="CANCELLATION">CANCELLATION</option></EditSelect>
                                    <EditSelect label="Payment Method" name="paymentMethod" value={editForm.paymentMethod} onChange={handleEditChange} required><option value="FULL">FULL</option><option value="INTERNAL">INTERNAL</option><option value="REFUND">REFUND</option><option value="FULL_HUMM">FULL_HUMM</option><option value="INTERNAL_HUMM">INTERNAL_HUMM</option></EditSelect>
                                    <EditInput label="PC Date" name="pcDate" type="date" value={editForm.pcDate} onChange={handleEditChange} required />
                                </div>
                                <div className="flex items-center space-x-3 pt-4 border-t">
                                    <button type="submit" className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition">Save Changes</button>
                                    <button type="button" onClick={cancelEdit} className="px-5 py-2 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition">Cancel</button>
                                </div>
                            </form>
                        ) : (
                            // --- NEW DETAILS VIEW with AUDIT LOG ---
                            <div className="flex flex-col md:flex-row gap-6">
                                
                                {/* Left Column: Booking Details */}
                                <div className="flex-grow">
                                    <h3 className="text-xl font-bold text-gray-800 mb-4">
                                        Full Details: <span className="text-blue-600">{selectedBooking.refNo}</span>
                                    </h3>
                                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                        <DetailItem label="Status">{selectedBooking.status}</DetailItem>
                                        <DetailItem label="Booking Type">{selectedBooking.bookingType}</DetailItem>
                                        <DetailItem label="PC Date">{formatDate(selectedBooking.pcDate)}</DetailItem>
                                        <DetailItem label="Issued Date">{formatDate(selectedBooking.issuedDate)}</DetailItem>
                                        <DetailItem label="Payment Method">{selectedBooking.paymentMethod?.replace(/_/g, ' ')}</DetailItem>
                                        <DetailItem label="Last Payment Date">{formatDate(selectedBooking.lastPaymentDate)}</DetailItem>
                                        <DetailItem label="Transaction Fee">£{parseFloat(selectedBooking.transFee || 0).toFixed(2)}</DetailItem>
                                        <DetailItem label="Surcharge">£{parseFloat(selectedBooking.surcharge || 0).toFixed(2)}</DetailItem>
                                        <DetailItem label="Amount Received">£{parseFloat(selectedBooking.received || 0).toFixed(2)}</DetailItem>
                                        <DetailItem label="Balance">£{parseFloat(selectedBooking.balance || 0).toFixed(2)}</DetailItem>
                                        <DetailItem label="Profit">£{parseFloat(selectedBooking.profit || 0).toFixed(2)}</DetailItem>
                                        <DetailItem label="Invoiced">{selectedBooking.invoiced}</DetailItem>
                                        <DetailItem label="Cost Breakdown" className="col-span-2">
                                            {selectedBooking.costItems?.length > 0 ? (
                                                <ul className="list-disc list-inside text-sm space-y-1">
                                                    {selectedBooking.costItems.map(item => <li key={item.id}>{item.category}: £{parseFloat(item.amount).toFixed(2)}</li>)}
                                                </ul>
                                            ) : 'None'}
                                        </DetailItem>
                                        <DetailItem label="Instalments" className="col-span-2">
                                            {selectedBooking.instalments?.length > 0 ? (
                                                <ul className="list-disc list-inside text-sm space-y-1">
                                                    {selectedBooking.instalments.map((inst, i) => <li key={i}>Due {formatDate(inst.dueDate)} - £{parseFloat(inst.amount).toFixed(2)} ({inst.status})</li>)}
                                                </ul>
                                            ) : 'None'}
                                        </DetailItem>
                                        <DetailItem label="Submitted At" className="col-span-full">{new Date(selectedBooking.createdAt).toLocaleString('en-GB')}</DetailItem>
                                    </div>
                                </div>
                                
                                {/* Right Column: Audit History */}
                                <div className="w-full md:w-1/3 md:max-w-sm flex-shrink-0 border-t md:border-t-0 md:border-l border-gray-200 pt-4 md:pt-0 md:pl-6">
                                    <h4 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                                        <FaHistory className="mr-2 text-blue-500" />
                                        Booking History
                                    </h4>
                                    {loadingHistory ? (
                                        <div className="flex items-center text-gray-500">
                                            <FaSpinner className="animate-spin mr-2" /> Loading history...
                                        </div>
                                    ) : auditHistory.length > 0 ? (
                                        <ul className="space-y-2">
                                            {auditHistory.map(log => <HistoryItem key={log.id} log={log} />)}
                                        </ul>
                                    ) : (
                                        <p className="text-sm text-gray-500">No history found.</p>
                                    )}
                                </div>
                            </div>
                        )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-16">
          <FaFolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-xl font-medium text-gray-800">
            {searchTerm ? 'No Matching Bookings Found' : 'No Pending Bookings'}
          </h3>
          <p className="text-gray-500 mt-2">
            {searchTerm ? 'Try a different search term.' : 'New bookings awaiting approval will appear here.'}
          </p>
        </div>
      )}
    </div>
  );
}