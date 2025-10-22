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

// --- NEW COLOR PALETTE (from your brand) ---
const COLORS = {
  primaryBlue: '#2D3E50', // Dark blue from logo text
  secondaryBlue: '#0A738A', // Teal/water color from logo
  accentYellow: '#F2C144', // Sun/light from logo
  accentOrange: '#F08A4B', // Sunset orange from logo
  accentRed: '#E05B5B', // Deeper red from logo sunset
  lightGray: '#F9FAFB', // Page background
  mediumGray: '#EDF2F7', // Card/Table background
  darkGrayText: '#374151',
  successGreen: '#10B981',
  errorRed: '#EF4444',
};

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
      return <FaSort className="inline ml-1 text-gray-400 opacity-50" />;
    }
    return sortConfig.direction === 'ascending' ? 
      <FaSortUp className="inline ml-1 text-white" /> : 
      <FaSortDown className="inline ml-1 text-white" />;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ backgroundColor: COLORS.lightGray }}>
        <FaSpinner className="animate-spin h-10 w-10" style={{ color: COLORS.secondaryBlue }} />
      </div>
    );
  }

  const SortableHeader = ({ sortKey, title, className = '' }) => (
    <th 
      scope="col" 
      className={`px-4 py-3.5 text-left text-sm font-semibold text-white uppercase tracking-wider cursor-pointer select-none transition-colors ${className}`}
      style={{ '&:hover': { backgroundColor: '#1A2938' } }} // Darker shade of primaryBlue
      onClick={() => handleSort(sortKey)}
    >
      {title} {getSortIcon(sortKey)}
    </th>
  );
  
  // --- UPDATED BADGE STYLES ---
  const getStatusBadgeStyle = (status) => {
    switch (status) {
      case 'COMPLETED': return { backgroundColor: `${COLORS.successGreen}2A`, color: COLORS.successGreen };
      case 'CONFIRMED': return { backgroundColor: `${COLORS.accentYellow}2A`, color: '#D99B0A' }; // Darker yellow for text
      case 'CANCELLED': return { backgroundColor: `${COLORS.accentRed}2A`, color: COLORS.accentRed };
      case 'VOID': return { backgroundColor: '#E5E7EB', color: '#4B5563', border: '1px solid #9CA3AF' };
      default: return { backgroundColor: '#E5E7EB', color: '#4B5563' };
    }
  }

  const getRefundStatusBadgeStyle = (status) => {
    switch (status) {
      case 'PAID': return { backgroundColor: `${COLORS.successGreen}2A`, color: COLORS.successGreen };
      case 'PENDING': return { backgroundColor: `${COLORS.accentOrange}2A`, color: COLORS.accentOrange };
      case 'N/A': return { backgroundColor: '#E5E7EB', color: '#4B5563' };
      default: return { backgroundColor: '#E5E7EB', color: '#4B5563' };
    }
  }

    return (
    <div className="min-h-screen p-4 md:p-8" style={{ backgroundColor: COLORS.lightGray }}>
      <div className="max-w-full mx-auto">
        <header className="mb-6">
          <h1 className="text-3xl font-bold" style={{ color: COLORS.primaryBlue }}>Bookings</h1>
          <p className="text-gray-500 mt-1">View and manage all client bookings.</p>
        </header>

        {/* --- CONTROLS SECTION --- */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6 p-4 bg-white rounded-lg shadow border" style={{ borderColor: '#E5E7EB' }}>
          <div className="relative flex-grow max-w-lg">
            <FaSearch className="absolute inset-y-0 left-3 h-full w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by Folder, Ref, Passenger, Agent, PNR..."
              className="block w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 transition-shadow"
              style={{ '--tw-ring-color': COLORS.secondaryBlue }}
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
                className="h-4 w-4 rounded border-gray-300 focus:ring-0"
                style={{ color: COLORS.secondaryBlue }}
            />
            <label htmlFor="showVoided" className="text-sm font-medium" style={{ color: COLORS.darkGrayText }}>
                Show Voided Bookings
            </label>
          </div>
        </div>
        
        {error && <div className="mb-4 p-3 rounded-lg flex items-center gap-2" style={{ backgroundColor: `${COLORS.errorRed}1A`, color: COLORS.errorRed }}><FaExclamationTriangle />{error}</div>}
        
        {/* --- TABLE CONTAINER --- */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border" style={{ borderColor: '#E5E7EB' }}>
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead style={{ backgroundColor: COLORS.primaryBlue }}>
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
              <tbody>
                {filteredBookings.length > 0 ? (
                  filteredBookings.map((booking, index) => {
                    const isCancelled = booking.bookingStatus === 'CANCELLED';
                    const isVoided = booking.bookingStatus === 'VOID';
                    const isEven = index % 2 === 0;

                    // --- Action Required Logic ---
                    const hasMissingIssuedDate = !booking.issuedDate;
                    const hasMissingSuppliers = !booking.costItems || booking.costItems.length === 0 || booking.costItems.every(item => !item.suppliers || item.suppliers.length === 0);
                    const needsAttention = !isVoided && !isCancelled && (hasMissingIssuedDate || hasMissingSuppliers);
                    
                    let attentionTitle = '';
                    if(needsAttention) {
                        const reasons = [];
                        if (hasMissingIssuedDate) reasons.push('Missing Issued Date');
                        if (hasMissingSuppliers) reasons.push('Missing Supplier in Costs');
                        attentionTitle = `Action Required: ${reasons.join(' & ')}`;
                    }
                    
                    // --- Row Style Logic ---
                    let rowClasses = `border-b border-gray-200 transition-colors duration-150 ${!isVoided && 'cursor-pointer'}`;
                    let rowStyle = { backgroundColor: isEven ? '#FFFFFF' : '#F9FAFB' }; // Alternating colors
                    
                    if (isVoided) {
                      rowClasses = "bg-gray-100 text-gray-400 opacity-80 cursor-pointer hover:bg-gray-200";
                      rowStyle = {};
                    } else if (isCancelled) {
                      rowClasses = `border-b border-gray-200 transition-colors duration-150 cursor-pointer hover:bg-red-100`;
                      rowStyle = { backgroundColor: isEven ? '#FFF8F8' : '#FEF2F2' }; // Alternating light red
                    } else {
                      rowClasses += ' hover:bg-sky-100'; // Branded hover
                    }
                    
                    const isExpanded = expandedRows[booking.id];

                    return (
                      <React.Fragment key={booking.id}>
                        <tr 
                          className={rowClasses}
                          style={rowStyle}
                          onClick={() => !isVoided && setSelectedBooking(booking)}
                        >
                          <td onClick={(e) => e.stopPropagation()} className="px-3 py-4 text-center align-middle relative">
                            {needsAttention && (
                                <div 
                                    className="absolute left-1 top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full animate-pulse"
                                    style={{ backgroundColor: COLORS.errorRed }}
                                    title={attentionTitle}
                                ></div>
                            )}
                            {booking.children && booking.children.length > 0 && (
                              <button 
                                onClick={() => toggleExpandRow(booking.id)} 
                                className="p-1 w-7 h-7 flex items-center justify-center rounded-full hover:bg-gray-200 text-gray-500"
                                aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
                              >
                                {isExpanded ? <FaChevronDown className="h-3 w-3" /> : <FaChevronRight className="h-3 w-3" />}
                              </button>
                            )}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-bold" style={{ color: COLORS.secondaryBlue }}>{booking.folderNo}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-500">{booking.refNo}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-semibold text-gray-800">{booking.paxName}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{booking.agentName}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-mono text-gray-700">{booking.pnr}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-600">{booking.fromTo}</td>
                          <td className="px-4 py-4 whitespace-nowrap text-xs">
                            <span className="px-2 py-1 font-semibold rounded-full" style={getStatusBadgeStyle(booking.bookingStatus)}>
                              {booking.bookingStatus}
                            </span>
                          </td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm ${isCancelled || isVoided ? 'text-gray-400' : 'text-gray-600'}`}>{formatDateDisplay(booking.travelDate)}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${isCancelled || isVoided ? 'text-gray-400' : ''}`} style={{ color: !(isCancelled || isVoided) ? COLORS.successGreen : undefined }}>{booking.revenue != null ? `£${parseFloat(booking.revenue).toFixed(2)}` : '—'}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm font-medium ${isCancelled || isVoided ? 'text-gray-400' : ''}`} style={{ color: !(isCancelled || isVoided) ? (parseFloat(booking.balance) > 0 ? COLORS.errorRed : COLORS.successGreen) : undefined }}>{booking.balance != null ? `£${parseFloat(booking.balance).toFixed(2)}` : '—'}</td>
                          <td className={`px-4 py-4 whitespace-nowrap text-sm font-bold ${isCancelled && booking.cancellation ? '' : isVoided ? 'text-gray-400' : ''}`} style={{ color: isCancelled && booking.cancellation ? COLORS.errorRed : (isVoided ? undefined : (parseFloat(booking.profit) >= 0 ? COLORS.successGreen : COLORS.errorRed)) }}>
                            {isCancelled && booking.cancellation ? `£${parseFloat(booking.cancellation.profitOrLoss).toFixed(2)}` : (booking.profit != null ? `£${parseFloat(booking.profit).toFixed(2)}` : '—')}
                          </td>
                        </tr>

                        {isExpanded && booking.children.map(child => (
                          child.isCancellation ? (
                            <tr key={`${booking.id}-cancel`} className="border-b-2" style={{ backgroundColor: `${COLORS.accentRed}1A`, borderColor: `${COLORS.accentRed}3A` }}>
                                <td className="px-3 py-3"></td>
                                {/* --- INDENTED CELL --- */}
                                <td className="px-4 py-3 whitespace-nowrap font-bold text-sm" style={{ color: COLORS.accentRed, paddingLeft: '2.5rem' }}>↳ {child.folderNo}</td>
                                <td />
                                <td className="px-4 py-3 text-xs" colSpan="4">
                                    <div className="font-bold mb-1" style={{ color: COLORS.accentRed }}>CANCELLATION DETAILS</div>
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-gray-700">
                                        <div className="flex items-center gap-1.5"><FaFileInvoiceDollar className="text-red-500"/>Supplier Fee: <span className="font-semibold">£{child.supplierCancellationFee.toFixed(2)}</span></div>
                                        <div className="flex items-center gap-1.5"><FaHandHoldingUsd className="text-blue-500"/>Admin Fee: <span className="font-semibold">£{child.adminFee.toFixed(2)}</span></div>
                                        <div className="flex items-center gap-1.5"><FaHandHoldingUsd className="text-green-500"/>Refund to Pax: <span className="font-semibold">£{child.refundToPassenger.toFixed(2)}</span></div>
                                        <div className="flex items-center gap-1.5"><FaReceipt className="text-purple-500"/>Credit Note: <span className="font-semibold">£{(child.creditNoteAmount || 0).toFixed(2)}</span></div>
                                    </div>
                                </td>
                                <td className="px-4 py-3 whitespace-nowrap text-xs">
                                    <span className="px-2 py-1 font-semibold rounded-full" style={getRefundStatusBadgeStyle(child.refundStatus)}>
                                        {child.refundStatus} REFUND
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-center text-gray-400">—</td>
                                <td className="px-4 py-3 text-center text-gray-400">—</td>
                                <td className="px-4 py-3 text-center text-gray-400">—</td>
                                <td className="px-4 py-3 whitespace-nowrap text-sm font-bold" style={{ color: parseFloat(child.profitOrLoss) >= 0 ? COLORS.successGreen : COLORS.errorRed }}>
                                  £{child.profitOrLoss.toFixed(2)}
                                </td>
                            </tr>
                          ) : (
                            <tr key={child.id} className="text-xs border-b cursor-pointer" onClick={() => setSelectedBooking(child)} style={{ backgroundColor: `${COLORS.secondaryBlue}1A`, borderColor: `${COLORS.secondaryBlue}3A`, '&:hover': { backgroundColor: `${COLORS.secondaryBlue}2A` } }}>
                                <td></td>
                                {/* --- INDENTED CELL --- */}
                                <td className="px-4 py-3 font-bold" style={{ color: COLORS.secondaryBlue, paddingLeft: '2.5rem' }}>↳ {child.folderNo}</td>
                                <td className="px-4 py-3 font-mono text-gray-500">{child.refNo}</td>
                                <td className="px-4 py-3 text-gray-800">{child.paxName}</td>
                                <td className="px-4 py-3 text-gray-600">{child.agentName}</td>
                                <td className="px-4 py-3 font-mono">{child.pnr}</td>
                                <td className="px-4 py-3">{child.fromTo}</td>
                                <td className="px-4 py-3">
                                  <span className="px-2 py-1 font-semibold rounded-full text-xs" style={getStatusBadgeStyle(child.bookingStatus)}>
                                    {child.bookingStatus}
                                  </span>
                                </td>
                                <td className="px-4 py-3 font-semibold">{formatDateDisplay(child.travelDate)}</td>
                                <td className="px-4 py-3 font-medium" style={{ color: COLORS.successGreen }}>{child.revenue != null ? `£${parseFloat(child.revenue).toFixed(2)}` : '—'}</td>
                                <td className="px-4 py-3 font-medium" style={{ color: parseFloat(child.balance) > 0 ? COLORS.errorRed : COLORS.successGreen }}>{child.balance != null ? `£${parseFloat(child.balance).toFixed(2)}` : '—'}</td>
                                <td className="px-4 py-3 font-bold" style={{ color: parseFloat(child.profit) >= 0 ? COLORS.successGreen : COLORS.errorRed }}>{child.profit != null ? `£${parseFloat(child.profit).toFixed(2)}` : '—'}</td>
                            </tr>
                          )
                        ))}
                      </React.Fragment>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="12" className="px-6 py-24 text-center">
                      <FaFolderOpen className="h-16 w-16 mx-auto mb-4" style={{ color: COLORS.mediumGray }} />
                      <h3 className="text-xl font-medium" style={{ color: COLORS.primaryBlue }}>{searchTerm ? 'No Matching Bookings Found' : 'No Bookings Available'}</h3>
      
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