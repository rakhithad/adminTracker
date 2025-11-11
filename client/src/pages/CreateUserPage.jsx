import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaUserPlus, FaSpinner, FaLock, FaUser, FaAddressBook, FaBriefcase } from 'react-icons/fa';
import { createUser } from '../api/api';

// --- STYLED Reusable Form Components ---
const FormInput = ({ label, name, ...rest }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input 
      id={name} 
      name={name} 
      {...rest}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2" 
      style={{'--tw-ring-color': '#0A738A'}} // Brand focus color
    />
  </div>
);

const FormSelect = ({ label, name, children, ...rest }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select 
      id={name} 
      name={name} 
      {...rest}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2"
      style={{'--tw-ring-color': '#0A738A'}} // Brand focus color
    >
      {children}
    </select>
  </div>
);

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
      // ** UX IMPROVEMENT: Pass success message back to management page **
      navigate('/user-management', { 
        state: { success: `User "${formData.firstName} ${formData.lastName}" created successfully!` } 
      });
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create user.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-4xl mx-auto">
        
        <h3 className="text-3xl font-bold mb-6 flex items-center" style={{color: '#2D3E50'}}>
          <FaUserPlus className="mr-3" style={{color: '#0A738A'}} /> Create New User
        </h3>

        <form onSubmit={handleSubmit} className="space-y-8">
          {error && <div className="p-4 bg-red-100 text-red-800 rounded-lg">{error}</div>}

          {/* --- Section 1: Login --- */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
              <FaLock style={{color: '#0A738A'}} /> Login Credentials
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput label="Email Address" name="email" type="email" value={formData.email} onChange={handleChange} required />
              <FormInput label="Password" name="password" type="password" value={formData.password} onChange={handleChange} required />
            </div>
          </fieldset>

          {/* --- Section 2: Personal --- */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
              <FaUser style={{color: '#0A738A'}} /> Personal Details
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormSelect label="Title" name="title" value={formData.title} onChange={handleChange}>
                <option value="MR">Mr</option>
                <option value="MRS">Mrs</option>
                <option value="MS">Ms</option>
                <option value="MASTER">Master</option>
              </FormSelect>
              <FormInput label="First Name" name="firstName" value={formData.firstName} onChange={handleChange} required />
              <FormInput label="Last Name" name="lastName" value={formData.lastName} onChange={handleChange} required />
            </div>
            <FormInput label="Contact No" name="contactNo" value={formData.contactNo} onChange={handleChange} />
          </fieldset>

          {/* --- Section 3: Role --- */}
          <fieldset className="space-y-4">
            <legend className="text-lg font-semibold text-gray-700 border-b border-gray-200 pb-2 mb-4 flex items-center gap-2">
              <FaBriefcase style={{color: '#0A738A'}} /> Team & Role
            </legend>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
          </fieldset>
          
          {/* --- Actions --- */}
          <div className="flex justify-end space-x-4 pt-6 border-t mt-6">
            <button 
              type="button" 
              onClick={() => navigate('/user-management')} 
              className="px-5 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={isSaving} 
              className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-md disabled:bg-opacity-50 flex items-center transition-colors"
              style={{ backgroundColor: '#0A738A' }}
              onMouseOver={e => e.currentTarget.style.backgroundColor = '#085f73'}
              onMouseOut={e => e.currentTarget.style.backgroundColor = '#0A738A'}
            >
              {isSaving && <FaSpinner className="animate-spin mr-2" />}
              {isSaving ? 'Creating...' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}