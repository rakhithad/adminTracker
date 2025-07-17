import React, { useState, useEffect, useMemo } from 'react';
import { FaSearch, FaSpinner, FaExclamationTriangle, FaFolderOpen, FaSort, FaSortUp, FaSortDown } from 'react-icons/fa';
import { getBookings } from '../api/api';
import BookingDetailsPopup from '../components/BookingDetailsPopup';

const compareFolderNumbers = (a, b) => {
  if (!a || !b) return 0;
  const partsA = a.split('.').map(part => parseInt(part, 10));
  const partsB = b.split('.').map(part => parseInt(part, 10));

  const mainA = partsA[0];
  const mainB = partsB[0];
  if (mainA !== mainB) {
    return mainA - mainB;
  }
  
  const subA = partsA.length > 1 ? partsA[1] : 0;
  const subB = partsB.length > 1 ? partsB[1] : 0;
  return subA - subB;
};

export default function BookingsPage() {
  const [allBookings, setAllBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [expandedRows, setExpandedRows] = useState({});
  const [sortConfig, setSortConfig] = useState({ key: 'travelDate', direction: 'descending' });

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
      setAllBookings(bookingsData);
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
  
  const groupedAndSortedBookings = useMemo(() => {
    if (!allBookings.length) return [];

    const bookingMap = new Map(allBookings.map(b => [b.id, { ...b, children: [] }]));
    let topLevelBookings = [];

    for (const booking of allBookings) {
      const parentId = booking.originalBookingId;
      if (parentId && bookingMap.has(parentId)) {
        bookingMap.get(parentId).children.push(booking);
      } else if (booking.cancellation) {
        const parent = bookingMap.get(booking.id);
        if(parent) {
          parent.children.push({ ...booking.cancellation, isCancellation: true });
        }
      }
    }

    for (const booking of bookingMap.values()) {
        if (!booking.originalBookingId) {
            booking.children.sort((a,b) => new Date(a.createdAt) - new Date(b.createdAt));
            topLevelBookings.push(booking);
        }
    }
    
    if (sortConfig.key) {
      topLevelBookings.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        let comparison = 0;
        
        if (sortConfig.key === 'folderNo') {
          comparison = compareFolderNumbers(valA, valB);
        } else if (['revenue', 'balance', 'profit'].includes(sortConfig.key)) {
          comparison = (parseFloat(valA) || 0) - (parseFloat(valB) || 0);
        } else if (sortConfig.key === 'travelDate') {
          // --- FIX APPLIED HERE ---
          // This correctly handles potentially invalid date strings
          const timeA = new Date(valA).getTime();
          const timeB = new Date(valB).getTime();
          const validTimeA = !isNaN(timeA) ? timeA : 0;
          const validTimeB = !isNaN(timeB) ? timeB : 0;
          comparison = validTimeA - validTimeB;
          // --- END FIX ---
        } else {
          // Default to locale-aware string comparison
          comparison = String(valA || '').localeCompare(String(valB || ''));
        }
        
        return sortConfig.direction === 'descending' ? -comparison : comparison;
      });
    }

    return topLevelBookings;
  }, [allBookings, sortConfig]);

  const filteredBookings = groupedAndSortedBookings.filter(booking => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    
    const inParent = 
      booking.folderNo?.toString().toLowerCase().includes(searchLower) ||
      booking.refNo?.toLowerCase().includes(searchLower) ||
      booking.paxName?.toLowerCase().includes(searchLower) ||
      booking.agentName?.toLowerCase().includes(searchLower) ||
      booking.pnr?.toLowerCase().includes(searchLower);

    if (inParent) return true;
      
    const inChildren = booking.children?.some(child => {
        if (child.isCancellation) {
            return child.description?.toLowerCase().includes(searchLower);
        }
        return (
            child.folderNo?.toString().toLowerCase().includes(searchLower) ||
            child.refNo?.toLowerCase().includes(searchLower) ||
            child.pnr?.toLowerCase().includes(searchLower)
        );
    });
    
    return inChildren;
  });

  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <FaSort className="inline ml-1 text-gray-400 opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? 
      <FaSortUp className="inline ml-1 text-white" /> : 
      <FaSortDown className="inline ml-1 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <FaSpinner className="animate-spin text-blue-500 h-10 w-10" />
      </div>
    );
  }

  const SortableHeader = ({ sortKey, title, className = '' }) => (
    <th 
      scope="col" 
      className={`px-4 py-3 text-left text-xs font-bold text-white uppercase tracking-wider cursor-pointer select-none transition-colors hover:bg-gray-700 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      {title} {getSortIcon(sortKey)}
    </th>
  );

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-1">View and manage all bookings.</p>
        </div>
        <div className="relative mb-6 w-full max-w-lg">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><FaSearch className="h-5 w-5 text-gray-400" /></div>
          <input
            type="text"
            placeholder="Search by Folder, Ref, Passenger, Agent, PNR..."
            className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                  <SortableHeader sortKey="folderNo" title="FolderNo" />
                  <SortableHeader sortKey="refNo" title="Ref No" />
                  <SortableHeader sortKey="paxName" title="Passenger" />
                  <SortableHeader sortKey="agentName" title="Agent" />
                  <SortableHeader sortKey="pnr" title="PNR" />
                  <SortableHeader sortKey="airline" title="Airline" />
                  <SortableHeader sortKey="fromTo" title="Route" />
                  <SortableHeader sortKey="bookingType" title="Type" />
                  <SortableHeader sortKey="bookingStatus" title="Status" />
                  <SortableHeader sortKey="travelDate" title="Travel Date" />
                  <SortableHeader sortKey="revenue" title="Revenue" />
                  <SortableHeader sortKey="balance" title="Balance" />
                  <SortableHeader sortKey="profit" title="Profit" />
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => (
                    <React.Fragment key={booking.id}>
                      <tr 
                        className="hover:bg-blue-50 cursor-pointer transition-colors duration-150"
                        onClick={() => setSelectedBooking(booking)}
                      >
                        <td onClick={(e) => e.stopPropagation()} className="px-2 py-3 text-center align-middle">
                          {booking.children && booking.children.length > 0 && (
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
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${booking.cancellation ? 'text-gray-500 line-through' : 'text-green-700'}`}>{booking.revenue != null ? `£${parseFloat(booking.revenue).toFixed(2)}` : '—'}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-medium ${booking.cancellation ? 'text-gray-500 line-through' : (parseFloat(booking.balance) > 0 ? 'text-red-700' : 'text-green-700')}`}>{booking.balance != null ? `£${parseFloat(booking.balance).toFixed(2)}` : '—'}</td>
                        <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${booking.cancellation ? 'text-red-700' : (parseFloat(booking.profit) > 0 ? 'text-green-700' : 'text-red-700')}`}>
                          {booking.cancellation ? `£${parseFloat(booking.cancellation.profitOrLoss).toFixed(2)}` : (booking.profit != null ? `£${parseFloat(booking.profit).toFixed(2)}` : '—')}
                        </td>
                      </tr>

                      {expandedRows[booking.id] && booking.children.map(child => (
                        child.isCancellation ? (
                          <tr key={`${child.id}-cancel`} className="bg-red-50 text-xs">
                             <td></td>
                             <td className="px-4 py-2 whitespace-nowrap font-bold text-red-800">↳ {child.folderNo}</td>
                             <td className="px-4 py-2 whitespace-nowrap text-red-800">{booking.refNo}-C</td>
                             <td className="px-4 py-2 whitespace-nowrap" colSpan="5">{child.description}</td>
                             <td className="px-4 py-2 whitespace-nowrap">CANCELLATION</td>
                             <td className="px-4 py-2 whitespace-nowrap">COMPLETED</td>
                             <td className="px-4 py-2 whitespace-nowrap">{formatDateDisplay(child.createdAt)}</td>
                             <td className="px-4 py-2 whitespace-nowrap font-medium text-green-700" colSpan="2">
                                Refund via: {child.refundTransactionMethod.replace(/_/g, ' ')}
                             </td>
                             <td className="px-4 py-2 whitespace-nowrap font-bold text-red-700">£{child.profitOrLoss.toFixed(2)}</td>
                          </tr>
                        ) : (
                          <tr key={child.id} className="bg-yellow-50 text-xs hover:bg-yellow-100 cursor-pointer" onClick={() => setSelectedBooking(child)}>
                              <td></td>
                              <td className="px-4 py-2 font-bold text-yellow-800">↳ {child.folderNo}</td>
                              <td className="px-4 py-2 text-gray-800">{child.refNo}</td>
                              <td className="px-4 py-2 text-gray-800">{child.paxName}</td>
                              <td className="px-4 py-2 text-gray-600">{child.agentName}</td>
                              <td className="px-4 py-2 font-mono">{child.pnr}</td>
                              <td className="px-4 py-2">{child.airline}</td>
                              <td className="px-4 py-2">{child.fromTo}</td>
                              <td className="px-4 py-2 font-semibold">DATE CHANGE</td>
                              <td className="px-4 py-2"><span className={`px-2 py-1 font-semibold rounded-full text-xs ${ child.bookingStatus === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800' }`}>{child.bookingStatus}</span></td>
                              <td className="px-4 py-2">{formatDateDisplay(child.travelDate)}</td>
                              <td className="px-4 py-2 font-medium text-green-700">{child.revenue != null ? `£${parseFloat(child.revenue).toFixed(2)}` : '—'}</td>
                              <td className="px-4 py-2 font-medium text-red-700">{child.balance != null ? `£${parseFloat(child.balance).toFixed(2)}` : '—'}</td>
                              <td className="px-4 py-2 font-bold text-green-700">{child.profit != null ? `£${parseFloat(child.profit).toFixed(2)}` : '—'}</td>
                          </tr>
                        )
                      ))}
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