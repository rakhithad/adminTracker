
const express = require('express');
const router = express.Router();
const { register, login } = require('../controllers/userController');
const { authenticateToken } = require('../middleware/auth.middleware.js');
const { getMyProfile, updateMyProfile } = require('../controllers/userController.js')


router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticateToken, getMyProfile);
router.put('/me', authenticateToken, updateMyProfile);

module.exports = router;