// In routes/auditLog.routes.js

const express = require('express');
const { getAuditHistory } = require('../controllers/auditLogController.js');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware.js');

const router = express.Router();

router.get(
  '/',
  authenticateToken,authorizeRole(['ADMIN', 'MANAGEMENT', 'SUPER_MANAGER', 'SUPER_ADMIN' ]),
  getAuditHistory
);

module.exports = router;