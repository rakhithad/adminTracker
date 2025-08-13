// In routes/auditLog.routes.js

const express = require('express');
const { getAuditHistory } = require('../controllers/auditLogController.js');
// Assuming your auth middleware also uses CommonJS. If not, we'll fix it.
const { authenticateToken } = require('../middleware/auth.middleware.js');

const router = express.Router();

router.get(
  '/',
  authenticateToken,
  getAuditHistory
);

module.exports = router;