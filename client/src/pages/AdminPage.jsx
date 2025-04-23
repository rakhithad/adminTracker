import { useEffect, useState } from 'react';
import { getBookings } from '../api/api';
import CreateBooking from '../components/CreateBooking';

export default function AdminPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await getBookings();
        console.log("Full API response:", response);
        const bookingsData = Array.isArray(response.data.data) ? response.data.data : [];
        setBookings(bookingsData);
        
      } catch (error) {
        console.error("Failed to fetch bookings:", error);
        setError("Failed to load bookings");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  

  return (
    <div className="admin-page">
      
      

      <h2>Bookings</h2>
      <table>
        <thead>
          <tr>
            <th>Ref No</th>
            <th>Passenger</th>
            <th>Agent name</th>
            <th>team name</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => (
            <tr key={booking.id}>
              <td>{booking.refNo}</td>
              <td>{booking.paxName}</td>
              <td>{booking.agentName}</td>
              <td>{booking.teamName}</td>
              
            </tr>
          ))}
        </tbody>
      </table>

      <CreateBooking/>
    </div>
  );
}