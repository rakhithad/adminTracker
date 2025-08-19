import { useState, useEffect } from 'react';
import { FaEdit, FaTimesCircle, FaCheckCircle, FaSpinner } from 'react-icons/fa';
// Make sure to import the correct functions from your api.js file
import { getAllUsers, updateUserById } from '../api/api';

// Reusable form components for consistency
const FormInput = ({ label, name, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <input id={name} name={name} {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500" />
  </div>
);

const FormSelect = ({ label, name, children, ...props }) => (
  <div>
    <label htmlFor={name} className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
    <select id={name} name={name} {...props} className="w-full px-3 py-2 border border-gray-300 rounded-lg shadow-sm bg-white focus:ring-blue-500">
      {children}
    </select>
  </div>
);


export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState(null); // User being edited
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        setIsLoading(true);
        const response = await getAllUsers();
        setUsers(response.data.data); // Adjust if your apiResponse structure is different
      } catch (err) {
        setError(err.response?.data?.message || 'Failed to fetch users.');
      } finally {
        setIsLoading(false);
      }
    };
    fetchUsers();
  }, []);

  const handleEditClick = (user) => {
    setSelectedUser({ ...user }); // Create a copy to edit
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
        // Uses the `updateUserById` function from your api.js
        const response = await updateUserById(selectedUser.id, selectedUser);
        setSuccess(response.data.message || 'User updated successfully!');

        // Update the main user list with the newly saved data
        setUsers(users.map(user => user.id === selectedUser.id ? response.data.data : user));
        setSelectedUser(null); // Close the edit form

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
    <div className="bg-white p-6 sm:p-8 rounded-xl shadow-lg w-full">
      <h3 className="text-2xl font-bold mb-6 text-gray-900">User Management</h3>

      {error && <div className="mb-6 p-4 bg-red-100 text-red-800 rounded-lg"><FaTimesCircle className="inline mr-3" />{error}</div>}
      {success && <div className="mb-6 p-4 bg-green-100 text-green-800 rounded-lg"><FaCheckCircle className="inline mr-3" />{success}</div>}

      {/* Edit Form Section */}
      {selectedUser && (
        <div className="mb-8 p-6 bg-gray-50 rounded-lg shadow-inner border animate-fade-in">
          <h4 className="text-xl font-semibold mb-4">Editing: {selectedUser.firstName} {selectedUser.lastName}</h4>
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <FormInput label="First Name" name="firstName" value={selectedUser.firstName} onChange={handleFormChange} required />
              <FormInput label="Last Name" name="lastName" value={selectedUser.lastName} onChange={handleFormChange} required />
              <FormInput label="Email (Read-only)" name="email" value={selectedUser.email} readOnly disabled className="bg-gray-200 cursor-not-allowed" />
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
              <button type="button" onClick={handleCancelEdit} className="px-5 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400">Cancel</button>
              <button type="submit" disabled={isSaving} className="px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300">
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Users Table */}
      <div className="overflow-x-auto bg-white rounded-lg shadow">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Role & Team</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase">Contact</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-600 uppercase">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-gray-50">
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{user.firstName} {user.lastName}</div>
                  <div className="text-sm text-gray-500">{user.email}</div>
                </td>
                <td className="px-6 py-4">
                  <div className="text-sm font-medium text-gray-900">{user.role}</div>
                  <div className="text-sm text-gray-500">{user.team || 'N/A'}</div>
                </td>
                <td className="px-6 py-4 text-sm text-gray-700">{user.contactNo || 'N/A'}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleEditClick(user)} className="text-indigo-600 hover:text-indigo-900 text-sm font-medium flex items-center gap-1">
                    <FaEdit /> Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}