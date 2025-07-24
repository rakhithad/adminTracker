import React, { useState, useEffect, useMemo } from 'react';
import { getSuppliersInfo } from '../api/api';
import SettlePaymentPopup from '../components/SettlePaymentPopup';
import CreditNoteDetailsPopup from '../components/CreditNoteDetailsPopup';
import { FaExclamationTriangle, FaCreditCard, FaSyncAlt } from 'react-icons/fa';
import SettlePayablePopup from '../components/SettlePayablePopup';

export default function SuppliersInfo() {
  const [supplierData, setSupplierData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  const [filterPending, setFilterPending] = useState(false);
  const [settlePopup, setSettlePopup] = useState(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState(null);
  const [settlePayablePopup, setSettlePayablePopup] = useState(null);

  const fetchSuppliersInfo = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getSuppliersInfo();
      if (!response.data?.success || !response.data?.data) {
        throw new Error('Invalid response structure from API');
      }
      setSupplierData(response.data.data || {});
    } catch (error) {
      console.error('Error fetching suppliers info:', error);
      setError(error.response?.data?.error || error.message || 'Failed to load supplier payment data.');
      setSupplierData({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSuppliersInfo();
  }, []);
  
  const handlePayableSettleSubmit = () => {
    fetchSuppliersInfo();
    setSettlePayablePopup(null);
  };

  const handleSettleSubmit = () => {
    fetchSuppliersInfo();
    setSettlePopup(null);
  };

  const totalOverallPending = useMemo(() => {
    return Object.values(supplierData).reduce((sum, supplier) => sum + (supplier.totalPending || 0), 0);
  }, [supplierData]);
  
  const totalOverallCredit = useMemo(() => {
    return Object.values(supplierData).reduce((sum, supplier) => {
        const creditTransactions = (supplier.transactions || []).filter(t => t.type === 'CreditNote');
        const supplierCredit = creditTransactions.reduce((noteSum, t) => noteSum + (t.data.remainingAmount || 0), 0);
        return sum + supplierCredit;
    }, 0);
  }, [supplierData]);

  const processedSupplierData = useMemo(() => {
    const processedData = JSON.parse(JSON.stringify(supplierData));

    for (const supplierName in processedData) {
      const supplier = processedData[supplierName];
      if (!supplier.transactions) continue;

      const creditNoteMap = supplier.transactions
        .filter(tx => tx.type === 'CreditNote')
        .reduce((map, tx) => {
          if (tx.data.generatedFromRefNo) {
            map[tx.data.generatedFromRefNo] = tx.data;
          }
          return map;
        }, {});

      supplier.transactions = supplier.transactions
        .filter(tx => tx.type === 'Booking')
        .map(tx => ({
            ...tx,
            creditNote: creditNoteMap[tx.data.refNo] || null,
        }));
    }
    return processedData;
  }, [supplierData]);

  const filteredSuppliers = useMemo(() => {
    if (filterPending) {
      return Object.fromEntries(Object.entries(processedSupplierData).filter(([, data]) => data.totalPending > 0));
    }
    return processedSupplierData;
  }, [processedSupplierData, filterPending]);

  const toggleSupplier = (supplier) => {
    setExpandedSuppliers((prev) => ({ ...prev, [supplier]: !prev[supplier] }));
  };

  const getPaymentStatus = (paid, pending) => {
    if (pending <= 0.01 && (paid > 0 || pending > -0.01)) return 'Fully Paid';
    if (paid < 0.01 && pending > 0) return 'Unpaid';
    if (paid > 0 && pending > 0) return 'Partially Paid';
    return 'N/A';
  };
  
  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <FaSyncAlt className="animate-spin text-blue-500 h-10 w-10 mx-auto mb-4" />
          <p className="text-lg font-semibold text-gray-700">Loading Supplier Data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-lg">
        <div className="text-center max-w-md p-6">
          <div className="text-red-500 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button onClick={fetchSuppliersInfo} className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200">
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white mt-20 shadow-2xl rounded-2xl overflow-hidden p-8 max-w-7xl mx-auto">
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Suppliers Payment Info</h2>
          <div className="flex items-center space-x-4 mt-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input type="checkbox" checked={filterPending} onChange={() => setFilterPending(!filterPending)} className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded" />
              Show Only Pending Payments
            </label>
            <button onClick={fetchSuppliersInfo} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
              Refresh
            </button>
          </div>
        </div>
        
        <div className="flex gap-4">
            <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm">
                <div className="flex items-center"><FaExclamationTriangle className="h-6 w-6 mr-3" />
                    <div><p className="font-bold text-lg">£{totalOverallPending.toFixed(2)}</p><p className="text-sm">Total Pending Payments</p></div>
                </div>
            </div>
            <div className="bg-blue-50 border-l-4 border-blue-500 text-blue-700 p-4 rounded-lg shadow-sm">
                <div className="flex items-center"><FaCreditCard className="h-6 w-6 mr-3" />
                    <div><p className="font-bold text-lg">£{totalOverallCredit.toFixed(2)}</p><p className="text-sm">Total Available Credit</p></div>
                </div>
            </div>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount (£)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid (£)</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pending (£)</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(filteredSuppliers).map(([supplier, data]) => (
              <React.Fragment key={supplier}>
                <tr className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">£{(data.totalAmount || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium text-right">£{(data.totalPaid || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium text-right">£{(data.totalPending || 0).toFixed(2)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center"><span className={`px-2 py-1 rounded-full text-xs font-semibold ${getPaymentStatus(data.totalPaid, data.totalPending) === 'Fully Paid' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>{getPaymentStatus(data.totalPaid, data.totalPending)}</span></td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-center">{(data.transactions || []).length}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-center">
                    <button onClick={() => toggleSupplier(supplier)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">{expandedSuppliers[supplier] ? 'Hide Details' : 'Show Details'}</button>
                  </td>
                </tr>

                {expandedSuppliers[supplier] && (
                  <tr>
                    <td colSpan="7" className="p-4 bg-gray-50 space-y-4">
                      
                      {/* --- TABLE 1: TRANSACTION DETAILS (BOOKINGS) --- */}
                      <div className="bg-white p-4 rounded-lg border">
                        <h3 className="text-sm font-semibold text-gray-800 mb-2">Transaction Details for {supplier}</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-100">
                                <tr>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref No / Origin</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Total (£)</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Paid (£)</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Pending (£)</th>
                                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">Credit Note (£)</th>
                                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200">
                                {(data.transactions || []).map((tx) => {
                                    const booking = tx.data;
                                    const creditNote = tx.creditNote;
                                    const isCancelled = booking.bookingStatus === 'CANCELLED';
                                    
                                    return (
                                    <tr 
                                      key={`${booking.id}-${booking.refNo}`} 
                                      onClick={() => setSettlePopup({ supplier, booking })} 
                                      className={`${isCancelled ? 'bg-gray-100 text-gray-500 line-through opacity-70 cursor-pointer' : 'hover:bg-blue-50 cursor-pointer'}`}
                                    >
                                        <td className="px-4 py-2 text-sm">{booking.refNo}</td>
                                        <td className="px-4 py-2 text-sm">{booking.category}</td>
                                        <td className="px-4 py-2 text-sm text-right">£{(booking.amount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-sm text-green-600 text-right">£{(booking.paidAmount || 0).toFixed(2)}</td>
                                        <td className="px-4 py-2 text-sm text-red-600 text-right">£{(booking.pendingAmount || 0).toFixed(2)}</td>
                                        
                                        <td className="px-4 py-2 text-sm font-medium text-right">
                                          {creditNote ? (
                                            creditNote.remainingAmount > 0.01 ? (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedCreditNote(creditNote); }}
                                                className="text-blue-600 hover:text-blue-800 hover:underline"
                                                title="View details and usage history"
                                              >
                                                £{creditNote.remainingAmount.toFixed(2)}
                                              </button>
                                            ) : (
                                              <button
                                                onClick={(e) => { e.stopPropagation(); setSelectedCreditNote(creditNote); }}
                                                className="text-gray-500 hover:text-gray-700 hover:underline text-xs"
                                                title="This credit note is fully used. Click to view history."
                                              >
                                                View History
                                              </button>
                                            )
                                          ) : (
                                            '-'
                                          )}
                                        </td>
                                        
                                        <td className="px-4 py-2 text-sm">{formatDate(booking.createdAt)}</td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                            </table>
                        </div>
                      </div>
                      
                      {/* --- TABLE 2: OUTSTANDING PAYABLES (CANCELLATIONS) --- */}
                      {(data.payables && data.payables.length > 0) && (
                        <div className="bg-white p-4 rounded-lg border border-red-200">
                          <h3 className="text-sm font-semibold text-red-800 mb-2">Outstanding Payables for {supplier}</h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-red-50">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-red-700 uppercase">Reason</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-red-700 uppercase">Total Payable (£)</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-red-700 uppercase">Paid (£)</th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-red-700 uppercase">Pending (£)</th>
                                  <th className="px-4 py-2 text-center text-xs font-medium text-red-700 uppercase">Actions</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {data.payables.map((payable) => (
                                  <tr key={payable.id} className="hover:bg-red-50">
                                    <td className="px-4 py-2 text-sm text-gray-700">{payable.reason}</td>
                                    <td className="px-4 py-2 text-sm text-gray-600 text-right">£{payable.totalAmount.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm text-green-600 text-right">£{payable.paidAmount.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm text-red-600 font-bold text-right">£{payable.pendingAmount.toFixed(2)}</td>
                                    <td className="px-4 py-2 text-center">
                                      <button 
                                        onClick={() => setSettlePayablePopup({ payable, supplier })} 
                                        className="px-3 py-1 bg-red-600 text-white rounded-lg hover:bg-red-700 text-xs font-semibold"
                                      >
                                        Settle
                                      </button>
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
      
      {settlePopup && (
        <SettlePaymentPopup 
          booking={settlePopup.booking} 
          supplier={settlePopup.supplier} 
          onClose={() => setSettlePopup(null)} 
          onSubmit={handleSettleSubmit} 
        />
      )}

      {selectedCreditNote && (
          <CreditNoteDetailsPopup 
            note={selectedCreditNote} 
            onClose={() => setSelectedCreditNote(null)} 
          />
      )}

      {settlePayablePopup && (
        <SettlePayablePopup
          payable={settlePayablePopup.payable}
          supplier={settlePayablePopup.supplier}
          onClose={() => setSettlePayablePopup(null)}
          onSubmit={handlePayableSettleSubmit}
        />
      )}
    </div>
  );
}