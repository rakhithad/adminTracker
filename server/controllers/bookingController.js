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

    // Validate prodCostBreakdown
    const prodCostBreakdown = req.body.prodCostBreakdown || [];
    if (!Array.isArray(prodCostBreakdown)) {
      return apiResponse.error(res, "prodCostBreakdown must be an array", 400);
    }

    for (const item of prodCostBreakdown) {
      if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
        return apiResponse.error(res, "Each cost item must have a category and a positive amount", 400);
      }
    }

    // Validate instalments
    const instalments = req.body.instalments || [];
    if (req.body.paymentMethod === 'INTERNAL' && !Array.isArray(instalments)) {
      return apiResponse.error(res, "instalments must be an array for INTERNAL payment method", 400);
    }

    for (const inst of instalments) {
      if (!inst.dueDate || isNaN(parseFloat(inst.amount)) || parseFloat(inst.amount) <= 0 || !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')) {
        return apiResponse.error(res, "Each instalment must have a valid dueDate, positive amount, and valid status", 400);
      }
    }

    // Calculate prodCost from prodCostBreakdown
    const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    // Verify provided prodCost matches calculatedProdCost
    if (req.body.prodCost && Math.abs(parseFloat(req.body.prodCost) - calculatedProdCost) > 0.01) {
      return apiResponse.error(res, "Provided prodCost does not match the sum of prodCostBreakdown", 400);
    }

    // Verify instalments sum matches balance
    if (instalments.length > 0) {
      const totalInstalments = instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
      const balance = parseFloat(req.body.balance) || 0;
      if (Math.abs(totalInstalments - balance) > 0.01) {
        return apiResponse.error(res, "Sum of instalments must equal the balance", 400);
      }
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
      invoiced: req.body.invoiced || null,
    };

    // Recalculate profit and balance to ensure data integrity
    const revenue = financialData.revenue || 0;
    const prodCost = financialData.prodCost || 0;
    const transFee = financialData.transFee || 0;
    const surcharge = financialData.surcharge || 0;
    const received = financialData.received || 0;
    financialData.profit = revenue - prodCost - transFee - surcharge;
    financialData.balance = revenue - received;

    // Create pending booking with nested costItems and instalments
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
            amount: parseFloat(item.amount),
          })),
        },
        instalments: {
          create: instalments.map(inst => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        },
      },
      include: {
        costItems: true,
        instalments: true,
      },
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
      include: {
        costItems: true,
        instalments: true, // Include instalments
      },
    });
    return apiResponse.success(res, pendingBookings);
  } catch (error) {
    console.error("Error fetching pending bookings:", error);
    return apiResponse.error(res, "Failed to fetch pending bookings: " + error.message, 500);
  }
};

const approveBooking = async (req, res) => {
  try {
    const bookingId = parseInt(req.params.id);
    if (isNaN(bookingId)) {
      return apiResponse.error(res, 'Invalid booking ID', 400);
    }

    // Fetch pending booking with related data
    const pendingBooking = await prisma.pendingBooking.findUnique({
      where: { id: bookingId },
      include: {
        costItems: true,
        instalments: true,
      },
    });

    if (!pendingBooking) {
      return apiResponse.error(res, 'Pending booking not found', 404);
    }

    if (pendingBooking.status !== 'PENDING') {
      return apiResponse.error(res, 'Pending booking already processed', 409);
    }

    // Debug: Log instalments to verify data
    console.log('Pending Instalments:', pendingBooking.instalments);

    // Validate instalments
    if (pendingBooking.paymentMethod.includes('INTERNAL') && (!Array.isArray(pendingBooking.instalments) || pendingBooking.instalments.length === 0)) {
      return apiResponse.error(res, 'Instalments are required for INTERNAL payment method', 400);
    }

    // Verify instalments sum matches balance
    if (pendingBooking.instalments.length > 0) {
      const totalInstalments = pendingBooking.instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
      const balance = parseFloat(pendingBooking.balance) || 0;
      if (Math.abs(totalInstalments - balance) > 0.01) {
        return apiResponse.error(res, `Sum of instalments (£${totalInstalments.toFixed(2)}) does not match balance (£${balance.toFixed(2)})`, 400);
      }
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
        bookingStatus: pendingBooking.bookingStatus || 'PENDING',
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
            amount: parseFloat(item.amount),
          })),
        },
        instalments: {
          create: pendingBooking.instalments.map(inst => ({
            dueDate: new Date(inst.dueDate), // Ensure dueDate is a Date object
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        },
      },
      include: {
        costItems: true,
        instalments: true,
      },
    });

    // Debug: Log created booking instalments
    console.log('Created Booking Instalments:', booking.instalments);

    // Delete pending booking (cascades to PendingInstalment due to onDelete: Cascade)
    await prisma.pendingBooking.delete({
      where: { id: bookingId },
    });

    return apiResponse.success(res, booking, 200);
  } catch (error) {
    console.error('Error approving booking:', error);
    return apiResponse.error(res, `Failed to approve booking: ${error.message}`, 500);
  }
};

