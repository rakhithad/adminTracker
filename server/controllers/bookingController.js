const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

const createBooking = async (req, res) => {
    console.log("Received body:", req.body);

    try {
        // Validate required fields
        const requiredFields = ['ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'supplier', 'travelDate'];
        const missingFields = requiredFields.filter(field => !req.body[field]);
        if (missingFields.length > 0) {
            return apiResponse.error(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
        }

        // Validate enum values
        const validTeams = ['PH', 'TOURS'];
        if (!validTeams.includes(req.body.team_name)) {
            return apiResponse.error(res, `Invalid team_name. Must be one of: ${validTeams.join(', ')}`, 400);
        }

        const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
        if (!validSuppliers.includes(req.body.supplier)) {
            return apiResponse.error(res, `Invalid supplier. Must be one of: ${validSuppliers.join(', ')}`, 400);
        }

        // Extract and validate prodCostBreakdown
        const prodCostBreakdown = req.body.prodCostBreakdown || [];
        if (!Array.isArray(prodCostBreakdown)) {
            return apiResponse.error(res, "prodCostBreakdown must be an array", 400);
        }

        for (const item of prodCostBreakdown) {
            if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
                return apiResponse.error(res, "Each cost item must have a category and a positive amount", 400);
            }
        }

        // Calculate prodCost from prodCostBreakdown
        const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);

        // Verify provided prodCost matches calculatedProdCost
        if (req.body.prodCost && Math.abs(parseFloat(req.body.prodCost) - calculatedProdCost) > 0.01) {
            return apiResponse.error(res, "Provided prodCost does not match the sum of prodCostBreakdown", 400);
        }

        // Prepare financial data
        const financialData = {
            revenue: req.body.revenue ? parseFloat(req.body.revenue) : null,
            prodCost: calculatedProdCost || null,
            transFee: req.body.transFee ? parseFloat(req.body.transFee) : null,
            surcharge: req.body.surcharge ? parseFloat(req.body.surcharge) : null,
            received: req.body.received ? parseFloat(req.body.received) : null,
            balance: req.body.balance ? parseFloat(req.body.balance) : null,
            profit: req.body.profit ? parseFloat(req.body.profit) : null,
            invoiced: req.body.invoiced || null
        };

        // Recalculate profit and balance to ensure data integrity
        const revenue = financialData.revenue || 0;
        const prodCost = financialData.prodCost || 0;
        const transFee = financialData.transFee || 0;
        const surcharge = financialData.surcharge || 0;
        const received = financialData.received || 0;
        financialData.profit = revenue - prodCost - transFee - surcharge;
        financialData.balance = revenue - received;

        // Create booking with nested costItems
        const booking = await prisma.booking.create({
            data: {
                refNo: req.body.ref_no,
                paxName: req.body.pax_name,
                agentName: req.body.agent_name,
                teamName: req.body.team_name,
                pnr: req.body.pnr,
                airline: req.body.airline,
                fromTo: req.body.from_to,
                bookingType: req.body.bookingType,
                bookingStatus: req.body.bookingStatus || 'PENDING',
                pcDate: new Date(req.body.pcDate),
                issuedDate: new Date(req.body.issuedDate),
                paymentMethod: req.body.paymentMethod,
                lastPaymentDate: req.body.lastPaymentDate ? new Date(req.body.lastPaymentDate) : null,
                supplier: req.body.supplier,
                travelDate: new Date(req.body.travelDate),
                ...financialData,
                costItems: {
                    create: prodCostBreakdown.map(item => ({
                        category: item.category,
                        amount: parseFloat(item.amount)
                    }))
                }
            }
        });

        return apiResponse.success(res, booking, 201);
    } catch (error) {
        console.error("Booking creation error:", error);

        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return apiResponse.error(res, "Booking with this reference number already exists", 409);
        }

        if (error.code === 'P2003') {
            return apiResponse.error(res, "Invalid enum value provided", 400);
        }

        return apiResponse.error(res, "Failed to create booking: " + error.message, 500);
    }
};

// Get all bookings
const getBookings = async (req, res) => {
    try {
        const bookings = await prisma.booking.findMany({
            include: { costItems: true } // Include related costItems
        });
        apiResponse.success(res, bookings);
    } catch (error) {
        apiResponse.error(res, "Failed to get all bookings: " + error.message, 500);
    }
};

// Update booking
const updateBooking = async (req, res) => {
    try {
        // Validate enum values if provided
        if (req.body.team_name && !['PH', 'TOURS'].includes(req.body.team_name)) {
            return apiResponse.error(res, "Invalid team_name. Must be one of: PH, TOURS", 400);
        }

        if (req.body.supplier && !['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'].includes(req.body.supplier)) {
            return apiResponse.error(res, "Invalid supplier. Must be one of: BTRES, LYCA, CEBU, BTRES_LYCA, BA, TRAINLINE, EASYJET, FLYDUBAI", 400);
        }

        const updated = await prisma.booking.update({
            where: { id: parseInt(req.params.id) },
            data: {
                ...req.body,
                teamName: req.body.team_name,
                pcDate: req.body.pcDate ? new Date(req.body.pcDate) : undefined,
                issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : undefined,
                lastPaymentDate: req.body.lastPaymentDate ? new Date(req.body.lastPaymentDate) : undefined,
                travelDate: req.body.travelDate ? new Date(req.body.travelDate) : undefined,
                revenue: req.body.revenue ? parseFloat(req.body.revenue) : undefined,
                prodCost: req.body.prodCost ? parseFloat(req.body.prodCost) : undefined,
                transFee: req.body.transFee ? parseFloat(req.body.transFee) : undefined,
                surcharge: req.body.surcharge ? parseFloat(req.body.surcharge) : undefined,
                received: req.body.received ? parseFloat(req.body.received) : undefined,
                balance: req.body.balance ? parseFloat(req.body.balance) : undefined,
                profit: req.body.profit ? parseFloat(req.body.profit) : undefined
            }
        });
        apiResponse.success(res, updated);
    } catch (error) {
        apiResponse.error(res, "Failed to update booking: " + error.message, 500);
    }
};

module.exports = { createBooking, getBookings, updateBooking };