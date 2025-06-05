import { useState, useEffect } from 'react';

export default function PaxDetailsPopup({ initialData, numPax, onClose, onSubmit }) {
  const [passengers, setPassengers] = useState(
    initialData.passengers?.length > 0
      ? initialData.passengers
      : Array.from({ length: numPax }, () => ({
          title: '',
          firstName: '',
          middleName: '',
          lastName: '',
          gender: '',
          email: '',
          contactNo: '',
          country: '',
          category: '',
        }))
  );
  const [errorMessage, setErrorMessage] = useState('');
  const [isValid, setIsValid] = useState(false);

  // Validate passenger data
  useEffect(() => {
    const isValid = passengers.every(
      (pax) =>
        pax.title &&
        pax.firstName &&
        pax.lastName &&
        pax.gender &&
        pax.category &&
        (!pax.email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) &&
        (!pax.contactNo || /^\+?\d{10,15}$/.test(pax.contactNo))
    );
    setIsValid(isValid);
    setErrorMessage(
      isValid ? '' : 'Please fill in all required fields correctly for all passengers.'
    );
  }, [passengers]);

  const handleChange = (index, field, value) => {
    const updatedPassengers = [...passengers];
    updatedPassengers[index] = { ...updatedPassengers[index], [field]: value };
    setPassengers(updatedPassengers);
  };

  const handleSubmit = () => {
    if (!isValid) return;

    const paxName = passengers
      .map((pax) => `${pax.title} ${pax.firstName} ${pax.lastName}`)
      .join(', ');
    onSubmit({ passengers, paxName });
  };

  const handleCancel = () => {
    setPassengers(
      Array.from({ length: numPax }, () => ({
        title: '',
        firstName: '',
        middleName: '',
        lastName: '',
        gender: '',
        email: '',
        contactNo: '',
        country: '',
        category: '',
      }))
    );
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl shadow-xl overflow-y-auto max-h-[80vh]">
        <h3 className="text-lg font-semibold mb-4 text-center text-gray-800">Passenger Details</h3>

        {errorMessage && (
          <div className="mb-4 p-2 bg-red-100 text-red-600 rounded-lg">{errorMessage}</div>
        )}

        {passengers.map((pax, index) => (
          <div key={index} className="mb-6 border-b pb-4">
            <h4 className="text-md font-medium mb-2">Passenger {index + 1}</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-gray-700 mb-1">Title*</label>
                <select
                  value={pax.title}
                  onChange={(e) => handleChange(index, 'title', e.target.value)}
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
                  value={pax.firstName}
                  onChange={(e) => handleChange(index, 'firstName', e.target.value)}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Middle Name</label>
                <input
                  type="text"
                  value={pax.middleName}
                  onChange={(e) => handleChange(index, 'middleName', e.target.value)}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Last Name*</label>
                <input
                  type="text"
                  value={pax.lastName}
                  onChange={(e) => handleChange(index, 'lastName', e.target.value)}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Gender*</label>
                <select
                  value={pax.gender}
                  onChange={(e) => handleChange(index, 'gender', e.target.value)}
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
                  value={pax.category}
                  onChange={(e) => handleChange(index, 'category', e.target.value)}
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
                  value={pax.email}
                  onChange={(e) => handleChange(index, 'email', e.target.value)}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                />
              </div>
              <div>
                <label className="block text-gray-700 mb-1">Contact Number</label>
                <input
                  type="text"
                  value={pax.contactNo}
                  onChange={(e) => handleChange(index, 'contactNo', e.target.value)}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                  placeholder="+1234567890"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-gray-700 mb-1">Country</label>
                <input
                  type="text"
                  value={pax.country}
                  onChange={(e) => handleChange(index, 'country', e.target.value)}
                  className="w-full p-2 bg-gray-100 border rounded-lg"
                />
              </div>
            </div>
          </div>
        ))}

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