import { useState, useEffect } from 'react';
import { 
  getDashboardStats, 
  getAttentionBookings, 
  getOverdueBookings 
} from '../api/api';
import { useNavigate } from 'react-router-dom';
import { 
  FaSpinner, 
  FaExclamationTriangle, 
  FaFileInvoiceDollar, 
  FaEdit, 
  FaBell 
} from 'react-icons/fa';

// --- Helper Functions ---

// Calculates start/end dates based on a key
const getDatesFromRange = (rangeKey) => {
  const now = new Date();
  let startDate = new Date();
  let endDate = new Date();

  switch (rangeKey) {
    case 'thisMonth':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'last30Days':
      startDate.setDate(now.getDate() - 30);
      break;
    case 'thisYear':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    case 'allTime':
    default:
      return { startDate: null, endDate: null }; // API will handle nulls
  }
  
  // Return dates in 'YYYY-MM-DD' format
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
};

// Formats currency
const formatCurrency = (amount) => `£${(amount || 0).toFixed(2)}`;

// Formats a date string
const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  return new Date(dateStr).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
};

// --- Stat Card Component ---
const StatCard = ({ title, value, color, icon }) => (
  <div className={`p-4 rounded-lg shadow`} style={{ backgroundColor: `${color}1A` }}>
    <div className="flex items-center justify-between mb-2">
      <h3 className="text-sm font-medium" style={{ color: `${color}CC` }}>{title}</h3>
      <span style={{ color: color }}>{icon}</span>
    </div>
    <p className="text-2xl font-bold" style={{ color: color }}>{value}</p>
  </div>
);

// --- Dashboard Component ---
export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalBalanceDue: 0,
  });
  const [attentionBookings, setAttentionBookings] = useState([]);
  const [overdueBookings, setOverdueBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState('thisMonth'); // Default range
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const { startDate, endDate } = getDatesFromRange(dateRange);

        // Fetch all data in parallel
        const [statsResponse, attentionResponse, overdueResponse] = await Promise.all([
          getDashboardStats({ startDate, endDate }),
          getAttentionBookings(),
          getOverdueBookings(),
        ]);

        setStats(statsResponse.data.data);
        setAttentionBookings(attentionResponse.data.data);
        setOverdueBookings(overdueResponse.data.data);

      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]); // Re-fetch data when dateRange changes

  // --- Render Functions ---

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="flex justify-between items-center mb-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-10 bg-gray-200 rounded w-1/6"></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-200 rounded"></div>)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 text-center">
        <div className="text-red-500 mb-4">
          <FaExclamationTriangle className="h-12 w-12 mx-auto" />
        </div>
        <p className="text-gray-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: '#F9FAFB' }}>
      <header className="flex flex-wrap justify-between items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold" style={{ color: '#2D3E50' }}>Dashboard</h1>
        <div className="flex-shrink-0">
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="block w-full px-4 py-2.5 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': '#0A738A' }}
          >
            <option value="thisMonth">This Month</option>
            <option value="last30Days">Last 30 Days</option>
            <option value="thisYear">This Year</option>
            <option value="allTime">All Time</option>
          </select>
        </div>
      </header>

      {/* --- Main Stats Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="Total Revenue (Period)"
          value={formatCurrency(stats.totalRevenue)}
          color="#10B981"
          icon={<FaFileInvoiceDollar />}
        />
        <StatCard
          title="Total Profit (Period)"
          value={formatCurrency(stats.totalProfit)}
          color="#0A738A"
          icon={<FaFileInvoiceDollar />}
        />
        <StatCard
          title="Total Balance Due (All)"
          value={formatCurrency(stats.totalBalanceDue)}
          color="#E05B5B"
          icon={<FaExclamationTriangle />}
        />
      </div>

      {/* --- Booking Stats Grid --- */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <StatCard
          title="New Bookings (Period)"
          value={stats.totalBookings}
          color="#2D3E50"
          icon={<FaBell />}
        />
        <StatCard
          title="Pending Enquiries (Period)"
          value={stats.pendingBookings}
          color="#F2C144"
          icon={<FaBell />}
        />
        <StatCard
          title="Completed (Period)"
          value={stats.completedBookings}
          color="#8B5CF6"
          icon={<FaBell />}
        />
      </div>

      {/* --- Action Required Widgets --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Widget 1: Needs Attention */}
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
          <header className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#2D3E50' }}>
              <FaEdit style={{ color: '#F08A4B' }} />
              Action Required: Needs Data
            </h3>
            <p className="text-sm text-gray-500">Bookings missing supplier costs or issued dates.</p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref No</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {attentionBookings.length > 0 ? (
                  attentionBookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate('/bookings')}
                    >
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#0A738A' }}>{b.refNo}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{b.paxName}</td>
                      <td className="px-4 py-3 text-sm">
                        <span className="px-2 py-1 text-xs rounded-full bg-yellow-100 text-yellow-800 font-medium">
                          {b.reason}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                      All caught up! No actions required.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Widget 2: Overdue Balances */}
        <div className="bg-white shadow-lg rounded-xl border border-gray-200 overflow-hidden">
          <header className="p-4 bg-gray-50 border-b border-gray-200">
            <h3 className="text-lg font-semibold flex items-center gap-2" style={{ color: '#2D3E50' }}>
              <FaExclamationTriangle style={{ color: '#E05B5B' }} />
              Overdue Balances
            </h3>
            <p className="text-sm text-gray-500">Bookings with a past travel date and balance due.</p>
          </header>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref No</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Travel Date</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Balance Due</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {overdueBookings.length > 0 ? (
                  overdueBookings.map((b) => (
                    <tr
                      key={b.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate('/bookings')}
                    >
                      <td className="px-4 py-3 text-sm font-semibold" style={{ color: '#0A738A' }}>{b.refNo}</td>
                      <td className="px-4 py-3 text-sm text-gray-800">{formatDate(b.travelDate)}</td>
                      <td className="px-4 py-3 text-sm font-bold" style={{ color: '#E05B5B' }}>
                        {formatCurrency(b.balance)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3} className="px-4 py-6 text-center text-gray-500">
                      No overdue balances. Great job!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}