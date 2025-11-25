// server/routes/supplierReportRoutes.js
const express = require('express');
const router = express.Router();
const { generateSupplierReportPdf } = require('../controllers/supplierReportController');
const { authenticateToken } = require('../middleware/auth.middleware');

router.post('/pdf', authenticateToken, generateSupplierReportPdf);

module.exports = router;