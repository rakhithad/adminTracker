import { useNavigate } from 'react-router-dom';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-700">
      <div className="bg-white p-10 rounded-2xl shadow-xl text-center">
        <h1 className="text-3xl font-bold text-gray-800 mb-4">Welcome to the HomePage</h1>
        <p className="text-gray-600 mb-6">View bookings and manage your bookings efficiently.</p>
        <button
          onClick={() => navigate("/dashboard")}
          className="px-6 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition duration-300"
        >
          Go to Admin Panel
        </button>
      </div>
    </div>
  );
}
