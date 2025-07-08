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
  createSupplierPaymentSettlement,
  updatePendingBooking,
  recordSettlementPayment,
  getTransactions,
  createCancellation,
} = require('../controllers/bookingController');

router.post('/pending', createPendingBooking);
router.get('/pending', getPendingBookings);
router.put('/pending/:id', updatePendingBooking);
router.post('/pending/:id/approve', approveBooking);
router.post('/pending/:id/reject', rejectBooking);
router.post('/', createBooking);
router.get('/', getBookings);
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/recent', getRecentBookings);
router.get('/customer-deposits', getCustomerDeposits);
router.patch('/instalments/:id', updateInstalment);
router.get('/suppliers-info', getSuppliersInfo);
router.post('/suppliers/settlements', createSupplierPaymentSettlement)
router.post('/:bookingId/record-settlement-payment', recordSettlementPayment);
router.get('/transactions', getTransactions);
router.post('/:id/cancel', createCancellation);
router.put('/:id', updateBooking);


module.exports = router;