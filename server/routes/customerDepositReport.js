const express = require('express');
const router = express.Router();
const { generateCustomerDepositReport } = require('../controllers/reportsController');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware');

// Add this new route
router.post('/reports/customer-deposits', authenticateToken, authorizeRole(['CONSULTANT','MANAGEMENT','ADMIN', 'SUPER_ADMIN']), generateCustomerDepositReport);

module.exports = router;