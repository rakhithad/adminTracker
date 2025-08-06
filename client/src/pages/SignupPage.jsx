// src/pages/SignupPage.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { registerUser } from '../api/api';

const SignupPage = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    contactNo: '',
    title: 'MR', // Default value
    role: 'CONSULTANT', // Default value
    team: 'PH', // Default value
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await registerUser(formData);
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during sign up.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="w-full max-w-lg p-8 space-y-8 bg-white rounded-lg shadow-md">
        <h2 className="text-2xl font-bold text-center text-gray-800">Create a New Account</h2>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Title and Role are dropdowns */}
            <div className="rounded-md shadow-sm">
                <label htmlFor="title" className="block text-sm font-medium text-gray-700">Title</label>
                <select id="title" name="title" value={formData.title} onChange={handleChange} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <option>MR</option>
                    <option>MRS</option>
                    <option>MS</option>
                    <option>MASTER</option>
                </select>
            </div>
             <div className="rounded-md shadow-sm">
                <label htmlFor="role" className="block text-sm font-medium text-gray-700">Role</label>
                <select id="role" name="role" value={formData.role} onChange={handleChange} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <option>CONSULTANT</option>
                    <option>MANAGEMENT</option>
                    <option>SUPER_MANAGER</option>
                    <option>SUPER_ADMIN</option>
                </select>
            </div>
            {/* Other text inputs */}
            <input name="firstName" type="text" required value={formData.firstName} onChange={handleChange} placeholder="First Name" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <input name="lastName" type="text" required value={formData.lastName} onChange={handleChange} placeholder="Last Name" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <input name="email" type="email" required value={formData.email} onChange={handleChange} placeholder="Email Address" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <input name="password" type="password" required value={formData.password} onChange={handleChange} placeholder="Password" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
            <input name="contactNo" type="text" value={formData.contactNo} onChange={handleChange} placeholder="Contact No (Optional)" className="w-full px-3 py-2 border border-gray-300 rounded-md" />
             <div className="rounded-md shadow-sm">
                <label htmlFor="team" className="block text-sm font-medium text-gray-700">Team</label>
                <select id="team" name="team" value={formData.team} onChange={handleChange} className="w-full px-3 py-2 mt-1 border border-gray-300 rounded-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500">
                    <option>PH</option>
                    <option>TOURS</option>
                    <option>MARKETING</option>
                    <option>QC</option>
                    <option>IT</option>
                </select>
            </div>
          </div>

          {error && <p className="text-sm text-center text-red-500">{error}</p>}
          
          <div>
            <button type="submit" disabled={loading} className="w-full px-4 py-2 font-bold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:bg-indigo-400">
              {loading ? 'Signing Up...' : 'Sign Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SignupPage;