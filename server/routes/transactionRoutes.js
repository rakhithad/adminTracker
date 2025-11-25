// server/routes/transactionRoutes.js
const express = require('express');
const router = express.Router();
const { getTransactions, generateTransactionReportPdf } = require('../controllers/transactionController');
const { authenticateToken } = require('../middleware/auth.middleware.js');

router.get('/', authenticateToken, getTransactions);
router.post('/summary-pdf', authenticateToken, generateTransactionReportPdf);

module.exports = router;