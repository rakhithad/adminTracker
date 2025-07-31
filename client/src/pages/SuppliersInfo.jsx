import React, { useState, useEffect, useMemo } from 'react';
import { getSuppliersInfo } from '../api/api';
import SettlePaymentPopup from '../components/SettlePaymentPopup';
import CreditNoteDetailsPopup from '../components/CreditNoteDetailsPopup';
import SettlePayablePopup from '../components/SettlePayablePopup';
import { FaExclamationTriangle, FaCreditCard, FaSyncAlt, FaSpinner, FaChevronDown, FaChevronUp } from 'react-icons/fa';

// --- Reusable UI Components ---
const StatCard = ({ icon, title, value, colorClass }) => (
    <div className={`flex items-center p-4 bg-white shadow-lg rounded-xl border-l-4 ${colorClass}`}>
        <div className={`p-3 rounded-full bg-opacity-20 ${colorClass}`}>{icon}</div>
        <div className="ml-4">
            <p className="text-sm font-semibold text-slate-500">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
    </div>
);

// --- Main Component ---
export default function SuppliersInfo() {
  const [supplierData, setSupplierData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  // NEW State for targeted row expansion
  const [expandedPayableRow, setExpandedPayableRow] = useState(null); 
  const [filterPending, setFilterPending] = useState(false);
  const [settlePopup, setSettlePopup] = useState(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState(null);
  const [settlePayablePopup, setSettlePayablePopup] = useState(null);

  const fetchSuppliersInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getSuppliersInfo();
      setSupplierData(response.data.data || {});
    } catch (err) {
      console.error('Error fetching suppliers info:', err);
      setError(err.response?.data?.error || err.message || 'Failed to load supplier data.');
      setSupplierData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliersInfo();
  }, []);
  
  const handleSettleSubmit = () => {
    fetchSuppliersInfo();
    setSettlePopup(null);
    setSettlePayablePopup(null);
  };

  const { totalOverallPending, totalOverallCredit } = useMemo(() => {
    const values = Object.values(supplierData);
    const pending = values.reduce((sum, s) => sum + (s.totalPending || 0), 0);
    const credit = values.reduce((sum, s) => {
      const notes = (s.transactions || []).filter(t => t.type === 'CreditNote');
      return sum + notes.reduce((noteSum, t) => noteSum + (t.data.remainingAmount || 0), 0);
    }, 0);
    return { totalOverallPending: pending, totalOverallCredit: credit };
  }, [supplierData]);

  // RE-ARCHITECTED DATA PROCESSING
  const processedData = useMemo(() => {
    const finalData = JSON.parse(JSON.stringify(supplierData));

    for (const supplierName in finalData) {
        const supplier = finalData[supplierName];
        
        // Create a map of payables keyed by their originating folder number
        const payablesMap = new Map();
        (supplier.payables || []).forEach(p => {
            if(p.originatingFolderNo) {
                payablesMap.set(p.originatingFolderNo.toString(), p);
            }
        });

        // Create a map of credit notes
        const creditNoteMap = (supplier.transactions || [])
            .filter(tx => tx.type === 'CreditNote')
            .reduce((map, tx) => {
                if (tx.data.generatedFromRefNo) map[tx.data.generatedFromRefNo] = tx.data;
                return map;
            }, {});

        // Process bookings and link payables/credits
        const finalTransactions = (supplier.transactions || [])
            .filter(tx => tx.type === 'Booking')
            .map(tx => {
                const booking = tx.data;
                const baseFolderNo = booking.folderNo.toString().split('.')[0];
                const linkedPayable = payablesMap.get(baseFolderNo);

                if(linkedPayable) {
                    payablesMap.delete(baseFolderNo); // Remove from map so it's not double-counted
                }

                return {
                    uniqueId: `booking-${booking.id}`,
                    type: 'Booking',
                    folderNo: booking.folderNo,
                    identifier: booking.refNo,
                    category: booking.category,
                    total: booking.amount || 0,
                    paid: booking.paidAmount || 0,
                    pending: booking.pendingAmount || 0,
                    creditNote: creditNoteMap[booking.refNo] || null,
                    date: booking.createdAt,
                    status: booking.bookingStatus,
                    originalData: booking,
                    linkedPayable: linkedPayable ? { // Structure the linked payable
                      ...linkedPayable,
                      total: linkedPayable.totalAmount || 0,
                      paid: linkedPayable.paidAmount || 0,
                      pending: linkedPayable.pendingAmount || 0
                    } : null
                };
            });
        
        // Add any orphaned payables (without a matching booking in the list)
        payablesMap.forEach(p => {
          finalTransactions.push({
            uniqueId: `payable-${p.id}`, type: 'Payable', folderNo: p.originatingFolderNo, identifier: p.reason, category: 'Orphaned Payable',
            total: p.totalAmount, paid: p.paidAmount, pending: p.pendingAmount, creditNote: null, date: p.createdAt, status: 'Payable', originalData: p
          })
        });

        finalTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
        supplier.processedTransactions = finalTransactions;
    }
    return finalData;
  }, [supplierData]);

  const filteredSuppliers = useMemo(() => {
    if (filterPending) {
      return Object.fromEntries(Object.entries(processedData).filter(([, data]) => data.totalPending > 0));
    }
    return processedData;
  }, [processedData, filterPending]);

  const toggleMainSupplier = (supplier) => {
    setExpandedSuppliers(prev => ({ ...prev, [supplier]: !prev[supplier] }));
  };

  const togglePayableExpansion = (bookingUniqueId) => {
    setExpandedPayableRow(prev => (prev === bookingUniqueId ? null : bookingUniqueId));
  }
  
  const handleRowClick = (item, supplierName) => {
    if (item.status === 'CANCELLED') return;
    setSettlePopup({ booking: item.originalData, supplier: supplierName });
  };
  
  const getStatusPill = (paid, pending) => {
    if (pending <= 0.01 && (paid > 0 || pending > -0.01)) return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">Fully Paid</span>;
    if (paid > 0 && pending > 0) return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">Partially Paid</span>;
    if (pending > 0) return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">Unpaid</span>;
    return <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800">N/A</span>;
  };
  
  const formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString('en-GB', {day: '2-digit', month: 'short', year: 'numeric'}) : '—';

  // --- Render Logic ---
  if (loading) return <div className="flex items-center justify-center h-screen bg-slate-50"><FaSpinner className="animate-spin text-blue-500 h-12 w-12" /></div>;
  if (error) return <div className="p-4 text-center text-red-700 bg-red-100 rounded-lg">{error} <button onClick={fetchSuppliersInfo} className="ml-4 font-bold underline">Retry</button></div>;

  return (
    <div className="bg-slate-50 min-h-screen p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        {/* Header and Stat cards remain the same */}
        <header className="mb-8">
            <h1 className="text-3xl font-bold text-slate-900">Supplier Payments</h1>
            <p className="text-slate-500 mt-1">Dashboard for tracking all outstanding payments and credits.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <StatCard icon={<FaExclamationTriangle size={24} className="text-red-500" />} title="Total Pending Payments" value={`£${totalOverallPending.toFixed(2)}`} colorClass="border-red-500 bg-red-50" />
            <StatCard icon={<FaCreditCard size={24} className="text-blue-500" />} title="Total Available Credit" value={`£${totalOverallCredit.toFixed(2)}`} colorClass="border-blue-500 bg-blue-50" />
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
      
        <div className="bg-white shadow-lg rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-slate-100">
                 <tr>
                  <th className="pl-6 pr-4 py-3.5 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">Supplier</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Due (£)</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Total Paid (£)</th>
                  <th className="px-4 py-3.5 text-right text-xs font-semibold text-slate-600 uppercase tracking-wider">Pending Balance (£)</th>
                  <th className="px-4 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Overall Status</th>
                  <th className="w-40 pl-4 pr-6 py-3.5 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {Object.entries(filteredSuppliers).map(([supplierName, data]) => {
                   const hasAnyPendingPayables = data.processedTransactions.some(t => t.linkedPayable && t.linkedPayable.pending > 0);
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
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-center">{getStatusPill(data.totalPaid, data.totalPending)}</td>
                      <td className="pl-4 pr-6 py-4 whitespace-nowrap text-sm text-center">
                        <button onClick={() => toggleMainSupplier(supplierName)} className="flex items-center gap-2 w-full justify-center px-3 py-1.5 bg-white text-slate-700 border border-slate-300 rounded-lg hover:bg-slate-100 text-xs font-semibold shadow-sm">
                           {expandedSuppliers[supplierName] ? <><FaChevronUp/> Hide</> : <><FaChevronDown/> Show</>} Details
                        </button>
                      </td>
                    </tr>
                    {expandedSuppliers[supplierName] && (
                      <tr>
                        <td colSpan="6" className="p-4 bg-slate-50">
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
                                  {data.processedTransactions.map(item => (
                                    <React.Fragment key={item.uniqueId}>
                                        <tr className={`transition-colors ${item.status === 'CANCELLED' ? 'bg-slate-100 text-slate-500' : 'hover:bg-blue-50 cursor-pointer'}`} onClick={() => item.type === 'Booking' && handleRowClick(item, supplierName)}>
                                            <td className="pl-4 pr-2 py-2.5">
                                                {item.linkedPayable && item.linkedPayable.pending > 0 && (
                                                    <button 
                                                        onClick={(e) => { e.stopPropagation(); togglePayableExpansion(item.uniqueId); }}
                                                        className="w-6 h-6 flex items-center justify-center rounded-full bg-red-100 hover:bg-red-200 text-red-600"
                                                        title="Show/Hide associated payable"
                                                    >
                                                      <FaChevronDown className={`transform transition-transform ${expandedPayableRow === item.uniqueId ? 'rotate-180' : ''}`} />
                                                    </button>
                                                )}
                                            </td>
                                            <td className="px-2 py-2.5 font-semibold">{item.folderNo}</td>
                                            <td className="px-2 py-2.5">{item.identifier}</td>
                                            <td className="px-2 py-2.5">{item.category}</td>
                                            <td className="px-2 py-2.5 text-right font-medium">£{item.total.toFixed(2)}</td>
                                            <td className="px-2 py-2.5 text-right text-green-600">£{item.paid.toFixed(2)}</td>
                                            <td className={`px-2 py-2.5 text-right font-bold ${item.pending > 0 ? 'text-red-600' : 'text-slate-500'}`}>£{item.pending.toFixed(2)}</td>
                                            <td className="px-2 py-2.5 text-right font-semibold">
                                                {item.creditNote ? <button onClick={(e) => { e.stopPropagation(); setSelectedCreditNote(item.creditNote); }} className="text-blue-600 hover:underline">£{item.creditNote.remainingAmount.toFixed(2)}</button> : '—'}
                                            </td>
                                            <td className="pr-4 pl-2 py-2.5 text-right">{formatDate(item.date)}</td>
                                        </tr>
                                        {expandedPayableRow === item.uniqueId && item.linkedPayable && (
                                          <tr className="bg-red-50/70">
                                              <td colSpan="9" className="p-0">
                                                <div className="py-3 px-4 m-2 border-l-4 border-red-400 bg-white rounded-r-lg shadow">
                                                   <div className="flex justify-between items-center">
                                                      <div>
                                                          <p className="font-bold text-red-700">Outstanding Payable</p>
                                                          <p className="text-sm text-slate-600">{item.linkedPayable.reason}</p>
                                                      </div>
                                                      <div className="flex items-center gap-6 text-sm text-right">
                                                          <div>
                                                            <p className="text-xs text-slate-500">Total Payable</p>
                                                            <p className="font-semibold">£{item.linkedPayable.total.toFixed(2)}</p>
                                                          </div>
                                                          <div>
                                                            <p className="text-xs text-slate-500">Paid</p>
                                                            <p className="font-semibold text-green-600">£{item.linkedPayable.paid.toFixed(2)}</p>
                                                          </div>
                                                          <div>
                                                            <p className="text-xs text-slate-500">Pending</p>
                                                            <p className="font-bold text-lg text-red-600">£{item.linkedPayable.pending.toFixed(2)}</p>
                                                          </div>
                                                          <button
                                                              onClick={() => setSettlePayablePopup({ payable: item.linkedPayable, supplier: supplierName })}
                                                              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-semibold shadow"
                                                            >Settle</button>
                                                      </div>
                                                    </div>
                                                </div>
                                              </td>
                                          </tr>
                                        )}
                                    </React.Fragment>
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
      
      {settlePopup && <SettlePaymentPopup booking={settlePopup.booking} supplier={settlePopup.supplier} onClose={() => setSettlePopup(null)} onSubmit={handleSettleSubmit} />}
      {selectedCreditNote && <CreditNoteDetailsPopup note={selectedCreditNote} onClose={() => setSelectedCreditNote(null)} />}
      {settlePayablePopup && <SettlePayablePopup payable={settlePayablePopup.payable} supplier={settlePayablePopup.supplier} onClose={() => setSettlePayablePopup(null)} onSubmit={handleSettleSubmit} />}
    </div>
  );
}