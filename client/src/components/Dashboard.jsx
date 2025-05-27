import { useState, useEffect } from 'react';
import { getDashboardStats, getRecentBookings } from '../api/api';
import { useNavigate } from 'react-router-dom';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalBookings: 0,
    pendingBookings: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
  });
  const [recentBookings, setRecentBookings] = useState({ bookings: [], pendingBookings: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [statsResponse, recentResponse] = await Promise.all([
          getDashboardStats(),
          getRecentBookings(),
        ]);
        setStats(statsResponse.data.data);
        setRecentBookings(recentResponse.data.data);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setError('Failed to load dashboard data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const formatDate = (dateStr) => {
    return dateStr ? new Date(dateStr).toLocaleDateString() : '-';
  };

  if (loading) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-24 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white shadow-xl rounded-xl p-6 text-center">
        <div className="text-red-500 mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
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
    <div className="bg-white shadow-xl rounded-xl p-6 mb-6">
      <h2 className="text-xl font-semibold text-gray-800 mb-4">Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-blue-50 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-blue-700">Total Bookings</h3>
          <p className="text-2xl font-bold text-blue-900">{stats.totalBookings}</p>
        </div>
        <div className="bg-yellow-50 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-yellow-700">Pending Bookings</h3>
          <p className="text-2xl font-bold text-yellow-900">{stats.pendingBookings}</p>
        </div>
        <div className="bg-green-50 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-green-700">Confirmed Bookings</h3>
          <p className="text-2xl font-bold text-green-900">{stats.confirmedBookings}</p>
        </div>
        <div className="bg-purple-50 p-4 rounded-lg shadow">
          <h3 className="text-sm font-medium text-purple-700">Completed Bookings</h3>
          <p className="text-2xl font-bold text-purple-900">{stats.completedBookings}</p>
        </div>
      </div>
      <div className="bg-gray-50 p-4 rounded-lg shadow">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Total Revenue</h3>
        <p className="text-2xl font-bold text-gray-900">£{stats.totalRevenue.toFixed(2)}</p>
      </div>
      <div className="mt-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-100">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Ref No</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Passenger</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created At</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {[...recentBookings.bookings, ...recentBookings.pendingBookings]
                .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
                .slice(0, 5)
                .map((booking) => (
                  <tr
                    key={`${booking.id}-${booking.status ? 'pending' : 'booking'}`}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(booking.status ? '/admin' : '/bookings')}
                  >
                    <td className="px-4 py-2 text-sm text-gray-900">{booking.refNo}</td>
                    <td className="px-4 py-2 text-sm text-gray-900">{booking.paxName}</td>
                    <td className="px-4 py-2 text-sm">
                      <span
                        className={`px-2 py-1 text-xs rounded-full ${
                          booking.bookingStatus === 'CONFIRMED' || booking.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : booking.bookingStatus === 'COMPLETED'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {booking.bookingStatus || booking.status}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-500">{formatDate(booking.createdAt)}</td>
                  </tr>
                ))}
              {recentBookings.bookings.length === 0 && recentBookings.pendingBookings.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                    No recent bookings
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}