const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

const createPendingBooking = async (req, res) => {
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

    // Create pending booking with nested costItems
    const pendingBooking = await prisma.pendingBooking.create({
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
        issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : null,
        paymentMethod: req.body.paymentMethod,
        lastPaymentDate: req.body.lastPaymentDate ? new Date(req.body.lastPaymentDate) : null,
        supplier: req.body.supplier,
        travelDate: req.body.travelDate ? new Date(req.body.travelDate) : null,
        ...financialData,
        status: 'PENDING',
        costItems: {
          create: prodCostBreakdown.map(item => ({
            category: item.category,
            amount: parseFloat(item.amount)
          }))
        }
      }
    });

    return apiResponse.success(res, pendingBooking, 201);
  } catch (error) {
    console.error("Pending booking creation error:", error);
    if (error.code === 'P2002') {
      return apiResponse.error(res, "Pending booking with this reference number already exists", 409);
    }
    if (error.code === 'P2003') {
      return apiResponse.error(res, "Invalid enum value provided", 400);
    }
    return apiResponse.error(res, "Failed to create pending booking: " + error.message, 500);
  }
};

const getPendingBookings = async (req, res) => {
  try {
    const pendingBookings = await prisma.pendingBooking.findMany({
      where: { status: 'PENDING' },
      include: { costItems: true }
    });
    return apiResponse.success(res, pendingBookings);
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    return apiResponse.error(res, "Failed to fetch pending bookings: " + error.message, 500);
  }
};

const approveBooking = async (req, res) => {
  try {
    const pendingBooking = await prisma.pendingBooking.findUnique({
      where: { id: parseInt(req.params.id) },
      include: { costItems: true }
    });

    if (!pendingBooking || pendingBooking.status !== 'PENDING') {
      return apiResponse.error(res, "Pending booking not found or already processed", 404);
    }

    // Create booking in Bookings table
    const booking = await prisma.booking.create({
      data: {
        refNo: pendingBooking.refNo,
        paxName: pendingBooking.paxName,
        agentName: pendingBooking.agentName,
        teamName: pendingBooking.teamName,
        pnr: pendingBooking.pnr,
        airline: pendingBooking.airline,
        fromTo: pendingBooking.fromTo,
        bookingType: pendingBooking.bookingType,
        bookingStatus: pendingBooking.bookingStatus,
        pcDate: pendingBooking.pcDate,
        issuedDate: pendingBooking.issuedDate,
        paymentMethod: pendingBooking.paymentMethod,
        lastPaymentDate: pendingBooking.lastPaymentDate,
        supplier: pendingBooking.supplier,
        travelDate: pendingBooking.travelDate,
        revenue: pendingBooking.revenue,
        prodCost: pendingBooking.prodCost,
        transFee: pendingBooking.transFee,
        surcharge: pendingBooking.surcharge,
        received: pendingBooking.received,
        balance: pendingBooking.balance,
        profit: pendingBooking.profit,
        invoiced: pendingBooking.invoiced,
        costItems: {
          create: pendingBooking.costItems.map(item => ({
            category: item.category,
            amount: item.amount
          }))
        }
      }
    });

    // Delete pending booking
    await prisma.pendingBooking.delete({
      where: { id: parseInt(req.params.id) }
    });

    return apiResponse.success(res, booking, 200);
  } catch (error) {
    console.error("Error approving booking:", error);
    return apiResponse.error(res, "Failed to approve booking: " + error.message, 500);
  }
};

const rejectBooking = async (req, res) => {
  try {
    const pendingBooking = await prisma.pendingBooking.findUnique({
      where: { id: parseInt(req.params.id) }
    });

    if (!pendingBooking || pendingBooking.status !== 'PENDING') {
      return apiResponse.error(res, "Pending booking not found or already processed", 404);
    }

    // Delete pending booking
    await prisma.pendingBooking.delete({
      where: { id: parseInt(req.params.id) }
    });

    return apiResponse.success(res, { message: "Booking rejected successfully" }, 200);
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return apiResponse.error(res, "Failed to reject booking: " + error.message, 500);
  }
};

