const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');


//create a booking
const createBooking = async(req,res) => {
    console.log("Received body:", req.body); 

    try {
        const booking = await prisma.booking.create({data:req.body});
        apiResponse.success(res, booking,201);
    } catch (error) {
        apiResponse.error(res, "Failed to create a booking");
    }
}

//get all the bookings
const getBookings = async(req,res) => {
    try {
        const bookings = await prisma.booking.findMany();
        apiResponse.success(res, bookings);
    } catch (error) {
        apiResponse.error(res, "Failed to get all bookings")
    }
}

//updating the booking
const updateBooking = async(req,res) => {
    try {
        const updated = await prisma.booking.update({
            where: { id: parseInt(req.params.id) },
            data: req.body
          });
          apiResponse.success(res, updated);
    } catch (error) {
        apiResponse.error(res, "Failed to update the booking")
    }
}


module.exports = { createBooking, getBookings, updateBooking };

