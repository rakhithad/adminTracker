
import React, { useState, useEffect } from 'react';
import { getSuppliersInfo } from '../api/api';

export default function SuppliersInfo() {
  const [supplierData, setSupplierData] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedSuppliers, setExpandedSuppliers] = useState({});

  // Move fetchSuppliersInfo outside useEffect
  const fetchSuppliersInfo = async () => {
    try {
      setLoading(true);
      const response = await getSuppliersInfo();
      // Validate response structure
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

  const toggleSupplier = (supplier) => {
    setExpandedSuppliers((prev) => ({
      ...prev,
      [supplier]: !prev[supplier],
    }));
  };

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
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
          <p className="text-gray-600 mb-6">{error}</p>
          <button
            onClick={fetchSuppliersInfo} // Remove arrow function for simplicity
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (Object.keys(supplierData).length === 0) {
    return (
      <div className="text-center py-12 bg-white shadow-2xl rounded-2xl p-8 max-w-7xl mx-auto">
        <svg
          className="h-16 w-16 text-gray-400 mx-auto mb-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <h3 className="text-xl font-semibold text-gray-700 mb-2">No Supplier Payment Data Found</h3>
        <p className="text-gray-500">Create a booking with supplier allocations to get started.</p>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-2xl rounded-2xl overflow-hidden p-8 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">Suppliers Payment Info</h2>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Supplier
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Total Paid (£)
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Number of Bookings
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {Object.entries(supplierData).map(([supplier, data]) => (
              <React.Fragment key={supplier}>
                <tr className="hover:bg-gray-50 transition-colors duration-150">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {supplier}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    £{(data.totalPaid || 0).toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {(data.bookings || []).length}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => toggleSupplier(supplier)}
                      className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                    >
                      {expandedSuppliers[supplier] ? 'Hide Details' : 'Show Details'}
                    </button>
                  </td>
                </tr>
                {expandedSuppliers[supplier] && (
                  <tr>
                    <td colSpan="4" className="px-6 py-4">
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <h3 className="text-sm font-medium mb-2">Booking Details for {supplier}</h3>
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-100">
                            <tr>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Booking ID
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Ref No
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Passenger
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Agent
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Category
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Amount (£)
                              </th>
                              <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                                Created At
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200">
                            {(data.bookings || []).map((booking) => (
                              <tr key={`${booking.bookingId}-${booking.category}`}>
                                <td className="px-4 py-2 text-sm">{booking.bookingId}</td>
                                <td className="px-4 py-2 text-sm">{booking.refNo}</td>
                                <td className="px-4 py-2 text-sm">{booking.paxName}</td>
                                <td className="px-4 py-2 text-sm">{booking.agentName}</td>
                                <td className="px-4 py-2 text-sm">{booking.category}</td>
                                <td className="px-4 py-2 text-sm">£{(booking.amount || 0).toFixed(2)}</td>
                                <td className="px-4 py-2 text-sm">
                                  {booking.createdAt
                                    ? new Date(booking.createdAt).toLocaleDateString('en-GB')
                                    : 'N/A'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
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
  );
}
