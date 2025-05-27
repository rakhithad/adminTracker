import Home from './pages/HomePage';
import AdminPage from './pages/AdminPage';
import BookingsPage from './pages/BookingsPage';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/bookings" element={<BookingsPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
