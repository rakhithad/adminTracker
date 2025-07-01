import NavigationBar from './components/NavigationBar';
import Home from './pages/HomePage';
import DashboardPage from './pages/DashboardPage';
import BookingsPage from './pages/BookingsPage';
import CreateBooking from './pages/CreateBookingPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerDepositPage from './pages/CustomerDepositsPage';
import SuppliersInfo from './pages/SuppliersInfo';
import TransactionsPage from './pages/TransactionsPage';


function App() {

  return (
    <BrowserRouter>
      <NavigationBar />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/Dashboard" element={<DashboardPage />} />
          <Route path="/bookings" element={<BookingsPage />} />
          <Route path="/customer-deposits" element={<CustomerDepositPage />} />
          <Route path="/suppliers-info" element={<SuppliersInfo />} />
          <Route path="/create-booking" element={<CreateBooking />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          
        </Routes>
      </BrowserRouter>
  )
}

export default App
