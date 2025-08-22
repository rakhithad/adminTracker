import React, { useState, useEffect, useMemo } from 'react';
import { 
  FaSearch, 
  FaSpinner, 
  FaExclamationTriangle, 
  FaFolderOpen, 
  FaSort, 
  FaSortUp, 
  FaSortDown,
  FaChevronRight,
  FaChevronDown,
  FaFileInvoiceDollar,
  FaHandHoldingUsd,
  FaReceipt
} from 'react-icons/fa';
import { getBookings } from '../api/api';
import BookingDetailsPopup from '../components/BookingDetailsPopup';

const compareFolderNumbers = (a, b) => {
  if (!a || !b) return 0;
  const partsA = a.toString().split('.').map(part => parseInt(part, 10));
  const partsB = b.toString().split('.').map(part => parseInt(part, 10));

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
  const [showVoided, setShowVoided] = useState(false);
  
  const [sortConfig, setSortConfig] = useState({ key: 'folderNo', direction: 'descending' });

  const toggleExpandRow = (bookingId) => {
    setExpandedRows(prev => ({
      ...prev,
      [bookingId]: !prev[bookingId],
    }));
  };

  const formatDateDisplay = (dateString) => {
    if (!dateString) return '—';
    return new Date(dateString).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
    const initialList = showVoided 
        ? allBookings 
        : allBookings.filter(b => b.bookingStatus !== 'VOID');

    if (!initialList.length) return [];

    const bookingMap = new Map();
    const rootBookings = [];

    initialList.forEach(booking => {
      bookingMap.set(booking.id, { ...booking, children: [] });
    });

    initialList.forEach(booking => {
      const bookingNode = bookingMap.get(booking.id);
      const parentId = bookingNode.originalBookingId;
      if (parentId && bookingMap.has(parentId)) {
        bookingMap.get(parentId).children.push(bookingNode);
      } else {
        rootBookings.push(bookingNode);
      }
    });
    
    rootBookings.forEach(root => {
        if (root.cancellation) {
            root.children.push({ ...root.cancellation, isCancellation: true });
        }
        root.children.sort((a, b) => compareFolderNumbers(a.folderNo, b.folderNo));
    });

    if (sortConfig.key) {
      rootBookings.sort((a, b) => {
        let valA = a[sortConfig.key];
        let valB = b[sortConfig.key];
        let comparison = 0;
        
        if (sortConfig.key === 'folderNo') {
          comparison = compareFolderNumbers(valA, valB);
        } else if (['revenue', 'balance', 'profit'].includes(sortConfig.key)) {
          comparison = (parseFloat(valA) || 0) - (parseFloat(valB) || 0);
        } else if (sortConfig.key === 'travelDate') {
          comparison = (new Date(valA).getTime() || 0) - (new Date(valB).getTime() || 0);
        } else {
          comparison = String(valA || '').localeCompare(String(valB || ''));
        }
        
        return sortConfig.direction === 'descending' ? -comparison : comparison;
      });
    }

    return rootBookings;
  }, [allBookings, sortConfig, showVoided]);

  const filteredBookings = useMemo(() => {
    if (!searchTerm) return groupedAndSortedBookings;
    const searchLower = searchTerm.toLowerCase();
    
    return groupedAndSortedBookings.filter(booking => {
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
  }, [groupedAndSortedBookings, searchTerm]);


  const handleSort = (key) => {
    let direction = 'ascending';
    if (sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };
  
  const getSortIcon = (key) => {
    if (sortConfig.key !== key) {
      return <FaSort className="inline ml-1 text-slate-400 opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? 
      <FaSortUp className="inline ml-1 text-white" /> : 
      <FaSortDown className="inline ml-1 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-100">
        <FaSpinner className="animate-spin text-blue-500 h-10 w-10" />
      </div>
    );
  }

  const SortableHeader = ({ sortKey, title, className = '' }) => (
    <th 
      scope="col" 
      className={`px-4 py-3.5 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer select-none transition-colors hover:bg-slate-700 ${className}`}
      onClick={() => handleSort(sortKey)}
    >
      {title} {getSortIcon(sortKey)}
    </th>
  );
  
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800';
      case 'CONFIRMED': return 'bg-yellow-100 text-yellow-800';
      case 'CANCELLED': return 'bg-red-100 text-red-800';
      case 'VOID': return 'bg-gray-200 text-gray-700 border border-gray-400';
      default: return 'bg-slate-200 text-slate-800';
    }
  }

  const getRefundStatusBadgeStyle = (status) => {
    switch (status) {
      case 'PAID': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-orange-100 text-orange-800';
      case 'N/A': return 'bg-slate-200 text-slate-800';
      default: return 'bg-slate-200 text-slate-800';
    }
  }

    return (
    <div className="min-h-screen bg-slate-100 p-4 md:p-8">
      <div className="max-w-full mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold text-slate-900">Bookings</h1>
          <p className="text-slate-600 mt-1">View and manage all client bookings.</p>
        </header>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="relative w-full max-w-lg">
            <FaSearch className="absolute inset-y-0 left-3 h-full w-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by Folder, Ref, Passenger, Agent, PNR..."
              className="block w-full pl-10 pr-4 py-2.5 border border-slate-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
                type="checkbox"
                id="showVoided"
                checked={showVoided}
                onChange={(e) => setShowVoided(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="showVoided" className="text-sm font-medium text-slate-700 cursor-pointer">
                Show Voided Bookings
            </label>
          </div>
        </div>
        
        {error && <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg flex items-center gap-2"><FaExclamationTriangle />{error}</div>}
        
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-800">
                <tr>
                  <th scope="col" className="w-12 px-3 py-3.5"></th>
                  <SortableHeader sortKey="folderNo" title="Folder #" />
                  <SortableHeader sortKey="refNo" title="Reference No." />
                  <SortableHeader sortKey="paxName" title="Passenger" />
                  <SortableHeader sortKey="agentName" title="Agent" />
                  <SortableHeader sortKey="pnr" title="PNR" />
                  <SortableHeader sortKey="fromTo" title="Route" />
                  <SortableHeader sortKey="bookingStatus" title="Status" />
                  <SortableHeader sortKey="travelDate" title="Travel Date" />
                  <SortableHeader sortKey="revenue" title="Revenue" />
                  <SortableHeader sortKey="balance" title="Balance" />
                  <SortableHeader sortKey="profit" title="Profit" />
                </tr>
              </thead>
              <tbody className="bg-white">
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking) => {
                    const isCancelled = booking.bookingStatus === 'CANCELLED';
                    const isVoided = booking.bookingStatus === 'VOID';
                    const isClickable = !isCancelled && !isVoided;
                    
                    const rowClasses = isVoided
                      ? "bg-gray-100 text-gray-400 opacity-80"
                      : isCancelled 
                      ? "bg-red-50/50" 
                      : "hover:bg-slate-50 cursor-pointer";
                    
                    const isExpanded = expandedRows[booking.id];

                    return (
                      <React.Fragment key={booking.id}>
                        <tr 
                          className={`border-b border-slate-200 transition-colors duration-150 ${rowClasses}`}
                          onClick={() => isClickable && setSelectedBooking(booking)}
                        >
                          <td onClick={(e) => e.stopPropagation()} className="px-3 py-4 text-center align-middle">
                            {booking.children && booking.children.length > 0 && (
                              <button 
                                onClick={() => toggleExpandRow(booking.id)} 
                                className="p-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-slate-200 text-slate-500"
                                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                              >
                                {isExpanded ? <FaChevronDown className="h-3 w-3" /> : <FaChevronRight className="h-3 w-3" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold text-blue-600">{booking.folderNo}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-slate-500">{booking.refNo}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-slate-800">{booking.paxName}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{booking.agentName}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-slate-700">{booking.pnr}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600">{booking.fromTo}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-xs"><span className={`px-2 py-1 font-semibold rounded-full ${getStatusBadgeStyle(booking.bookingStatus)}`}>{booking.bookingStatus}</span></td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm ${isCancelled || isVoided ? 'text-slate-400' : 'text-slate-600'}`}>{formatDateDisplay(booking.travelDate)}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${isCancelled || isVoided ? 'text-slate-400' : 'text-green-700'}`}>{booking.revenue != null ? `£${parseFloat(booking.revenue).toFixed(2)}` : '—'}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${isCancelled || isVoided ? 'text-slate-400' : (parseFloat(booking.balance) > 0 ? 'text-red-700' : 'text-green-700')}`}>{booking.balance != null ? `£${parseFloat(booking.balance).toFixed(2)}` : '—'}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${isCancelled && booking.cancellation ? 'text-red-700' : isVoided ? 'text-slate-400' : (parseFloat(booking.profit) >= 0 ? 'text-green-700' : 'text-red-700')}`}>
                            {isCancelled && booking.cancellation ? `£${parseFloat(booking.cancellation.profitOrLoss).toFixed(2)}` : (booking.profit != null ? `£${parseFloat(booking.profit).toFixed(2)}` : '—')}
                          </td>
                        </tr>

                        {isExpanded && booking.children.map(child => (
                          child.isCancellation ? (
                            <tr key={`${booking.id}-cancel`} className="bg-rose-50 border-b-2 border-rose-200">
                               <td className="px-3 py-3"></td>
                               <td className="px-4 py-3 whitespace-nowrap font-bold text-rose-800 text-sm">↳ {child.folderNo}</td>
                               <td />
                               <td className="px-4 py-3 text-xs" colSpan="4">
                                   <div className="font-bold text-rose-900 mb-1">CANCELLATION DETAILS</div>
                                   <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-slate-700">
                                       <div className="flex items-center gap-1.5"><FaFileInvoiceDollar className="text-red-500"/>Supplier Fee: <span className="font-semibold">£{child.supplierCancellationFee.toFixed(2)}</span></div>
                                       <div className="flex items-center gap-1.5"><FaHandHoldingUsd className="text-blue-500"/>Admin Fee: <span className="font-semibold">£{child.adminFee.toFixed(2)}</span></div>
                                       <div className="flex items-center gap-1.5"><FaHandHoldingUsd className="text-green-500"/>Refund to Pax: <span className="font-semibold">£{child.refundToPassenger.toFixed(2)}</span></div>
                                       <div className="flex items-center gap-1.5"><FaReceipt className="text-purple-500"/>Credit Note: <span className="font-semibold">£{(child.creditNoteAmount || 0).toFixed(2)}</span></div>
                                   </div>
                               </td>
                               <td className="px-4 py-3 whitespace-nowrap text-xs">
                                   <span className={`px-2 py-1 font-semibold rounded-full ${getRefundStatusBadgeStyle(child.refundStatus)}`}>
                                       {child.refundStatus} REFUND
                                   </span>
                               </td>
                               <td className="px-4 py-3 text-center text-slate-400">—</td>
                               <td className="px-4 py-3 text-center text-slate-400">—</td>
                               <td className="px-4 py-3 text-center text-slate-400">—</td>
                               <td className={`px-4 py-3 whitespace-nowrap text-sm font-bold ${parseFloat(child.profitOrLoss) >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                                   £{child.profitOrLoss.toFixed(2)}
                               </td>
                           </tr>
                          ) : (
                            <tr key={child.id} className="bg-sky-50 text-xs border-b border-sky-200 hover:bg-sky-100 cursor-pointer" onClick={() => setSelectedBooking(child)}>
                                <td></td>
                                <td className="px-4 py-3 font-bold text-sky-800">↳ {child.folderNo}</td>
                                <td className="px-4 py-3 font-mono text-slate-500">{child.refNo}</td>
                                <td className="px-4 py-3 text-slate-800">{child.paxName}</td>
                                <td className="px-4 py-3 text-slate-600">{child.agentName}</td>
                                <td className="px-4 py-3 font-mono">{child.pnr}</td>
                                <td className="px-4 py-3">{child.fromTo}</td>
                                <td className="px-4 py-3"><span className={`px-2 py-1 font-semibold rounded-full text-xs ${getStatusBadgeStyle(child.bookingStatus)}`}>{child.bookingStatus}</span></td>
                                <td className="px-4 py-3 font-semibold">{formatDateDisplay(child.travelDate)}</td>
                                <td className="px-4 py-3 font-medium text-green-700">{child.revenue != null ? `£${parseFloat(child.revenue).toFixed(2)}` : '—'}</td>
                                <td className="px-4 py-3 font-medium text-red-700">{child.balance != null ? `£${parseFloat(child.balance).toFixed(2)}` : '—'}</td>
                                <td className="px-4 py-3 font-bold text-green-700">{child.profit != null ? `£${parseFloat(child.profit).toFixed(2)}` : '—'}</td>
                            </tr>
                          )
                        ))}
                      </React.Fragment>
                  )})
                ) : (
                  <tr>
                    <td colSpan="12" className="px-6 py-24 text-center">
                      <FaFolderOpen className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                      <h3 className="text-xl font-medium text-slate-800">{searchTerm ? 'No Matching Bookings Found' : 'No Bookings Available'}</h3>
                      <p className="text-slate-500 mt-2">{searchTerm ? 'Try a different search term.' : 'Bookings will appear here.'}</p>
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