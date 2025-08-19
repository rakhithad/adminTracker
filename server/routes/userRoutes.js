
const express = require('express');
const router = express.Router();
const { register, login, getMyProfile, updateMyProfile, getAgents, getAllUsers, updateUserById } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth.middleware.js');


router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMyProfile);
router.put('/me', authenticateToken, updateMyProfile);
router.get('/agents', authenticateToken, getAgents);

router.get('/', authenticateToken, getAllUsers);
router.put('/:id', authenticateToken, updateUserById);


module.exports = router;