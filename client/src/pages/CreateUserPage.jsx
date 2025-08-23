// src/pages/CreateUserPage.jsx

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaSpinner } from 'react-icons/fa';
import { createUser } from '../api/api';

const FormInput = ({ label, name, ...rest }) => { // Changed 'props' to 'rest' for clarity
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input 
        id={name} 
        name={name} 
        {...rest} // Spread the 'rest' of the props here
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500" 
      />
    </div>
  );
};

const FormSelect = ({ label, name, children, ...rest }) => { // Changed 'props' to 'rest'
  return (
    <div>
      <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <select 
        id={name} 
        name={name} 
        {...rest} // Spread the 'rest' of the props here
        className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white focus:ring-blue-500"
      >
        {children}
      </select>
    </div>
  );
};

export default function CreateUserPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    firstName: '',
    lastName: '',
    title: 'MR',
    contactNo: '',
    role: 'CONSULTANT',
    team: '',
  });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setError('');
    
    try {
      await createUser(formData);
      alert('User created successfully!');
      navigate('/user-management'); // Redirect to the user list after creation
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-4xl mx-auto">
      <h3 className="text-2xl font-bold mb-6 text-gray-900 flex items-center">
        <FaUserPlus className="mr-3" /> Create New User
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-b pb-6">
          <FormInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required />
          <FormInput label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4">
          <FormSelect label="Title" name="title" value={formData.title} onChange={handleChange}>
            <option value="MR">Mr</option>
            <option value="MRS">Mrs</option>
            <option value="MS">Ms</option>
            <option value="MASTER">Master</option>
          </FormSelect>
          <FormInput label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
          <FormInput label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
          <FormInput label="Contact No" name="contactNo" value={formData.contactNo} onChange={handleChange} />
          <FormSelect label="Role" name="role" value={formData.role} onChange={handleChange} required>
            <option value="CONSULTANT">Consultant</option>
            <option value="MANAGEMENT">Management</option>
            <option value="ADMIN">Admin</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </FormSelect>
          <FormSelect label="Team" name="team" value={formData.team} onChange={handleChange}>
            <option value="">No Team</option>
            <option value="PH">PH</option>
            <option value="TOURS">TOURS</option>
            <option value="MARKETING">Marketing</option>
            <option value="QC">QC</option>
            <option value="IT">IT</option>
          </FormSelect>
        </div>
        
        <div className="flex justify-end space-x-4 pt-6 border-t mt-6">
          <button type="button" onClick={() => navigate('/user-management')} className="px-5 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">
            Cancel
          </button>
          <button type="submit" disabled={isSaving} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center">
            {isSaving && <FaSpinner className="animate-spin mr-2" />}
            {isSaving ? 'Creating...' : 'Create User'}
          </button>
        </div>
      </form>
    </div>
  );
}