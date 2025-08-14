const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth.middleware');

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
  getAvailableCreditNotes,
  createDateChangeBooking,
  createSupplierPayableSettlement,
  settleCustomerPayable,
  recordPassengerRefund
} = require('../controllers/bookingController');


router.post('/pending', authenticateToken, createPendingBooking);
router.get('/pending', authenticateToken, getPendingBookings);
router.put('/pending/:id', authenticateToken, updatePendingBooking);
router.post('/pending/:id/approve', authenticateToken, approveBooking);
router.post('/pending/:id/reject', authenticateToken, rejectBooking);
router.post('/', authenticateToken, createBooking);
router.get('/', authenticateToken, getBookings);
router.get('/dashboard/stats', authenticateToken, getDashboardStats);
router.get('/dashboard/recent', authenticateToken, getRecentBookings);
router.get('/customer-deposits', authenticateToken, getCustomerDeposits);
router.patch('/instalments/:id', authenticateToken, updateInstalment);
router.get('/suppliers-info', authenticateToken, getSuppliersInfo);
router.post('/suppliers/settlements', authenticateToken, createSupplierPaymentSettlement)
router.post('/:bookingId/record-settlement-payment', authenticateToken, recordSettlementPayment);
router.get('/transactions', authenticateToken, getTransactions);
router.post('/:id/cancel', authenticateToken, createCancellation);
router.put('/:id', authenticateToken, updateBooking);
router.get('/credit-notes/available/:supplier', authenticateToken, getAvailableCreditNotes);
router.post('/:id/date-change', authenticateToken, createDateChangeBooking);
router.post('/supplier-payable/settle', authenticateToken, createSupplierPayableSettlement);
router.post('/customer-payable/:id/settle', authenticateToken, settleCustomerPayable);
router.post('/cancellations/:id/record-refund', authenticateToken, recordPassengerRefund);



module.exports = router;