import { useState } from 'react';
import { createBooking } from '../api/api';

export default function CreateBooking() {
  const [formData, setFormData] = useState({
    refNo: '',
    paxName: '',
    agentName: '',
    teamName: '',
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await createBooking(formData);
      console.log(formData);
      alert('Booking created successfully!');
      setFormData({
        refNo: '',
        paxName: '',
        agentName: '',
        teamName: '',
      });
    } catch (error) {
      console.error(error);
      alert('Failed to create booking');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 max-w-md mx-auto">
      <input 
        name="refNo" 
        type="text" 
        placeholder="Reference No" 
        value={formData.refNo} 
        onChange={handleChange}
        required 
      />
      <input 
        name="paxName" 
        type="text" 
        placeholder="Passenger Name" 
        value={formData.paxName} 
        onChange={handleChange}
        required 
      />
      <input 
        name="agentName" 
        type="text" 
        placeholder="Agent Name" 
        value={formData.agentName} 
        onChange={handleChange}
        required 
      />
      <input 
        name="teamName" 
        type="text" 
        placeholder="Team Name" 
        value={formData.teamName} 
        onChange={handleChange}
        required 
      />

      <button type="submit" className="bg-blue-600 text-white py-2 rounded">Create Booking</button>
    </form>
  );
}