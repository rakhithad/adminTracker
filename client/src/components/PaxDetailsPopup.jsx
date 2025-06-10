import { useState, useEffect } from 'react';

export default function PaxDetailsPopup({ initialData, onClose, onSubmit }) {
  const [numPax, setNumPax] = useState(initialData.numPax || 1);
  const [passenger, setPassenger] = useState({
    title: initialData.passenger?.title || '',
    firstName: initialData.passenger?.firstName || '',
    middleName: initialData.passenger?.middleName || '',
    lastName: initialData.passenger?.lastName || '',
    gender: initialData.passenger?.gender || '',
    email: initialData.passenger?.email || '',
    contactNo: initialData.passenger?.contactNo || '',
    country: initialData.passenger?.country || '',
    category: initialData.passenger?.category || '',
  });
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Validate passenger data
  useEffect(() => {
    const isValid =
      passenger.title &&
      passenger.firstName &&
      passenger.lastName &&
      passenger.gender &&
      passenger.category &&
      (!passenger.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(passenger.email)) &&
      (!passenger.contactNo || /^\+?\d{10,15}$/.test(passenger.contactNo));
    setIsValid(isValid);
    setErrorMessage(
      isValid ? '' : 'Please fill in all required fields correctly.'
    );
  }, [passenger]);

  const handleChange = (field, value) => {
    setPassenger((prev) => ({ ...prev, [field]: value }));
  };

  const handleNumPaxChange = (e) => {
    const value = parseInt(e.target.value);
    if (value >= 1 && value <= 10) {
      setNumPax(value);
    }
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const paxName = `${passenger.title}. ${passenger.lastName}/${passenger.middleName ? passenger.middleName + ' ' : ''}${passenger.firstName}`;
    onSubmit({ passenger, paxName, numPax });
  };

  const handleCancel = () => {
    setPassenger({
      title: '',
      firstName: '',
      middleName: '',
      lastName: '',
      gender: '',
      email: '',
      contactNo: '',
      country: '',
      category: '',
    });
    setNumPax(1);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Lead Passenger Details</h3>

        <div className="mb-4">
          <label className="block text-gray-700 mb-1">Number of Passengers*</label>
          <select
            value={numPax}
            onChange={handleNumPaxChange}
            className="w-full p-2 bg-gray-100 border rounded-lg"
            required
          >
            {[...Array(10).keys()].map((i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}
              </option>
            ))}
          </select>
        </div>

        {errorMessage && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-gray-700 mb-1">Title*</label>
            <select
              value={passenger.title}
              onChange={(e) => handleChange('title', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            >
              <option value="">Select Title</option>
              <option value="MR">Mr</option>
              <option value="MRS">Mrs</option>
              <option value="MS">Ms</option>
              <option value="MASTER">Master</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">First Name*</label>
            <input
              type="text"
              value={passenger.firstName}
              onChange={(e) => handleChange('firstName', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Middle Name</label>
            <input
              type="text"
              value={passenger.middleName}
              onChange={(e) => handleChange('middleName', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Last Name*</label>
            <input
              type="text"
              value={passenger.lastName}
              onChange={(e) => handleChange('lastName', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Gender*</label>
            <select
              value={passenger.gender}
              onChange={(e) => handleChange('gender', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            >
              <option value="">Select Gender</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Category*</label>
            <select
              value={passenger.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              required
            >
              <option value="">Select Category</option>
              <option value="ADULT">Adult</option>
              <option value="CHILD">Child</option>
              <option value="INFANT">Infant</option>
            </select>
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={passenger.email}
              onChange={(e) => handleChange('email', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-gray-700 mb-1">Contact Number</label>
            <input
              type="text"
              value={passenger.contactNo}
              onChange={(e) => handleChange('contactNo', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
              placeholder="+1234567890"
            />
          </div>
          <div className="md:col-span-2">
            <label className="block text-gray-700 mb-1">Country</label>
            <input
              type="text"
              value={passenger.country}
              onChange={(e) => handleChange('country', e.target.value)}
              className="w-full p-2 bg-gray-100 border rounded-lg"
            />
          </div>
        </div>

        <div className="flex justify-end space-x-2 mt-6">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!isValid}
            className={`px-4 py-2 rounded-lg text-white ${
              isValid ? 'bg-green-600 hover:bg-green-700' : 'bg-gray-400 cursor-not-allowed'
            }`}
          >
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}