import React, { useState, useEffect } from 'react';
import { getMyProfile, updateMyProfile } from '../api/api';
import { FaUserCircle, FaSpinner, FaSave, FaPencilAlt } from 'react-icons/fa';

// Reusable Input Component for this page
const ProfileInput = ({ label, ...props }) => (
    <div>
        <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-600">
            {label}
        </label>
        <input
            {...props}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition"
        />
    </div>
);

// Reusable Select Component for this page
const ProfileSelect = ({ label, children, ...props }) => (
    <div>
        <label htmlFor={props.id || props.name} className="block text-sm font-medium text-gray-600">
            {label}
        </label>
        <select
            {...props}
            className="mt-1 w-full p-3 border border-gray-300 rounded-lg shadow-sm focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed transition bg-white"
        >
            {children}
        </select>
    </div>
);


export default function ProfilePage() {
    const [profile, setProfile] = useState(null);
    const [originalProfile, setOriginalProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            try {
                const response = await getMyProfile();
                // ===================================
                // == FIX #1: Correct data access
                // ===================================
                setProfile(response.data);
                setOriginalProfile(response.data);
            } catch (err) {
                setError('Failed to load your profile. Please try refreshing the page.');
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchProfile();
    }, []);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setProfile(prev => ({ ...prev, [name]: value }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');
        setSuccess('');
        try {
            const updateData = {
                title: profile.title,
                firstName: profile.firstName,
                lastName: profile.lastName,
                contactNo: profile.contactNo,
            };
            
            const response = await updateMyProfile(updateData);
            
            // The updateUserById endpoint might return a nested data object, so we check
            const updatedProfileData = response.data.data || response.data;

            setProfile(updatedProfileData);
            setOriginalProfile(updatedProfileData);
            setIsEditing(false);
            setSuccess('Profile updated successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save profile. Please try again.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleCancelEdit = () => {
        setProfile(originalProfile);
        setIsEditing(false);
        setError('');
        setSuccess('');
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center h-64">
                <FaSpinner className="animate-spin h-10 w-10 text-blue-600" />
            </div>
        );
    }
    
    // =============================================================
    // == FIX #2: Add a guard clause to prevent rendering if profile is null
    // =============================================================
    if (!profile) {
        return (
            <div className="text-center p-10">
                <p className="text-red-500">{error || "Could not load profile data."}</p>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                <div className="p-6 sm:p-8">
                    <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-4 sm:space-y-0 sm:space-x-6">
                        <div className="h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center">
                           <FaUserCircle className="h-20 w-20 text-gray-400" />
                        </div>
                        
                        <div className="flex-grow text-center sm:text-left">
                            <h1 className="text-3xl font-bold text-gray-900">
                                {profile.firstName} {profile.lastName}
                            </h1>
                            <p className="text-md text-gray-500">{profile.email}</p>
                            <div className="mt-2 flex justify-center sm:justify-start space-x-2">
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 text-xs font-semibold rounded-full">{profile.role}</span>
                                {profile.team && <span className="px-3 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">{profile.team}</span>}
                            </div>
                        </div>
                    </div>

                    <form onSubmit={handleSave} className="mt-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <ProfileInput label="First Name" name="firstName" value={profile.firstName || ''} onChange={handleInputChange} disabled={!isEditing} required />
                            <ProfileInput label="Last Name" name="lastName" value={profile.lastName || ''} onChange={handleInputChange} disabled={!isEditing} required />
                            <ProfileInput label="Contact No" name="contactNo" placeholder="e.g., +447123456789" value={profile.contactNo || ''} onChange={handleInputChange} disabled={!isEditing} />
                            <ProfileSelect label="Title" name="title" value={profile.title || ''} onChange={handleInputChange} disabled={!isEditing}>
                                <option value="">-- Not Specified --</option>
                                <option value="MR">Mr</option>
                                <option value="MRS">Mrs</option>
                                <option value="MS">Ms</option>
                                <option value="MASTER">Master</option>
                            </ProfileSelect>
                        </div>

                        {success && <p className="text-green-600 mt-4 text-center font-semibold">{success}</p>}
                        {error && <p className="text-red-600 mt-4 text-center font-semibold">{error}</p>}
                        
                        <div className="mt-8 pt-5 border-t border-gray-200 flex justify-end space-x-3">
                            {isEditing ? (
                                <>
                                    <button type="button" onClick={handleCancelEdit} className="px-5 py-2.5 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition">
                                        Cancel
                                    </button>
                                    <button type="submit" disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 disabled:bg-blue-300 flex items-center transition">
                                        {isSaving ? <FaSpinner className="animate-spin -ml-1 mr-3 h-5 w-5" /> : <FaSave className="-ml-1 mr-3 h-5 w-5" />}
                                        {isSaving ? 'Saving...' : 'Save Changes'}
                                    </button>
                                </>
                            ) : (
                                <button type="button" onClick={() => setIsEditing(true)} className="px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 flex items-center transition">
                                    <FaPencilAlt className="-ml-1 mr-3 h-4 w-4" />
                                    Edit Profile
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}