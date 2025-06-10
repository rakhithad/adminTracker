import { useState } from 'react';
import CreateBooking from '../components/CreateBooking';
import PendingBookingsReview from '../components/PendingBookingsReview';

export default function CreateBookingPage() {
  const [searchTerm, setSearchTerm] = useState('');

  const handleNewBooking = (newPendingBooking) => {
    console.log('New pending booking created:', newPendingBooking);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-10">
      <div className="max-w-full mx-auto">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-800">Booking Management</h1>
          <p className="text-gray-600 mt-1">Create and review pending bookings</p>
        </div>

        {/* Create Booking Form */}
        <div className="mb-10">
          <CreateBooking onBookingCreated={handleNewBooking} />
        </div>

        {/* Search Box */}
        <div className="relative mt-6 mb-5 w-full max-w-xl">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search pending bookings..."
            className="block w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Pending Bookings Table */}
        <PendingBookingsReview searchTerm={searchTerm} />
      </div>
    </div>
  );
}