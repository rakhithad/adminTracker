import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, } from 'react-router-dom';
import { supabase } from './supabaseClient';
import Home from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import CreateBooking from './pages/CreateBookingPage';
import CustomerDepositPage from './pages/CustomerDepositsPage';
import SuppliersInfo from './pages/SuppliersInfo';
import TransactionsPage from './pages/TransactionsPage';
import ProfilePage from './pages/ProfilePage';
import UserManagementPage from './pages/UserManagementPage';
import AuthPage from './components/Auth';
import CreateUserPage from './pages/CreateUserPage';
import NavigationBar from './components/NavigationBar';     
import InternalInvoicingPage from './pages/InternalInvoicingPage';  
import ReportsPage from './pages/ReportsPage';



const ProtectedRoutes = ({ session }) => {
  if (!session) {
    return <Navigate to="/auth" />;
  } return (
    <>
      <NavigationBar />
      <main className="p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </>
  );
};

const PublicRoutes = ({ session }) => {
  return session ? <Navigate to="/" /> : <Outlet />;
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicRoutes session={session} />}>
          <Route path="/auth" element={<AuthPage />} />
        </Route>

        <Route element={<ProtectedRoutes session={session} />}>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/customer-deposits" element={<CustomerDepositPage />} />
          <Route path="/suppliers-info" element={<SuppliersInfo />} />
          <Route path="/create-booking" element={<CreateBooking />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/user-management" element={<UserManagementPage />} />
          <Route path="/create-user" element={<CreateUserPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/reports/internal-invoicing" element={<InternalInvoicingPage />} />
        </Route>
        
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;