// src/components/Transactions.js
import { useState, useEffect } from 'react';
import { getTransactions } from '../api/api';
import { FaSearch, FaSpinner, FaExclamationTriangle, FaFolderOpen, FaArrowDown, FaArrowUp, FaPlus, FaMinus, FaWallet  } from 'react-icons/fa';

const StatCard = ({ title, amount, icon, colorClass }) => (
  <div className={`p-4 rounded-lg shadow-md flex items-center ${colorClass}`}>
    <div className="p-3 bg-white bg-opacity-30 rounded-full mr-4">
      {icon}
    </div>
    <div>
      <p className="text-sm font-medium text-white opacity-90">{title}</p>
      <p className="text-2xl font-bold text-white">£{amount.toFixed(2)}</p>
    </div>
  </div>
);

export default function Transactions() {
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState({ incoming: 0, outgoing: 0, netBalance: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await getTransactions();
      
      // Check if the expected data structure exists
      if (response && response.data && response.data.data) {
        const payload = response.data.data; // payload is now { transactions, totals }

        // Correctly access the nested properties
        setTransactions(payload.transactions || []);
        setTotals(payload.totals || { incoming: 0, outgoing: 0, netBalance: 0 });
      } else {
        // Handle cases where the data might be in the old format or missing
        console.warn("Received an unexpected API response structure. Setting to empty.", response);
        setTransactions([]);
        setTotals({ incoming: 0, outgoing: 0, netBalance: 0 });
      }
    } catch (err) {
      setError('Failed to load transactions. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTransactions();
  }, []);

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-GB');
  };

  const filteredTransactions = transactions.filter(t => {
      const searchLower = searchTerm.toLowerCase();
      if (!searchLower) return true;
      
      return (
          t.bookingRefNo?.toLowerCase().includes(searchLower) ||
          t.details?.toLowerCase().includes(searchLower) ||
          t.category?.toLowerCase().includes(searchLower) ||
          t.method?.toLowerCase().includes(searchLower)
      );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <FaSpinner className="animate-spin text-blue-500 h-10 w-10 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-700">Loading Transactions...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <FaExclamationTriangle className="text-red-400 h-10 w-10 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-gray-800 mb-2">Error Loading Data</h3>
        <p className="text-gray-600 mb-4">{error}</p>
        <button onClick={fetchTransactions} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* --- NEW: SUMMARY CARDS SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <StatCard 
            title="Total Incoming" 
            amount={totals.incoming} 
            icon={<FaPlus className="text-green-600" />} 
            colorClass="bg-gradient-to-r from-green-500 to-emerald-600"
        />
        <StatCard 
            title="Total Outgoing" 
            amount={totals.outgoing} 
            icon={<FaMinus className="text-red-600" />} 
            colorClass="bg-gradient-to-r from-red-500 to-rose-600"
        />
        <StatCard 
            title="Net Balance" 
            amount={totals.netBalance} 
            icon={<FaWallet className="text-blue-600" />} 
            colorClass="bg-gradient-to-r from-blue-500 to-indigo-600"
        />
      </div>


      <div className="relative mb-6 w-full max-w-lg">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <FaSearch className="h-5 w-5 text-gray-400" />
        </div>
        <input
          type="text"
          placeholder="Search by Ref No, Details, Category..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="overflow-x-auto">
        {filteredTransactions.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Date</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Type</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Category</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Booking Ref</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Details</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-bold text-gray-600 uppercase">Method</th>
                <th scope="col" className="px-6 py-3 text-right text-xs font-bold text-gray-600 uppercase">Amount</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredTransactions.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDate(t.date)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    {t.type === 'Incoming' ? (
                      <span className="flex items-center text-green-600">
                        <FaArrowDown className="mr-2" /> Incoming
                      </span>
                    ) : (
                      <span className="flex items-center text-red-600">
                        <FaArrowUp className="mr-2" /> Outgoing
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-800">{t.category}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-blue-600">{t.bookingRefNo}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{t.details}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{t.method?.replace('_', ' ')}</td>
                  <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold text-right ${t.type === 'Incoming' ? 'text-green-700' : 'text-red-700'}`}>
                    £{parseFloat(t.amount).toFixed(2)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-16">
            <FaFolderOpen className="h-16 w-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-800">
              {searchTerm ? 'No Matching Transactions' : 'No Transactions Found'}
            </h3>
            <p className="text-gray-500 mt-2">
              {searchTerm ? 'Try a different search term.' : 'All financial movements will appear here.'}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}