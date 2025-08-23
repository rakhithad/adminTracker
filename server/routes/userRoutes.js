
const express = require('express');
const router = express.Router();
const { getMyProfile, updateMyProfile, getAgents, getAllUsers, updateUserById, createUser } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth.middleware.js');


router.post('/create', authenticateToken, createUser); 
router.get('/me', authenticateToken, getMyProfile);
router.put('/me', authenticateToken, updateMyProfile);
router.get('/agents', authenticateToken, getAgents);

router.get('/', authenticateToken, getAllUsers);
router.put('/:id', authenticateToken, updateUserById);

module.exports = router;