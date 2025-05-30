const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');



const createBooking = async (req, res) => {
    console.log("Received body:", req.body);
    
    try {
        // Validate required fields
        if (!req.body.ref_no || !req.body.pax_name || !req.body.agent_name) {
            return apiResponse.error(res, "Missing required fields", 400);
        }
        
        const financialData = {
            revenue: req.body.revenue ? parseFloat(req.body.revenue) : null,
            prodCost: req.body.prodCost ? parseFloat(req.body.prodCost) : null,
            transFee: req.body.transFee ? parseFloat(req.body.transFee) : null,
            surcharge: req.body.surcharge ? parseFloat(req.body.surcharge) : null,
            received: req.body.received ? parseFloat(req.body.received) : null,
            balance: req.body.balance ? parseFloat(req.body.balance) : null,
            profit: req.body.profit ? parseFloat(req.body.profit) : null,
            invoiced: req.body.invoiced || null
          };

        // Create booking with explicit field mapping
        const booking = await prisma.booking.create({
            data: {
                refNo: req.body.ref_no,
                paxName: req.body.pax_name,
                agentName: req.body.agent_name,
                teamName: req.body.team_name || null, 
                pnr: req.body.pnr,
                airline: req.body.airline,
                fromTo: req.body.from_to,
                bookingType: req.body.bookingType,
                bookingStatus: req.body.bookingStatus || 'PENDING',
                pcDate: new Date(req.body.pcDate),
                issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : null,
                paymentMethod: req.body.paymentMethod,
                lastPaymentDate: req.body.lastPaymentDate ? new Date(req.body.lastPaymentDate) : null,
                ...financialData
            }
        });

        return apiResponse.success(res, booking, 201);
    } catch (error) {
        console.error("Booking creation error:", error);
        
        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return apiResponse.error(res, "Booking with this reference number already exists", 409);
        }
        
        return apiResponse.error(res, "Failed to create booking: " + error.message, 500);
    }
};

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

