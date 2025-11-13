const express = require('express');
const router = express.Router();
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

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
  recordPassengerRefund,
  voidBooking,
  unvoidBooking,
  generateInvoice,
  updateAccountingMonth,
  updateCommissionAmount,
  getCustomerCreditNotes,
  getAttentionBookings,
  getOverdueBookings
} = require('../controllers/bookingController');


router.post('/pending', authenticateToken, createPendingBooking);
router.get('/pending', authenticateToken,authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']), getPendingBookings);
router.put('/pending/:id', authenticateToken,authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']), updatePendingBooking);
router.post('/pending/:id/approve', authenticateToken,authorizeRole(['ADMIN', 'SUPER_ADMIN']), approveBooking);
router.post('/pending/:id/reject', authenticateToken,authorizeRole(['ADMIN', 'SUPER_ADMIN']), rejectBooking);
router.post('/', authenticateToken, createBooking);
router.get('/', authenticateToken, authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']), getBookings);

router.get('/dashboard/stats', authenticateToken, authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']),  getDashboardStats);
router.get('/dashboard/attention-bookings',authenticateToken, authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']), getAttentionBookings);
router.get('/dashboard/overdue-bookings',authenticateToken, authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']), getOverdueBookings);

router.get('/dashboard/recent', authenticateToken, getRecentBookings);
router.get('/customer-deposits', authenticateToken, getCustomerDeposits);
router.patch('/instalments/:id', authenticateToken, updateInstalment);
router.get('/suppliers-info', authenticateToken, getSuppliersInfo);
router.post('/suppliers/settlements', authenticateToken, createSupplierPaymentSettlement)
router.post('/:bookingId/record-settlement-payment', authenticateToken, recordSettlementPayment);
router.get('/transactions', authenticateToken, getTransactions);
router.post('/:id/cancel', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), createCancellation);
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), updateBooking);
router.get('/credit-notes/available/:supplier', authenticateToken, getAvailableCreditNotes);
router.post('/:id/date-change', authenticateToken, createDateChangeBooking);
router.post('/supplier-payable/settle', authenticateToken, createSupplierPayableSettlement);
router.post('/customer-payable/:id/settle', authenticateToken, settleCustomerPayable);
router.post('/cancellations/:id/record-refund', authenticateToken, recordPassengerRefund);
router.post('/:id/void', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), voidBooking);
router.post('/:id/unvoid', authenticateToken, authorizeRole(['ADMIN', 'SUPER_ADMIN']), unvoidBooking);

router.post('/:id/invoice', authenticateToken, generateInvoice);
router.put('/:id/accounting-month', authenticateToken, updateAccountingMonth);
router.put('/:id/commission-amount', authenticateToken, updateCommissionAmount);

router.get('/credit-notes/customer', authenticateToken, getCustomerCreditNotes);



module.exports = router;