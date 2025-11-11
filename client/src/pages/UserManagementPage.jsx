import { useState, useEffect } from 'react';
import { FaEdit, FaTimesCircle, FaCheckCircle, FaSpinner, FaPlus, FaSave } from 'react-icons/fa';
import { Link, useLocation } from 'react-router-dom'; // Import useLocation
import { getAllUsers, updateUserById } from '../api/api';


const FormInput = ({ label, name, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input 
      id={name} 
      name={name} 
      {...props} 
      className={`w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm focus:outline-none focus:ring-2 ${props.disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
      style={{'--tw-ring-color': '#0A738A'}} // Brand focus color
    />
  </div>
);

const FormSelect = ({ label, name, children, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select 
      id={name} 
      name={name} 
      {...props} 
      className="w-full px-4 py-2 border border-gray-300 rounded-lg shadow-sm bg-white focus:outline-none focus:ring-2"
      style={{'--tw-ring-color': '#0A738A'}} // Brand focus color
    >
      {children}
    </select>
  </div>
);

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const location = useLocation(); // Get location object

  useEffect(() => {
    // Check for a success message from the create page
    if (location.state?.success) {
      setSuccess(location.state.success);
      // Clear the state so the message doesn't reappear
      window.history.replaceState({}, document.title) 
    }

    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await getAllUsers();
        setUsers(response.data.data);
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, [location.state]); // Re-run if location state changes

  const handleEditClick = (user) => {
    setSelectedUser({ ...user });
    setSuccess('');
    setError('');
  };

  const handleCancelEdit = () => {
    setSelectedUser(null);
  };

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    setSelectedUser(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async (e) => {
    e.preventDefault();
    if (!selectedUser) return;

    setIsSaving(true);
    setError('');
    setSuccess('');

    try {
      const response = await updateUserById(selectedUser.id, selectedUser);
      setSuccess(response.data.message || 'User updated successfully!');
      setUsers(users.map(user => user.id === selectedUser.id ? response.data.data : user));
      setSelectedUser(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to update user.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <FaSpinner className="animate-spin text-blue-500 text-4xl" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8" style={{ backgroundColor: '#F9FAFB', minHeight: '100vh' }}>
      <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full max-w-7xl mx-auto">
        
        <div className="flex flex-wrap justify-between items-center mb-6 gap-4">
          <h3 className="text-3xl font-bold" style={{color: '#2D3E50'}}>User Management</h3>
          <Link 
            to="/create-user"
            className="flex items-center gap-2 px-5 py-2.5 text-white font-semibold rounded-lg shadow-md transition-colors"
            style={{ backgroundColor: '#0A738A' }} // Brand secondary color
            onMouseOver={e => e.currentTarget.style.backgroundColor = '#085f73'}
            onMouseOut={e => e.currentTarget.style.backgroundColor = '#0A738A'}
          >
            <FaPlus />
            Add New User
          </Link>
        </div>

        {error && <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg"><FaTimesCircle className="inline mr-3" />{error}</div>}
        {success && <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg"><FaCheckCircle className="inline mr-3" />{success}</div>}

        {/* Edit Form Section */}
        {selectedUser && (
          <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner border animate-fade-in">
            <h4 className="text-xl font-semibold mb-5">Editing: <span className="font-bold" style={{color: '#0A738A'}}>{selectedUser.firstName} {selectedUser.lastName}</span></h4>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <FormInput label="First Name" name="firstName" value={selectedUser.firstName} onChange={handleFormChange} required />
                <FormInput label="Last Name" name="lastName" value={selectedUser.lastName} onChange={handleFormChange} required />
                <FormInput label="Email (Read-only)" name="email" value={selectedUser.email} readOnly disabled />
                <FormInput label="Contact No" name="contactNo" value={selectedUser.contactNo || ''} onChange={handleFormChange} />
                <FormSelect label="Role" name="role" value={selectedUser.role} onChange={handleFormChange} required>
                  <option value="CONSULTANT">Consultant</option>
                  <option value="MANAGEMENT">Management</option>
                  <option value="ADMIN">Admin</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </FormSelect>
                <FormSelect label="Team" name="team" value={selectedUser.team || ''} onChange={handleFormChange}>
                  <option value="">No Team</option>
                  <option value="PH">PH</option>
                  <option value="TOURS">TOURS</option>
                  <option value="MARKETING">Marketing</option>
                  <option value="QC">QC</option>
                  <option value="IT">IT</option>
                </FormSelect>
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button type="button" onClick={handleCancelEdit} className="px-5 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors">Cancel</button>
                <button 
                  type="submit" 
                  disabled={isSaving} 
                  className="px-5 py-2.5 text-white font-semibold rounded-lg shadow-md disabled:bg-opacity-50 flex items-center transition-colors"
                  style={{ backgroundColor: '#0A738A' }}
                  onMouseOver={e => e.currentTarget.style.backgroundColor = '#085f73'}
                  onMouseOut={e => e.currentTarget.style.backgroundColor = '#0A738A'}
                >
                  {isSaving ? <FaSpinner className="animate-spin mr-2" /> : <FaSave className="mr-2" />}
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Users Table */}
        <div className="overflow-x-auto bg-white rounded-lg shadow border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role & Team</th>
                <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Contact</th>
                <th className="px-6 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {users.map(user => (
                <tr key={user.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                    <div className="text-sm text-gray-500">{user.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-2.5 py-0.5 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                      {user.role}
                    </span>
                    <div className="text-sm text-gray-500 mt-1">{user.team || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{user.contactNo || 'N/A'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button 
                      onClick={() => handleEditClick(user)} 
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold text-white shadow-sm transition-colors"
                      style={{ backgroundColor: '#0A738A' }}
                      onMouseOver={e => e.currentTarget.style.backgroundColor = '#085f73'}
                      onMouseOut={e => e.currentTarget.style.backgroundColor = '#0A738A'}
                    >
                      <FaEdit /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

