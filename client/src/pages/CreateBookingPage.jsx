import { useState } from 'react';
import { FaSearch } from 'react-icons/fa';
import { useLocation } from 'react-router-dom'; // NEW: Import useLocation
import CreateBooking from '../components/CreateBooking';
import PendingBookingsReview from '../components/PendingBookingsReview';

export default function CreateBookingPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // NEW: Check the location state to see if we're in date change mode
  const location = useLocation();
  const isDateChangeMode = !!location.state?.originalBookingForDateChange;

  const handleNewBooking = (newPendingBooking) => {
    console.log('New pending booking created, triggering refresh:', newPendingBooking);
    setRefreshKey(prevKey => prevKey + 1);
  };

  return (
    <div className="min-h-screen bg-gray-100 p-4 sm:p-6 lg:p-8">
      <div className="max-w-screen-xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Booking Management</h1>
          <p className="text-gray-600 mt-1">Create new bookings and review those pending for approval.</p>
        </div>

        <div className="mb-12">
          <CreateBooking onBookingCreated={handleNewBooking} />
        </div>

        {/* CHANGED: This entire section will now be hidden during a date change */}
        {!isDateChangeMode && (
          <>
            <div className="border-t border-gray-200 pt-8 mb-6">
                <h2 className="text-2xl font-bold text-gray-900">Pending Bookings for Review</h2>
                <div className="relative mt-4 w-full max-w-lg">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FaSearch className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Search by Ref No, PNR, or Passenger Name..."
                    className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl shadow-lg">
                <PendingBookingsReview searchTerm={searchTerm} refreshKey={refreshKey} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}