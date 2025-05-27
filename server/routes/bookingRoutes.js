const express = require('express');
const router = express.Router();
const {
  createPendingBooking,
  getPendingBookings,
  approveBooking,
  rejectBooking,
  createBooking,
  getBookings,
  updateBooking,
  getDashboardStats,
  getRecentBookings,
} = require('../controllers/bookingController');

router.post('/pending', createPendingBooking);
router.get('/pending', getPendingBookings);
router.post('/pending/:id/approve', approveBooking);
router.post('/pending/:id/reject', rejectBooking);
router.post('/', createBooking);
router.get('/', getBookings);
router.put('/:id', updateBooking);
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/recent', getRecentBookings);

module.exports = router;