const rejectBooking = async (req, res) => {
  try {
    const pendingBooking = await prisma.pendingBooking.findUnique({
      where: { id: parseInt(req.params.id) },
    });

    if (!pendingBooking || pendingBooking.status !== 'PENDING') {
      return apiResponse.error(res, "Pending booking not found or already processed", 404);
    }

    // Delete pending booking (cascades to instalments and costItems due to onDelete: Cascade)
    await prisma.pendingBooking.delete({
      where: { id: parseInt(req.params.id) },
    });

    return apiResponse.success(res, { message: "Booking rejected successfully" }, 200);
  } catch (error) {
    console.error("Error rejecting booking:", error);
    return apiResponse.error(res, "Failed to reject booking: " + error.message, 500);
  }
};

const createBooking = async (req, res) => {
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

    // Validate instalments
    const instalments = req.body.instalments || [];
    if (req.body.paymentMethod === 'INTERNAL' && !Array.isArray(instalments)) {
      return apiResponse.error(res, "instalments must be an array for INTERNAL payment method", 400);
    }

    for (const inst of instalments) {
      if (!inst.dueDate || isNaN(parseFloat(inst.amount)) || parseFloat(inst.amount) <= 0 || !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')) {
        return apiResponse.error(res, "Each instalment must have a valid dueDate, positive amount, and valid status", 400);
      }
    }

    const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    if (req.body.prodCost && Math.abs(parseFloat(req.body.prodCost) - calculatedProdCost) > 0.01) {
      return apiResponse.error(res, "Provided prodCost does not match the sum of prodCostBreakdown", 400);
    }

    // Verify instalments sum matches balance
    if (instalments.length > 0) {
      const totalInstalments = instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
      const balance = parseFloat(req.body.balance) || 0;
      if (Math.abs(totalInstalments - balance) > 0.01) {
        return apiResponse.error(res, "Sum of instalments must equal the balance", 400);
      }
    }

    const financialData = {
      revenue: req.body.revenue ? parseFloat(req.body.revenue) : null,
      prodCost: calculatedProdCost || null,
      transFee: req.body.transFee ? parseFloat(req.body.transFee) : null,
      surcharge: req.body.surcharge ? parseFloat(req.body.surcharge) : null,
      received: req.body.received ? parseFloat(req.body.received) : null,
      balance: req.body.balance ? parseFloat(req.body.balance) : null,
      profit: req.body.profit ? parseFloat(req.body.profit) : null,
      invoiced: req.body.invoiced || null,
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
            amount: parseFloat(item.amount),
          })),
        },
        instalments: {
          create: instalments.map(inst => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        },
      },
      include: {
        costItems: true,
        instalments: true,
      },
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
      include: {
        costItems: true,
        instalments: true, // Include instalments
      },
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

    // Extract fields
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
      costItems,
      instalments,
    } = updates;

    // Validate instalments if provided
    if (instalments) {
      if (!Array.isArray(instalments)) {
        return apiResponse.error(res, "instalments must be an array", 400);
      }
      for (const inst of instalments) {
        if (!inst.dueDate || isNaN(parseFloat(inst.amount)) || parseFloat(inst.amount) <= 0 || !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status)) {
          return apiResponse.error(res, "Each instalment must have a valid dueDate, positive amount, and valid status", 400);
        }
      }
      // Verify instalments sum matches balance
      if (balance) {
        const totalInstalments = instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
        if (Math.abs(totalInstalments - parseFloat(balance)) > 0.01) {
          return apiResponse.error(res, "Sum of instalments must equal the balance", 400);
        }
      }
    }

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
        revenue: revenue ? parseFloat(revenue) : null,
        prodCost: prodCost ? parseFloat(prodCost) : null,
        transFee: transFee ? parseFloat(transFee) : null,
        surcharge: surcharge ? parseFloat(surcharge) : null,
        received: received ? parseFloat(received) : null,
        balance: balance ? parseFloat(balance) : null,
        profit: profit ? parseFloat(profit) : null,
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
        instalments: Array.isArray(instalments) && instalments.length > 0
          ? {
              deleteMany: {},
              create: instalments.map(inst => ({
                dueDate: new Date(inst.dueDate),
                amount: parseFloat(inst.amount),
                status: inst.status,
              })),
            }
          : undefined,
      },
      include: {
        costItems: true,
        instalments: true,
      },
    });
    res.status(200).json({ success: true, data: booking });
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ success: false, error: `Failed to update booking: ${error.message}` });
  }
};




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

