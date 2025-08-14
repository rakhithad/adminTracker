import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';

import NavigationBar from './components/NavigationBar';
import Home from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import CreateBooking from './pages/CreateBookingPage';
import CustomerDepositPage from './pages/CustomerDepositsPage';
import SuppliersInfo from './pages/SuppliersInfo';
import TransactionsPage from './pages/TransactionsPage';
import LoginPage from './pages/LoginPage'; 
import SignupPage from './pages/SignupPage'; 
import ProfilePage from './pages/ProfilePage'

const ProtectedRoutes = () => {
  const isAuthenticated = !!localStorage.getItem('token'); // Check if the token exists

  // If the user is authenticated, render the main layout with the navigation bar
  // and the requested page (via the <Outlet /> component).
  if (isAuthenticated) {
    return (
      <>
        <NavigationBar />
        <main className="p-4 sm:p-6 lg:p-8"> {/* Optional: Add padding to your main content area */}
          <Outlet /> {/* This renders the child route's element */}
        </main>
      </>
    );
  }

  // If the user is not authenticated, redirect them to the login page.
  return <Navigate to="/login" />;
};


// ===================================================================
// == 2. CREATE A PUBLIC ROUTE COMPONENT (Optional but good practice)
// ===================================================================
// This prevents a logged-in user from seeing the login/signup pages.
const PublicRoutes = () => {
  const isAuthenticated = !!localStorage.getItem('token');

  // If user is already logged in, redirect them to the home page.
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  // Otherwise, show the requested public page (login or signup).
  return <Outlet />;
};

// ===================================================================
// == 3. UPDATE THE MAIN APP COMPONENT WITH THE NEW ROUTING LOGIC
// ===================================================================
function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* --- Public Routes (Login, Signup) --- */}
        {/* These routes are for users who are NOT logged in. */}
        <Route element={<PublicRoutes />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        {/* --- Protected Routes (Your Main Application) --- */}
        {/* These routes are guarded. Only logged-in users can access them. */}
        {/* The NavigationBar will only appear on these pages. */}
        <Route element={<ProtectedRoutes />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/customer-deposits" element={<CustomerDepositPage />} />
          <Route path="/suppliers-info" element={<SuppliersInfo />} />
          <Route path="/create-booking" element={<CreateBooking />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Route>
        
        {/* --- Catch-all Route --- */}
        {/* If no other route matches, redirect to the home page. */}
        {/* The logic within ProtectedRoutes will handle redirection to /login if needed. */}
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;