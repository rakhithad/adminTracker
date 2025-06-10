import Home from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import BookingsPage from './pages/BookingsPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerDepositPage from './pages/CustomerDepositsPage';
import SuppliersInfo from './pages/SuppliersInfo';


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/customer-deposits" element={<CustomerDepositPage />} />
        <Route path="/suppliers-info" element={<SuppliersInfo />} />
        
      </Routes>
    </BrowserRouter>
  )
}

export default App
