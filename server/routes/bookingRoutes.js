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
  getCustomerDeposits,
  updateInstalment,
  getSuppliersInfo,
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
router.get('/customer-deposits', getCustomerDeposits);
router.patch('/instalments/:id', updateInstalment);
router.get('/suppliers-info', getSuppliersInfo);

module.exports = router;