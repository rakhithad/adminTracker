import { useEffect, useState } from 'react';
import { getBookings } from '../api/api';
import CreateBooking from '../components/CreateBooking';

export default function AdminPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchBookings = async () => {
    try {
      const response = await getBookings();
      const bookingsData = Array.isArray(response.data.data) ? response.data.data : [];
      setBookings(bookingsData);
    } catch (error) {
      console.error("Failed to fetch bookings:", error);
      setError("Failed to load bookings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBookings();
  }, []);

  const handleNewBooking = (newBooking) => {
    setBookings(prevBookings => [newBooking, ...prevBookings]);
  };

  if (loading) return <div className="text-center py-10 text-lg font-medium">Loading...</div>;
  if (error) return <div className="text-center py-10 text-red-600">{error}</div>;

  return (
    <div className="min-h-screen bg-gray-700 p-6">
      <div className="max-w-5xl mx-auto bg-white shadow-lg rounded-xl p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">All Bookings</h2>

        <div className="overflow-x-auto">
          <table className="min-w-full table-auto border-collapse">
            <thead>
              <tr className="bg-gray-200 text-gray-700 text-left">
                <th className="px-4 py-2 border">Ref No</th>
                <th className="px-4 py-2 border">Passenger</th>
                <th className="px-4 py-2 border">Agent Name</th>
                <th className="px-4 py-2 border">Team Name</th>
              </tr>
            </thead>
            <tbody>
              {bookings.map((booking) => (
                <tr key={booking.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 border">{booking.refNo}</td>
                  <td className="px-4 py-2 border">{booking.paxName}</td>
                  <td className="px-4 py-2 border">{booking.agentName}</td>
                  <td className="px-4 py-2 border">{booking.teamName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8">
          <CreateBooking onBookingCreated={handleNewBooking} />
        </div>
      </div>
    </div>
  );
}