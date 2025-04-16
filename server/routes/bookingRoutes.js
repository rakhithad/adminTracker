const express = require('express');
const router = express.Router();
const { createBooking, getBookings, updateBooking } = require('../controllers/bookingController');

// Booking CRUD
router.post('/', createBooking);
router.get('/', getBookings);
router.put('/:id', updateBooking);

module.exports = router;