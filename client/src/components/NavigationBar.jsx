import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { supabase } from '../supabaseClient'; // 👈 1. Import the Supabase client

export default function NavigationBar() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  // 👈 2. The entire handleLogout function is updated
  const handleLogout = async () => {
    // Make the function async to await the sign-out process
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error signing out:", error.message);
      // Optionally, show an error alert to the user
    }
    
    // The onAuthStateChange listener in App.jsx will automatically handle the state
    // update, which will cause the ProtectedRoutes to redirect to /auth.
    // Navigating here explicitly ensures the redirect is immediate.
    navigate('/auth');

    // Close the mobile menu after logging out
    setIsMobileMenuOpen(false);
  };

  const navLinks = [
    { name: 'Home', path: '/' },
    { name: 'Dashboard', path: '/Dashboard' },
    { name: 'Create Booking', path: '/create-booking' },
    { name: 'Bookings', path: '/bookings' },
    { name: 'Customer Deposits', path: '/customer-deposits' },
    { name: 'Supplier Info', path: '/suppliers-info' },
    { name: 'User Management', path: '/user-management' },
    { name: 'My Profile', path: '/profile' },
    { name: 'Reports', path: '/reports' },
  ];

  return (
    <nav className="bg-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-24">
          <div className="flex items-center">
            <img
              src={logo}
              alt="11th Street Travel Logo"
              className="h-24 w-auto"
            />
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center space-x-4">
            {navLinks.map((link) => (
              <NavLink
                key={link.path}
                to={link.path}
                className={({ isActive }) =>
                  `px-3 py-2 rounded-md text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'
                  }`
                }
              >
                {link.name}
              </NavLink>
            ))}
            {/* Logout Button for Desktop */}
            <button
              onClick={handleLogout} // This button now calls the new async function
              className="px-3 py-2 rounded-md text-sm font-medium text-red-700 hover:bg-red-100 hover:text-red-800 transition-colors duration-200"
            >
              Logout
            </button>
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden flex items-center">
            <button
              onClick={toggleMobileMenu}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-blue-600 hover:bg-gray-100 focus:outline-none"
              aria-label="Toggle menu"
            >
              <svg className={`${isMobileMenuOpen ? 'hidden' : 'block'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /> </svg>
              <svg className={`${isMobileMenuOpen ? 'block' : 'hidden'} h-6 w-6`} xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"> <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /> </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div className={`${isMobileMenuOpen ? 'block' : 'hidden'} md:hidden`}>
        <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3">
          {navLinks.map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              className={({ isActive }) => `block px-3 py-2 rounded-md text-base font-medium transition-colors duration-200 ${ isActive ? 'bg-blue-600 text-white' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600' }`}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              {link.name}
            </NavLink>
          ))}
          {/* Logout Button for Mobile */}
          <button
            onClick={handleLogout} // This button also calls the new async function
            className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-red-700 hover:bg-red-100 hover:text-red-800 transition-colors duration-200"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}