// Original functions for main bookings table
const createBooking = async (req, res) => {
  // Keep original createBooking for internal use (e.g., after approval)
  // Same as your provided code
  try {
    const requiredFields = ['ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'supplier', 'travelDate'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return apiResponse.error(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    const validTeams = ['PH', 'TOURS'];
    if (!validTeams.includes(req.body.team_name)) {
      return apiResponse.error(res, `Invalid team_name. Must be one of: ${validTeams.join(', ')}`, 400);
    }

    const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
    if (!validSuppliers.includes(req.body.supplier)) {
      return apiResponse.error(res, `Invalid supplier. Must be one of: ${validSuppliers.join(', ')}`, 400);
    }

    const prodCostBreakdown = req.body.prodCostBreakdown || [];
    if (!Array.isArray(prodCostBreakdown)) {
      return apiResponse.error(res, "prodCostBreakdown must be an array", 400);
    }

    for (const item of prodCostBreakdown) {
      if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
        return apiResponse.error(res, "Each cost item must have a category and a positive amount", 400);
      }
    }

    const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    if (req.body.prodCost && Math.abs(parseFloat(req.body.prodCost) - calculatedProdCost) > 0.01) {
      return apiResponse.error(res, "Provided prodCost does not match the sum of prodCostBreakdown", 400);
    }

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

    const revenue = financialData.revenue || 0;
    const prodCost = financialData.prodCost || 0;
    const transFee = financialData.transFee || 0;
    const surcharge = financialData.surcharge || 0;
    const received = financialData.received || 0;
    financialData.profit = revenue - prodCost - transFee - surcharge;
    financialData.balance = revenue - received;

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
    if (error.code === 'P2002') {
      return apiResponse.error(res, "Booking with this reference number already exists", 409);
    }
    if (error.code === 'P2003') {
      return apiResponse.error(res, "Invalid enum value provided", 400);
    }
    return apiResponse.error(res, "Failed to create booking: " + error.message, 500);
  }
};

const getBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      include: { costItems: true }
    });
    apiResponse.success(res, bookings);
  } catch (error) {
    apiResponse.error(res, "Failed to get all bookings: " + error.message, 500);
  }
};

const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    // Explicitly define allowed fields to prevent invalid fields like costItems
    const {
      refNo,
      paxName,
      agentName,
      teamName,
      pnr,
      airline,
      fromTo,
      bookingType,
      bookingStatus,
      pcDate,
      issuedDate,
      paymentMethod,
      lastPaymentDate,
      supplier,
      revenue,
      prodCost,
      transFee,
      surcharge,
      received,
      balance,
      profit,
      invoiced,
      travelDate,
      costItems, // Extract but handle separately
    } = updates;

    const booking = await prisma.booking.update({
      where: { id: parseInt(id) },
      data: {
        refNo,
        paxName,
        agentName,
        teamName,
        pnr,
        airline,
        fromTo,
        bookingType,
        bookingStatus,
        pcDate: pcDate ? new Date(pcDate) : null,
        issuedDate: issuedDate ? new Date(issuedDate) : null,
        paymentMethod,
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : null,
        supplier,
        revenue,
        prodCost,
        transFee,
        surcharge,
        received,
        balance,
        profit,
        invoiced,
        travelDate: travelDate ? new Date(travelDate) : null,
        costItems: Array.isArray(costItems) && costItems.length > 0
          ? {
              deleteMany: {},
              create: costItems.map(item => ({
                category: item.category,
                amount: parseFloat(item.amount),
              })),
            }
          : undefined,
      },
    });
    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ success: false, error: `Failed to update booking: ${error.message}` });
  }
};

// New dashboard functions
const getDashboardStats = async (req, res) => {
  try {
    const [totalBookings, pendingBookings, confirmedBookings, completedBookings, totalRevenue] = await Promise.all([
      prisma.booking.count(),
      prisma.pendingBooking.count(),
      prisma.booking.count({ where: { bookingStatus: 'CONFIRMED' } }),
      prisma.booking.count({ where: { bookingStatus: 'COMPLETED' } }),
      prisma.booking.aggregate({
        _sum: { revenue: true },
        where: { revenue: { not: null } },
      }),
    ]);

    res.status(200).json({
      success: true,
      data: {
        totalBookings,
        pendingBookings,
        confirmedBookings,
        completedBookings,
        totalRevenue: totalRevenue._sum.revenue || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch dashboard stats' });
  }
};

const getRecentBookings = async (req, res) => {
  try {
    const recentBookings = await prisma.booking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        refNo: true,
        paxName: true,
        bookingStatus: true,
        createdAt: true,
      },
    });
    const recentPendingBookings = await prisma.pendingBooking.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        refNo: true,
        paxName: true,
        status: true,
        createdAt: true,
      },
    });

    res.status(200).json({
      success: true,
      data: {
        bookings: recentBookings,
        pendingBookings: recentPendingBookings,
      },
    });
  } catch (error) {
    console.error('Error fetching recent bookings:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch recent bookings' });
  }
};

module.exports = {
  createPendingBooking,
  getPendingBookings,
  approveBooking,
  rejectBooking,
  createBooking,
  getBookings,
  updateBooking,
  getDashboardStats,
  getRecentBookings,
};

