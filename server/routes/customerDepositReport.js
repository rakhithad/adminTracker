const express = require('express');
const router = express.Router();
const { generateCustomerDepositReport } = require('../controllers/reportsController');
const { authenticateToken } = require('../middleware/auth.middleware');

// Add this new route
router.post('/reports/customer-deposits', authenticateToken, generateCustomerDepositReport);

module.exports = router;