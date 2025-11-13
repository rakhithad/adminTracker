// server/routes/internalInvoiceRoutes.js
const express = require('express');
const router = express.Router();
const {
    getInternalInvoicingReport,
    createInternalInvoice,
    updateInternalInvoice,
    getInvoiceHistoryForBooking,
    downloadInvoicePdf,
    updateAccountingMonth,
    generateCommissionSummaryPdf
} = require('../controllers/internalInvoiceController');
const { updateCommissionAmount } = require('../controllers/bookingController');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware.js');

router.get('/', authenticateToken, getInternalInvoicingReport);
router.post('/', authenticateToken, createInternalInvoice);
router.put('/accounting-month', authenticateToken, updateAccountingMonth);
router.put('/:invoiceId', authenticateToken, updateInternalInvoice);
router.get('/:recordType/:recordId/history', authenticateToken, getInvoiceHistoryForBooking);
router.get('/:invoiceId/pdf', authenticateToken, downloadInvoicePdf);
router.put('/commission-amount', authenticateToken, updateCommissionAmount);
router.post('/summary-pdf', authenticateToken,authorizeRole(['ADMIN', 'SUPER_ADMIN']), generateCommissionSummaryPdf);


module.exports = router;