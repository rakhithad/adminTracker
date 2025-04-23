import { useState } from 'react';
import { createBooking } from '../api/api';

export default function CreateBooking({ onBookingCreated }) {
  const [formData, setFormData] = useState({
    refNo: '',
    paxName: '',
    agentName: '',
    teamName: '',
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
      const response = await createBooking(formData);
      const newBooking = response.data.data; // Assuming your API returns the created booking
      
      setSuccessMessage('Booking created successfully!');
      onBookingCreated(newBooking);
      
      setFormData({
        refNo: '',
        paxName: '',
        agentName: '',
        teamName: '',
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => setSuccessMessage(''), 3000);
    } catch (error) {
      console.error(error);
      setErrorMessage('Failed to create booking. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-gray-50 p-6 rounded-lg shadow">
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
      
      <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-gray-700 mb-1">Reference No</label>
          <input 
            name="refNo" 
            type="text" 
            placeholder="Reference No" 
            value={formData.refNo} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-1">Passenger Name</label>
          <input 
            name="paxName" 
            type="text" 
            placeholder="Passenger Name" 
            value={formData.paxName} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>
        
        <div>
          <label className="block text-gray-700 mb-1">Agent Name</label>
          <input 
            name="agentName" 
            type="text" 
            placeholder="Agent Name" 
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
            placeholder="Team Name" 
            value={formData.teamName} 
            onChange={handleChange}
            className="w-full p-2 border rounded"
            required 
          />
        </div>

        <button 
          type="submit" 
          className={`py-2 px-4 rounded text-white ${isSubmitting ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Booking'}
        </button>
      </form>
    </div>
  );
}