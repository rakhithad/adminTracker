import Home from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import BookingsPage from './pages/BookingsPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import CustomerDepositPage from './pages/CustomerDepositsPage';


function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
        <Route path="/customer-deposits" element={<CustomerDepositPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
