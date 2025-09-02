import React, { useState, useEffect, useMemo } from 'react';
import { getSuppliersInfo } from '../api/api'; // Adjust this path as necessary for your project
import SettlePaymentPopup from '../components/SettlePaymentPopup'; // Adjust this path
import CreditNoteDetailsPopup from '../components/CreditNoteDetailsPopup'; // Adjust this path
import SettlePayablePopup from '../components/SettlePayablePopup'; // Adjust this path
import { FaExclamationTriangle, FaCreditCard, FaSyncAlt, FaSpinner, FaChevronDown, FaChevronUp, FaInfoCircle, FaFileInvoiceDollar } from 'react-icons/fa';

// Helper component for statistics cards
const StatCard = ({ icon, title, value, colorClass }) => (
    <div className={`flex items-center p-4 bg-white shadow-lg rounded-xl border-l-4 ${colorClass}`}>
        <div className={`p-3 rounded-full bg-opacity-20 ${colorClass}`}>{icon}</div>
        <div className="ml-4">
            <p className="text-sm font-semibold text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    </div>
);

export default function SuppliersInfo() {
  // State to hold supplier data, now directly structured from the backend 'summary'
  const [supplierData, setSupplierData] = useState({});
  // State to hold the overall totals from the backend
  const [overallTotals, setOverallTotals] = useState({ totalOverallPending: 0, totalOverallCredit: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // UI state for expansion and filtering
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  const [expandedPayableRow, setExpandedPayableRow] = useState(null); 
  const [filterPending, setFilterPending] = useState(false);

  // Popup states
  const [settlePopup, setSettlePopup] = useState(null); // For BookingCostItem settlements
  const [selectedCreditNote, setSelectedCreditNote] = useState(null); // For CreditNote details
  const [settlePayablePopup, setSettlePayablePopup] = useState(null); // For SupplierPayable settlements

  // Function to fetch data from the API
  const fetchSuppliersInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getSuppliersInfo(); // Your API call
      // Update state with the structured data from the backend
      setSupplierData(response.data.data.summary || {});
      setOverallTotals({
        totalOverallPending: response.data.data.totalOverallPending || 0,
        totalOverallCredit: response.data.data.totalOverallCredit || 0,
      });
    } catch (err) {
      console.error('Error fetching suppliers info:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load supplier data.');
      setSupplierData({});
      setOverallTotals({ totalOverallPending: 0, totalOverallCredit: 0 }); // Reset totals on error
    } finally {
      setLoading(false);
    }
  };

  // Fetch data on component mount
  useEffect(() => {
    fetchSuppliersInfo();
  }, []);
  
  // Callback for when a settlement/payable is submitted in a popup
  const handleSettleSubmit = () => {
    fetchSuppliersInfo(); // Re-fetch all data to ensure latest states are reflected
    setSettlePopup(null);
    setSettlePayablePopup(null);
  };

  // Memoized data for filtering suppliers based on pending balance
  const filteredSuppliers = useMemo(() => {
    if (filterPending) {
      return Object.fromEntries(Object.entries(supplierData).filter(([, data]) => (data.totalPending ?? 0) > 0)); // FIX: Nullish coalescing
    }
    return supplierData;
  }, [supplierData, filterPending]);

  // Toggle expansion for a main supplier row
  const toggleMainSupplier = (supplier) => {
    setExpandedSuppliers(prev => ({ ...prev, [supplier]: !prev[supplier] }));
  };

  // Toggle expansion for a payable linked to a transaction row
  const togglePayableExpansion = (transactionUniqueId) => {
    setExpandedPayableRow(prev => (prev === transactionUniqueId ? null : transactionUniqueId));
  }
  
  // Handles clicks on individual transaction rows (booking cost items or credit notes)
  const handleTransactionClick = (item, supplierName, e) => {
    // Prevent event bubbling if a nested clickable element (like the credit note amount button) was clicked
    if (e && e.target.closest('button')) {
        return; 
    }

    if (item.type === 'BookingCostItem') {
        // Pass the item.data (which contains the cost item supplier details) to the settlement popup
        setSettlePopup({ booking: item.data, supplier: supplierName });
    } else if (item.type === 'CreditNote') {
        // This case should theoretically be rare or non-existent for standalone credit notes
        // but kept for robustness.
        setSelectedCreditNote(item.data);
    }
    // No action for other transaction types.
  };

  // Helper to determine the status pill text and styling
  const getStatusPill = (totalPaid, totalPending) => {
    const epsilon = 0.01; // Small threshold for floating point comparisons
    if ((totalPending ?? 0) <= epsilon && (totalPending ?? 0) >= -epsilon && (totalPaid ?? 0) > epsilon) { // FIX: Nullish coalescing
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Fully Paid</span>;
    }
    if ((totalPaid ?? 0) > epsilon && (totalPending ?? 0) > epsilon) { // FIX: Nullish coalescing
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Partially Paid</span>;
    }
    if ((totalPending ?? 0) > epsilon) { // FIX: Nullish coalescing
        return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Unpaid</span>;
    }
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">N/A</span>;
  };
  
  // Helper to format dates
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : '—';

  // Loading and error states
  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><FaSpinner className="animate-spin text-blue-500 h-12 w-12" /></div>;
  if (error) return <div className="p-4 text-center text-red-700 bg-red-100 rounded-lg">{error} <button onClick={fetchSuppliersInfo} className="ml-4 font-bold underline">Retry</button></div>;

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        <header className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Supplier Payments</h1>
            <p className="text-slate-500 mt-1">Dashboard for tracking all outstanding payments and credits.</p>
        </header>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard icon={<FaExclamationTriangle size={24} className="text-red-500" />} title="Total Pending Payments" value={`£${overallTotals.totalOverallPending.toFixed(2)}`} colorClass="border-red-500 bg-red-50" />
            <StatCard icon={<FaCreditCard size={24} className="text-blue-500" />} title="Total Available Credit" value={`£${overallTotals.totalOverallCredit.toFixed(2)}`} colorClass="border-blue-500 bg-blue-50" />
            <div className="flex flex-col justify-center gap-2 p-4 bg-white shadow-lg rounded-xl border-l-4 border-slate-400">
                <label className="flex items-center text-sm font-medium text-slate-700 select-none">
                    <input type="checkbox" checked={filterPending} onChange={() => setFilterPending(!filterPending)} className="mr-2 h-4 w-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500" />
                    Show Only Pending Balances
                </label>
                <button onClick={fetchSuppliersInfo} className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-semibold shadow-sm">
                    <FaSyncAlt className={loading ? 'animate-spin' : ''} /> Refresh Data
                </button>
            </div>
        </div>
      
        {/* Main Supplier Table */}
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-100">
                 <tr>
                  <th className="pl-6 pr-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Due (£)</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Paid (£)</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Pending Balance (£)</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Available Credit (£)</th>
                  <th className="w-40 pl-4 pr-6 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Overall Status</th>
                  <th className="w-40 pl-4 pr-6 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(filteredSuppliers).map(([supplierName, data]) => {
                   // Check for any pending payables for this specific supplier, for the pulse indicator
                   const hasAnyPendingPayables = data.payables.some(p => (p.pending ?? 0) > 0); 
                   return (
                  <React.Fragment key={supplierName}>
                    <tr className="group">
                       <td className="pl-8 pr-4 py-4 whitespace-nowrap text-sm font-medium text-slate-900 relative">
                        {hasAnyPendingPayables && (
                           <div className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full animate-pulse" title="This supplier has outstanding payables!"/>
                        )}
                        {supplierName}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-slate-600 text-right font-medium">£{(data.totalAmount || 0).toFixed(2)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-green-600 font-semibold text-right">£{(data.totalPaid || 0).toFixed(2)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-red-600 font-bold text-right">£{(data.totalPending || 0).toFixed(2)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-blue-600 font-semibold text-right">£{(data.totalAvailableCredit || 0).toFixed(2)}</td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">{getStatusPill(data.totalPaid, data.totalPending)}</td>
                      <td className="pl-4 pr-6 py-4 whitespace-nowrap text-sm text-center">
                        <button onClick={() => toggleMainSupplier(supplierName)} className="flex items-center gap-2 w-full justify-center px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 text-xs font-semibold shadow-sm">
                           {expandedSuppliers[supplierName] ? <><FaChevronUp/> Hide</> : <><FaChevronDown/> Show</>} Details
                        </button>
                      </td>
                    </tr>
                    {expandedSuppliers[supplierName] && (
                      <tr>
                        <td colSpan="7" className="p-4 bg-slate-50">
                          <div className="bg-white p-4 rounded-lg border border-slate-200 shadow-inner">
                            <h3 className="text-base font-semibold text-slate-800 mb-3">Transactions for {supplierName}</h3>
                            <div className="overflow-x-auto rounded-md border border-slate-200">
                                <table className="min-w-full">
                                <thead className="bg-slate-100 text-slate-600">
                                    <tr>
                                      <th className="pl-4 pr-2 py-2 text-left text-xs font-semibold uppercase w-12"></th>
                                      <th className="px-2 py-2 text-left text-xs font-semibold uppercase">Folder No</th>
                                      <th className="px-2 py-2 text-left text-xs font-semibold uppercase">Ref / Reason</th>
                                      <th className="px-2 py-2 text-left text-xs font-semibold uppercase">Category</th>
                                      <th className="px-2 py-2 text-right text-xs font-semibold uppercase">Total</th>
                                      <th className="px-2 py-2 text-right text-xs font-semibold uppercase">Paid</th>
                                      <th className="px-2 py-2 text-right text-xs font-semibold uppercase">Pending</th>
                                      <th className="px-2 py-2 text-right text-xs font-semibold uppercase">Credit</th>
                                      <th className="pr-4 pl-2 py-2 text-right text-xs font-semibold uppercase">Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200 text-sm">
                                  {/* Iterate through ALL transactions (BookingCostItem and CreditNote, some CreditNote might be filtered out) */}
                                  {data.transactions.map(item => (
                                    <React.Fragment key={item.type + '-' + item.id}>
                                        <tr 
                                            // The whole row is clickable unless it's a specific button within it
                                            className={`transition-colors ${item.type === 'BookingCostItem' && item.data.bookingStatus === 'CANCELLED' ? 'bg-slate-100 text-slate-500 hover:bg-slate-200' : 'hover:bg-blue-50'} ${item.type !== 'CreditNote' ? 'cursor-pointer' : ''}`} 
                                            onClick={(e) => handleTransactionClick(item, supplierName, e)} // Unified click handler
                                        >
                                            <td className="pl-4 pr-2 py-2.5">
                                                {/* Show payable expansion button ONLY if it's a BookingCostItem and has linked pending payables */}
                                                {item.type === 'BookingCostItem' && data.payables.some(p => p.originatingFolderNo === item.data.folderNo.toString().split('.')[0] && (p.pending ?? 0) > 0) && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); togglePayableExpansion(item.type + '-' + item.id); }}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                                                        title="Show/Hide associated payable"
                                                    >
                                                      <FaChevronDown className={`transform transition-transform ${expandedPayableRow === (item.type + '-' + item.id) ? 'rotate-180' : ''}`} />
                                                    </button>
                                                )}
                                                {item.type === 'CreditNote' && ( // Standalone Credit Note icon
                                                    <FaInfoCircle className="text-blue-500 ml-1" title="This is a Supplier Credit Note" />
                                                )}
                                            </td>
                                            {/* Render details based on transaction type */}
                                            {item.type === 'BookingCostItem' ? (
                                                <>
                                                    <td className="px-2 py-2.5 font-semibold">{item.data.folderNo}</td>
                                                    <td className="px-2 py-2.5">{item.data.refNo}</td>
                                                    <td className="px-2 py-2.5">{item.data.category}</td>
                                                    <td className="px-2 py-2.5 text-right font-medium">£{(item.data.amount ?? 0).toFixed(2)}</td>
                                                    <td className="px-2 py-2.5 text-right text-green-600">£{(item.data.paidAmount ?? 0).toFixed(2)}</td>
                                                    <td className="px-2 py-2.5 text-right font-bold">
                                                        <span className={(item.data.pendingAmount ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}>£{(item.data.pendingAmount ?? 0).toFixed(2)}</span>
                                                    </td>
                                                    <td className="px-2 py-2.5 text-right font-semibold">
                                                        {item.data.generatedCreditNote ? ( // Display generated credit note here if exists
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setSelectedCreditNote(item.data.generatedCreditNote.fullCreditNoteObject); }} 
                                                                className="text-blue-600 hover:underline flex items-center justify-end gap-1"
                                                            >
                                                                <FaCreditCard className="text-sm" /> £{(item.data.generatedCreditNote.remainingAmount ?? 0).toFixed(2)}
                                                            </button>
                                                        ) : item.data.paidByCreditNoteUsage?.length > 0 ? ( // Display credit notes used to pay for this cost item
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setSelectedCreditNote(item.data.paidByCreditNoteUsage[0].creditNote); }} 
                                                                className="text-blue-600 hover:underline flex items-center justify-end gap-1"
                                                            >
                                                                <FaCreditCard className="text-sm" /> £{item.data.paidByCreditNoteUsage.reduce((sum, usage) => sum + (usage.amountUsed ?? 0), 0).toFixed(2)} Used
                                                            </button>
                                                        ) : '—'}
                                                    </td>
                                                    <td className="pr-4 pl-2 py-2.5 text-right">{formatDate(item.data.createdAt)}</td>
                                                </>
                                            ) : item.type === 'CreditNote' ? ( // Separate row for standalone Credit Notes
                                                <>
                                                    <td className="px-2 py-2.5 font-semibold">—</td>
                                                    <td className="px-2 py-2.5">{`Credit Note (${item.data.generatedFromRefNo || 'N/A'})`}</td>
                                                    <td className="px-2 py-2.5">Credit Note</td>
                                                    <td className="px-2 py-2.5 text-right font-medium">£{(item.data.initialAmount ?? 0).toFixed(2)}</td>
                                                    <td className="px-2 py-2.5 text-right text-green-600">£{((item.data.initialAmount ?? 0) - (item.data.remainingAmount ?? 0)).toFixed(2)}</td>
                                                    <td className="px-2 py-2.5 text-right font-bold text-blue-600">£{(-(item.data.remainingAmount ?? 0)).toFixed(2)}</td>
                                                    <td className="px-2 py-2.5 text-right font-semibold">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); setSelectedCreditNote(item.data); }} 
                                                            className="text-blue-600 hover:underline flex items-center justify-end gap-1"
                                                        >
                                                            <FaCreditCard className="text-sm" /> £{(item.data.remainingAmount ?? 0).toFixed(2)}
                                                        </button>
                                                    </td>
                                                    <td className="pr-4 pl-2 py-2.5 text-right">{formatDate(item.data.createdAt)}</td>
                                                </>
                                            ) : null /* Add other types here if needed */ }
                                        </tr>
                                        {/* Display linked payables for this BookingCostItem transaction if expanded */}
                                        {expandedPayableRow === (item.type + '-' + item.id) && item.type === 'BookingCostItem' && (
                                          data.payables
                                            .filter(p => p.originatingFolderNo === item.data.folderNo.toString().split('.')[0] && (p.pending ?? 0) > 0)
                                            .map(payable => (
                                              <tr key={`payable-linked-${payable.id}`} className="bg-red-50/70">
                                                  <td colSpan="9" className="p-0">
                                                    <div className="py-3 px-4 m-2 border-l-4 border-red-400 bg-white rounded-r-lg shadow">
                                                       <div className="flex justify-between items-center">
                                                          <div>
                                                              <p className="font-bold text-red-700">Outstanding Payable</p>
                                                              <p className="text-sm text-slate-600">{payable.reason}</p>
                                                          </div>
                                                          <div className="flex items-center gap-6 text-sm text-right">
                                                              <div>
                                                                <p className="text-xs text-slate-500">Total Payable</p>
                                                                <p className="font-semibold">£{(payable.total ?? 0).toFixed(2)}</p>
                                                              </div>
                                                              <div>
                                                                <p className="text-xs text-slate-500">Paid</p>
                                                                <p className="font-semibold text-green-600">£{(payable.paid ?? 0).toFixed(2)}</p>
                                                              </div>
                                                              <div>
                                                                <p className="text-xs text-slate-500">Pending</p>
                                                                <p className="font-bold text-lg text-red-600">£{(payable.pending ?? 0).toFixed(2)}</p>
                                                              </div>
                                                              <button
                                                                  onClick={(e) => { e.stopPropagation(); setSettlePayablePopup({ payable: payable, supplier: supplierName }); }}
                                                                  className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold shadow"
                                                                >Settle</button>
                                                          </div>
                                                        </div>
                                                    </div>
                                                  </td>
                                              </tr>
                                            ))
                                        )}
                                    </React.Fragment>
                                  ))}
                                  {/* Render stand-alone payables that are not directly linked to a displayed BookingCostItem */}
                                  {data.payables
                                      .filter(payable => !data.transactions.some(tx => tx.type === 'BookingCostItem' && tx.data.folderNo.toString().split('.')[0] === payable.originatingFolderNo.toString().split('.')[0]))
                                      .map(payable => (
                                    <tr key={`payable-standalone-${payable.id}`} className="bg-orange-50/70 hover:bg-orange-100 transition-colors cursor-pointer"
                                        onClick={(e) => { e.stopPropagation(); setSettlePayablePopup({ payable: payable, supplier: supplierName }); }}>
                                        <td className="pl-4 pr-2 py-2.5"><FaFileInvoiceDollar className="text-orange-500 ml-1" title="Outstanding Payable" /></td>
                                        <td className="px-2 py-2.5 font-semibold">{payable.originatingFolderNo}</td>
                                        <td className="px-2 py-2.5">{payable.originatingRefNo || payable.reason}</td>
                                        <td className="px-2 py-2.5">Payable</td>
                                        <td className="px-2 py-2.5 text-right font-medium">£{(payable.total ?? 0).toFixed(2)}</td>
                                        <td className="px-2 py-2.5 text-right text-green-600">£{(payable.paid ?? 0).toFixed(2)}</td>
                                        <td className="px-2 py-2.5 text-right font-bold text-red-600">£{(payable.pending ?? 0).toFixed(2)}</td>
                                        <td className="px-2 py-2.5 text-right">—</td>
                                        <td className="pr-4 pl-2 py-2.5 text-right">{formatDate(payable.createdAt)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                   )})}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Popups */}
      {settlePopup && <SettlePaymentPopup booking={settlePopup.booking} supplier={settlePopup.supplier} onClose={() => setSettlePopup(null)} onSubmit={handleSettleSubmit} />}
      {selectedCreditNote && <CreditNoteDetailsPopup note={selectedCreditNote} onClose={() => setSelectedCreditNote(null)} />}
      {settlePayablePopup && <SettlePayablePopup payable={settlePayablePopup.payable} supplier={settlePayablePopup.supplier} onClose={() => setSettlePayablePopup(null)} onSubmit={handleSettleSubmit} />}
    </div>
  );
}