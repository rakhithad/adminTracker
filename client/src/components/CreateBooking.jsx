import { useState } from 'react';
import { createBooking } from '../api/api';

export default function CreateBooking({ onBookingCreated }) {
  const [formData, setFormData] = useState({
    refNo: '',
    paxName: '',
    agentName: '',
    teamName: '',
    pnr: '',
    airline: '',
    fromTo: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      
      const bookingData = {
        ref_no: formData.refNo,
        pax_name: formData.paxName,
        agent_name: formData.agentName,
        team_name: formData.teamName || null, 
        pnr: formData.pnr,
        airline: formData.airline,
        from_to: formData.fromTo
      };

      const response = await createBooking(bookingData);
      const newBooking = response.data.data;
      
      setSuccessMessage('Booking created successfully!');
      onBookingCreated(newBooking);
      
      // Reset form
      setFormData({
        refNo: '',
        paxName: '',
        agentName: '',
        teamName: '',
        pnr: '',
        airline: '',
        fromTo: ''
      });
      
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error('Booking creation error:', error);
      setErrorMessage(error.response?.data?.message || 'Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-200 p-6 rounded-lg shadow">
      <h3 className="text-xl font-semibold mb-4 text-gray-800">Create New Booking</h3>
      
      {successMessage && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded">
          {successMessage}
        </div>
      )}
      
      {errorMessage && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded">
          {errorMessage}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-gray-700 mb-1">Reference No*</label>
          <input 
            name="refNo" 
            type="text" 
            value={formData.refNo} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-1">Passenger Name*</label>
          <input 
            name="paxName" 
            type="text" 
            value={formData.paxName} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-1">Agent Name*</label>
          <input 
            name="agentName" 
            type="text" 
            value={formData.agentName} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-1">Team Name</label>
          <input 
            name="teamName" 
            type="text" 
            value={formData.teamName} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">PNR*</label>
          <input 
            name="pnr" 
            type="text" 
            value={formData.pnr} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>

        <div>
          <label className="block text-gray-700 mb-1">Airline*</label>
          <input 
            name="airline" 
            type="text" 
            value={formData.airline} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>

        <div className="md:col-span-2">
          <label className="block text-gray-700 mb-1">From/To*</label>
          <input 
            name="fromTo" 
            type="text" 
            placeholder="e.g., NYC-LON"
            value={formData.fromTo} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>

        <div className="md:col-span-2">
          <button 
            type="submit" 
            className={`py-2 px-4 rounded text-white ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
            disabled={isSubmitting}
          >
            {isSubmitting ? 'Creating...' : 'Create Booking'}
          </button>
        </div>
      </form>
    </div>
  );
}