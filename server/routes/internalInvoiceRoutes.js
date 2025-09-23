// server/routes/internalInvoiceRoutes.js
const express = require('express');
const router = express.Router();
const {
    getInternalInvoicingReport,
    createInternalInvoice,
    updateInternalInvoice,
    getInvoiceHistoryForBooking,
    downloadInvoicePdf,
} = require('../controllers/internalInvoiceController');
const { authenticateToken } = require('../middleware/auth.middleware.js');

router.get('/', authenticateToken, getInternalInvoicingReport);
router.post('/', authenticateToken, createInternalInvoice);
router.put('/:invoiceId', authenticateToken, updateInternalInvoice);
router.get('/:bookingId/history', authenticateToken, getInvoiceHistoryForBooking);
router.get('/:invoiceId/pdf', authenticateToken, downloadInvoicePdf);

module.exports = router;