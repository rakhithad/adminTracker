
const express = require('express');
const router = express.Router();
const { getMyProfile, updateMyProfile, getAgents, getAllUsers, updateUserById, createUser } = require('../controllers/userController');
const { authenticateToken, authorizeRole } = require('../middleware/auth.middleware.js');


router.post('/create', authenticateToken, createUser); 
router.get('/me', authenticateToken, getMyProfile);
router.put('/me', authenticateToken, updateMyProfile);
router.get('/agents', authenticateToken, authenticateToken,authorizeRole(['ADMIN', 'SUPER_ADMIN']), getAgents);

router.get('/', authenticateToken, authorizeRole(['ADMIN', 'MANAGEMENT', 'SUPER_MANAGER', 'SUPER_ADMIN' ]), getAllUsers);
router.put('/:id', authenticateToken, authorizeRole(['ADMIN', 'MANAGEMENT', 'SUPER_MANAGER', 'SUPER_ADMIN' ]), updateUserById);

module.exports = router;