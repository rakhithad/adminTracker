import React, { useState, useEffect, useMemo } from 'react';
import { getSuppliersInfo } from '../api/api';
import SettlePaymentPopup from '../components/SettlePaymentPopup';
import { FaExclamationTriangle } from 'react-icons/fa';

export default function SuppliersInfo() {
  const [supplierData, setSupplierData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState({});
  const [filterPending, setFilterPending] = useState(false);
  const [settlePopup, setSettlePopup] = useState(null);

  // --- HOOKS ---
  useEffect(() => {
    fetchSuppliersInfo();
  }, []);

  const filteredSuppliers = useMemo(() => {
    if (filterPending) {
      return Object.fromEntries(Object.entries(supplierData).filter(([, data]) => data.totalPending > 0));
    }
    return supplierData;
  }, [supplierData, filterPending]);

  // Calculate the total pending amount across all suppliers for the header box
  const totalOverallPending = useMemo(() => {
    return Object.values(supplierData).reduce((sum, supplier) => sum + (supplier.totalPending || 0), 0);
  }, [supplierData]);


  // --- HELPER FUNCTIONS ---
  const fetchSuppliersInfo = async () => {
    try {
      setLoading(true);
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

  const toggleSupplier = (supplier) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [supplier]: !prev[supplier],
    }));
  };

  const handleBookingClick = (supplier, booking) => {
    setSettlePopup({ supplier, booking });
  };

  const handleSettleSubmit = (payload) => {
    const { updatedCostItemSupplier } = payload;
    setSupplierData((prevData) => {
      const newData = JSON.parse(JSON.stringify(prevData));
      const supplierName = settlePopup.supplier;
      const supplier = newData[supplierName];
      if (!supplier) return prevData;
      const bookingIndex = supplier.bookings.findIndex(b => b.costItemSupplierId === updatedCostItemSupplier.id);
      if (bookingIndex === -1) return prevData;
      supplier.bookings[bookingIndex].paidAmount = updatedCostItemSupplier.paidAmount;
      supplier.bookings[bookingIndex].pendingAmount = updatedCostItemSupplier.pendingAmount;
      supplier.bookings[bookingIndex].settlements = updatedCostItemSupplier.settlements;
      supplier.totalPaid = supplier.bookings.reduce((sum, b) => sum + (b.paidAmount || 0), 0);
      supplier.totalPending = supplier.bookings.reduce((sum, b) => sum + (b.pendingAmount || 0), 0);
      setSettlePopup(prev => ({...prev, booking: supplier.bookings[bookingIndex]}));
      return newData;
    });
  };

  const getPaymentStatus = (paid, pending) => {
    const total = paid + pending;
    if (pending <= 0 && total > 0) return 'Fully Paid';
    if (paid === 0 && total > 0) return 'Unpaid';
    if (paid > 0 && pending > 0) return 'Partially Paid';
    return 'N/A';
  };

  // --- CONDITIONAL RETURNS ---
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px] bg-white rounded-2xl shadow-lg">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold text-gray-700">Loading supplier payment data...</p>
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

  // --- MAIN RENDER ---
  return (
    <div className="bg-white shadow-2xl rounded-2xl overflow-hidden p-8 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-6 flex-wrap gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">Suppliers Payment Info</h2>
          <div className="flex items-center space-x-4 mt-2">
            <label className="flex items-center text-sm font-medium text-gray-700">
              <input
                type="checkbox"
                checked={filterPending}
                onChange={() => setFilterPending(!filterPending)}
                className="mr-2 h-4 w-4 text-blue-600 border-gray-300 rounded"
              />
              Show Only Pending Payments
            </label>
            <button
              onClick={fetchSuppliersInfo}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Refresh
            </button>
          </div>
        </div>
        
        {/* Overall Pending Total Display Box */}
        <div className="bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded-lg shadow-sm">
          <div className="flex items-center">
            <FaExclamationTriangle className="h-6 w-6 mr-3" />
            <div>
              <p className="font-bold text-lg">
                £{totalOverallPending.toFixed(2)}
              </p>
              <p className="text-sm">Total Pending Payments</p>
            </div>
          </div>
        </div>
      </div>
      
      {Object.keys(filteredSuppliers).length === 0 ? (
        <div className="text-center py-12">
          <svg className="h-16 w-16 text-gray-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-xl font-semibold text-gray-700 mb-2">
            {filterPending ? 'No Pending Payments' : 'No Supplier Data Found'}
          </h3>
          <p className="text-gray-500">
            {filterPending ? 'All supplier payments are settled.' : 'Create a booking with supplier allocations to see data here.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Supplier</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Amount (£)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Paid (£)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Pending (£)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Bookings</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {Object.entries(filteredSuppliers).map(([supplier, data]) => (
                <React.Fragment key={supplier}>
                  <tr className="hover:bg-gray-50 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{supplier}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">£{(data.totalAmount || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">£{(data.totalPaid || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">£{(data.totalPending || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                        getPaymentStatus(data.totalPaid, data.totalPending) === 'Fully Paid' ? 'bg-green-100 text-green-800'
                        : getPaymentStatus(data.totalPaid, data.totalPending) === 'Unpaid' ? 'bg-red-100 text-red-800'
                        : getPaymentStatus(data.totalPaid, data.totalPending) === 'Partially Paid' ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'}`}>
                        {getPaymentStatus(data.totalPaid, data.totalPending)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(data.bookings || []).length}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button onClick={() => toggleSupplier(supplier)} className="text-blue-600 hover:text-blue-800 text-sm font-medium">
                        {expandedSuppliers[supplier] ? 'Hide Details' : 'Show Details'}
                      </button>
                    </td>
                  </tr>
                  {expandedSuppliers[supplier] && (
                    <tr>
                      <td colSpan="7" className="p-4 bg-gray-50">
                        <div className="bg-white p-4 rounded-lg border">
                          <h3 className="text-sm font-semibold text-gray-800 mb-2">Booking Details for {supplier}</h3>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Booking ID</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref No</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Agent</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Total (£)</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Paid (£)</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Pending (£)</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Payment Method</th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-200">
                                {(data.bookings || []).map((booking) => (
                                  <tr key={`${booking.bookingId}-${booking.category}`} onClick={() => handleBookingClick(supplier, booking)} className="hover:bg-blue-50 cursor-pointer transition-colors duration-150">
                                    <td className="px-4 py-2 text-sm">{booking.bookingId}</td>
                                    <td className="px-4 py-2 text-sm">{booking.refNo}</td>
                                    <td className="px-4 py-2 text-sm">{booking.paxName}</td>
                                    <td className="px-4 py-2 text-sm">{booking.agentName}</td>
                                    <td className="px-4 py-2 text-sm">{booking.category}</td>
                                    <td className="px-4 py-2 text-sm">£{(booking.amount || 0).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm text-green-600">£{(booking.paidAmount || 0).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm text-red-600">£{(booking.pendingAmount || 0).toFixed(2)}</td>
                                    <td className="px-4 py-2 text-sm">{booking.pendingAmount <= 0 && booking.amount > 0 ? <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-semibold">PAID</span> : booking.paymentMethod}</td>
                                    <td className="px-4 py-2 text-sm">{booking.createdAt ? new Date(booking.createdAt).toLocaleDateString('en-GB') : 'N/A'}</td>
                                  </tr>
                                ))}
                              </tbody>
                              {/* THIS IS THE NEW SUPPLIER-SPECIFIC FOOTER */}
                              <tfoot className="bg-gray-100 border-t-2 border-gray-300">
                                <tr>
                                    <td colSpan="5" className="px-4 py-2 text-sm font-bold text-right text-gray-800 uppercase">
                                        Supplier Total
                                    </td>
                                    <td className="px-4 py-2 text-sm font-bold text-gray-700">
                                        £{(data.totalAmount || 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-bold text-green-700">
                                        £{(data.totalPaid || 0).toFixed(2)}
                                    </td>
                                    <td className="px-4 py-2 text-sm font-bold text-red-700">
                                        £{(data.totalPending || 0).toFixed(2)}
                                    </td>
                                    <td colSpan="2" className="px-4 py-2"></td>
                                </tr>
                              </tfoot>
                            </table>
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
      )}
      
      {settlePopup && (
        <SettlePaymentPopup
          booking={settlePopup.booking}
          supplier={settlePopup.supplier}
          onClose={() => setSettlePopup(null)}
          onSubmit={handleSettleSubmit}
        />
      )}
    </div>
  );
}