const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

const createPendingBooking = async (req, res) => {
  console.log("Received body:", JSON.stringify(req.body, null, 2));

  try {
    // Validate required fields
    const requiredFields = [
      'ref_no',
      'pax_name',
      'agent_name',
      'team_name',
      'pnr',
      'airline',
      'from_to',
      'bookingType',
      'paymentMethod',
      'pcDate',
      'issuedDate',
      'supplier',
      'travelDate',
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field]);
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

    // Validate transactionMethod
    const validTransactionMethods = ['BANK_TRANSFER', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES'];
    if (req.body.transactionMethod && !validTransactionMethods.includes(req.body.transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    // Validate prodCostBreakdown
    const prodCostBreakdown = req.body.prodCostBreakdown || [];
    if (!Array.isArray(prodCostBreakdown)) {
      return apiResponse.error(res, "prodCostBreakdown must be an array", 400);
    }

    const validPaymentMethods = ['credit', 'full', 'custom'];
    for (const item of prodCostBreakdown) {
      if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
        return apiResponse.error(res, "Each cost item must have a category and a positive amount", 400);
      }
      if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
        return apiResponse.error(res, "Each cost item must have at least one supplier allocation", 400);
      }
      const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
        return apiResponse.error(res, "Supplier amounts must sum to the cost item amount", 400);
      }
      for (const s of item.suppliers) {
        if (
          !s.supplier ||
          !validSuppliers.includes(s.supplier) ||
          isNaN(parseFloat(s.amount)) ||
          parseFloat(s.amount) <= 0
        ) {
          return apiResponse.error(res, "Each supplier allocation must have a valid supplier and positive amount", 400);
        }
        if (!validPaymentMethods.includes(s.paymentMethod)) {
          return apiResponse.error(res, `Invalid payment method for supplier ${s.supplier}. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
        }
        if (s.paymentMethod === 'custom') {
          if (isNaN(parseFloat(s.paidAmount)) || parseFloat(s.paidAmount) <= 0 || parseFloat(s.paidAmount) >= parseFloat(s.amount)) {
            return apiResponse.error(res, `Custom payment for supplier ${s.supplier} must have a valid paidAmount (0 < paidAmount < amount)`, 400);
          }
        }
      }
    }

    // Validate instalments
    const instalments = req.body.instalments || [];
    if (req.body.paymentMethod === 'INTERNAL' && !Array.isArray(instalments)) {
      return apiResponse.error(res, "instalments must be an array for INTERNAL payment method", 400);
    }

    for (const inst of instalments) {
      if (
        !inst.dueDate ||
        isNaN(parseFloat(inst.amount)) ||
        parseFloat(inst.amount) <= 0 ||
        !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')
      ) {
        return apiResponse.error(res, "Each instalment must have a valid dueDate, positive amount, and valid status", 400);
      }
    }

    // Validate passenger data
    const passengers = req.body.passengers || [];
    if (!Array.isArray(passengers) || passengers.length === 0) {
      return apiResponse.error(res, "passengers must be a non-empty array", 400);
    }

    const validTitles = ['MR', 'MRS', 'MS', 'MASTER'];
    const validGenders = ['MALE', 'FEMALE', 'OTHER'];
    const validCategories = ['ADULT', 'CHILD', 'INFANT'];

    for (const pax of passengers) {
      console.log("Validating passenger:", JSON.stringify(pax, null, 2));
      const validationErrors = [];
      if (!pax.title) validationErrors.push("Missing title");
      if (pax.title && !validTitles.includes(pax.title)) validationErrors.push(`Invalid title: ${pax.title}`);
      if (!pax.firstName) validationErrors.push("Missing firstName");
      if (!pax.lastName) validationErrors.push("Missing lastName");
      if (!pax.gender) validationErrors.push("Missing gender");
      if (pax.gender && !validGenders.includes(pax.gender)) validationErrors.push(`Invalid gender: ${pax.gender}`);
      if (!pax.birthday) validationErrors.push("Missing birthday");
      if (pax.birthday && isNaN(new Date(pax.birthday))) validationErrors.push(`Invalid birthday: ${pax.birthday}`);
      if (!pax.category) validationErrors.push("Missing category");
      if (pax.category && !validCategories.includes(pax.category)) validationErrors.push(`Invalid category: ${pax.category}`);
      if (pax.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) validationErrors.push(`Invalid email: ${pax.email}`);
      if (pax.contactNo && !/^\+?\d{10,15}$/.test(pax.contactNo)) validationErrors.push(`Invalid contactNo: ${pax.contactNo}`);

      if (validationErrors.length > 0) {
        console.error("Passenger validation failed:", validationErrors);
        return apiResponse.error(
          res,
          "Each passenger must have a valid title, firstName, lastName, gender, birthday, and category. Email and contactNo must be valid if provided.",
          400
        );
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

    // Create pending booking with nested costItems, instalments, passengers, and suppliers
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
        transactionMethod: req.body.transactionMethod || null,
        receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : null,
        description: req.body.description || null,
        ...financialData,
        status: 'PENDING',
        costItems: {
          create: prodCostBreakdown.map((item) => ({
            category: item.category,
            amount: parseFloat(item.amount),
            suppliers: {
              create: item.suppliers.map((s) => ({
                supplier: s.supplier,
                amount: parseFloat(s.amount),
                paymentMethod: s.paymentMethod || 'full',
                paidAmount: s.paymentMethod === 'credit' ? 0 : s.paymentMethod === 'full' ? parseFloat(s.amount) : parseFloat(s.paidAmount) || 0,
                pendingAmount: s.paymentMethod === 'credit' ? parseFloat(s.amount) : s.paymentMethod === 'full' ? 0 : (parseFloat(s.amount) - parseFloat(s.paidAmount)) || 0,
              })),
            },
          })),
        },
        instalments: {
          create: instalments.map((inst) => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        },
        passengers: {
          create: passengers.map((pax) => ({
            title: pax.title,
            firstName: pax.firstName,
            middleName: pax.middleName || null,
            lastName: pax.lastName,
            gender: pax.gender,
            email: pax.email || null,
            contactNo: pax.contactNo || null,
            nationality: pax.nationality || null,
            birthday: pax.birthday ? new Date(pax.birthday) : null,
            category: pax.category,
          })),
        },
      },
      include: {
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
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
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
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

    const pendingBooking = await prisma.pendingBooking.findUnique({
      where: { id: bookingId },
      include: {
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
      },
    });

    if (!pendingBooking) {
      return apiResponse.error(res, 'Pending booking not found', 404);
    }

    if (pendingBooking.status !== 'PENDING') {
      return apiResponse.error(res, 'Pending booking already processed', 409);
    }

    if (pendingBooking.paymentMethod.includes('INTERNAL') && (!Array.isArray(pendingBooking.instalments) || pendingBooking.instalments.length === 0)) {
      return apiResponse.error(res, 'Instalments are required for INTERNAL payment method', 400);
    }

    if (pendingBooking.instalments.length > 0) {
      const totalInstalments = pendingBooking.instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
      const balance = parseFloat(pendingBooking.balance) || 0;
      if (Math.abs(totalInstalments - balance) > 0.01) {
        return apiResponse.error(res, `Sum of instalments (£${totalInstalments.toFixed(2)}) does not match balance (£${balance.toFixed(2)})`, 400);
      }
    }

    if (!Array.isArray(pendingBooking.passengers) || pendingBooking.passengers.length === 0) {
      return apiResponse.error(res, 'At least one passenger is required', 400);
    }

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
        transactionMethod: pendingBooking.transactionMethod,
        receivedDate: pendingBooking.receivedDate,
        balance: pendingBooking.balance,
        profit: pendingBooking.profit,
        invoiced: pendingBooking.invoiced,
        description: pendingBooking.description,
        costItems: {
          create: pendingBooking.costItems.map((item) => ({
            category: item.category,
            amount: parseFloat(item.amount),
            suppliers: {
              create: item.suppliers.map((s) => ({
                supplier: s.supplier,
                amount: parseFloat(s.amount),
                paymentMethod: s.paymentMethod || 'full',
                paidAmount: parseFloat(s.paidAmount) || (s.paymentMethod === 'credit' ? 0 : s.paymentMethod === 'full' ? parseFloat(s.amount) : 0),
                pendingAmount: parseFloat(s.pendingAmount) || (s.paymentMethod === 'credit' ? parseFloat(s.amount) : s.paymentMethod === 'full' ? 0 : 0),
              })),
            },
          })),
        },
        instalments: {
          create: pendingBooking.instalments.map((inst) => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        },
        passengers: {
          create: pendingBooking.passengers.map((pax) => ({
            title: pax.title,
            firstName: pax.firstName,
            middleName: pax.middleName || null,
            lastName: pax.lastName,
            gender: pax.gender,
            email: pax.email || null,
            contactNo: pax.contactNo || null,
            nationality: pax.nationality || null,
            birthday: pax.birthday,
            category: pax.category,
          })),
        },
      },
      include: {
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
      },
    });

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
    const requiredFields = [
      'ref_no',
      'pax_name',
      'agent_name',
      'team_name',
      'pnr',
      'airline',
      'from_to',
      'bookingType',
      'paymentMethod',
      'pcDate',
      'issuedDate',
      'supplier',
      'travelDate',
    ];
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

    const validTransactionMethods = ['BANK_TRANSFER', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES'];
    if (req.body.transactionMethod && !validTransactionMethods.includes(req.body.transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    const prodCostBreakdown = req.body.prodCostBreakdown || [];
    if (!Array.isArray(prodCostBreakdown)) {
      return apiResponse.error(res, "prodCostBreakdown must be an array", 400);
    }

    const validPaymentMethods = ['credit', 'full', 'custom'];
    for (const item of prodCostBreakdown) {
      if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
        return apiResponse.error(res, "Each cost item must have a category and a positive amount", 400);
      }
      if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
        return apiResponse.error(res, "Each cost item must have at least one supplier allocation", 400);
      }
      const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
        return apiResponse.error(res, "Supplier amounts must sum to the cost item amount", 400);
      }
      for (const s of item.suppliers) {
        if (!s.supplier || !validSuppliers.includes(s.supplier) || isNaN(parseFloat(s.amount)) || parseFloat(s.amount) <= 0) {
          return apiResponse.error(res, "Each supplier allocation must have a valid supplier and positive amount", 400);
        }
        if (!validPaymentMethods.includes(s.paymentMethod)) {
          return apiResponse.error(res, `Invalid payment method for supplier ${s.supplier}. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
        }
        if (s.paymentMethod === 'custom') {
          if (isNaN(parseFloat(s.paidAmount)) || parseFloat(s.paidAmount) <= 0 || parseFloat(s.paidAmount) >= parseFloat(s.amount)) {
            return apiResponse.error(res, `Custom payment for supplier ${s.supplier} must have a valid paidAmount (0 < paidAmount < amount)`, 400);
          }
        }
      }
    }

    const instalments = req.body.instalments || [];
    if (req.body.paymentMethod === 'INTERNAL' && !Array.isArray(instalments)) {
      return apiResponse.error(res, "instalments must be an array for INTERNAL payment method", 400);
    }

    for (const inst of instalments) {
      if (
        !inst.dueDate ||
        isNaN(parseFloat(inst.amount)) ||
        parseFloat(inst.amount) <= 0 ||
        !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')
      ) {
        return apiResponse.error(res, "Each instalment must have a valid dueDate, positive amount, and valid status", 400);
      }
    }

    const passengers = req.body.passengers || [];
    if (!Array.isArray(passengers) || passengers.length === 0) {
      return apiResponse.error(res, "passengers must be a non-empty array", 400);
    }

    const validTitles = ['MR', 'MRS', 'MS', 'MASTER'];
    const validGenders = ['MALE', 'FEMALE', 'OTHER'];
    const validCategories = ['ADULT', 'CHILD', 'INFANT'];

    for (const pax of passengers) {
      if (
        !pax.title ||
        !validTitles.includes(pax.title) ||
        !pax.firstName ||
        !pax.lastName ||
        !pax.gender ||
        !validGenders.includes(pax.gender) ||
        !pax.birthday ||
        isNaN(new Date(pax.birthday)) ||
        !pax.category ||
        !validCategories.includes(pax.category) ||
        (pax.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) ||
        (pax.contactNo && !/^\+?\d{10,15}$/.test(pax.contactNo))
      ) {
        return apiResponse.error(
          res,
          "Each passenger must have a valid title, firstName, lastName, gender, birthday, and category. Email and contactNo must be valid if provided.",
          400
        );
      }
    }

    const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);

    if (req.body.prodCost && Math.abs(parseFloat(req.body.prodCost) - calculatedProdCost) > 0.01) {
      return apiResponse.error(res, "Provided prodCost does not match the sum of prodCostBreakdown", 400);
    }

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
        transactionMethod: req.body.transactionMethod || null,
        receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : null,
        description: req.body.description || null,
        ...financialData,
        costItems: {
          create: prodCostBreakdown.map(item => ({
            category: item.category,
            amount: parseFloat(item.amount),
            suppliers: {
              create: item.suppliers.map(s => ({
                supplier: s.supplier,
                amount: parseFloat(s.amount),
                paymentMethod: s.paymentMethod || 'full',
                paidAmount: s.paymentMethod === 'credit' ? 0 : s.paymentMethod === 'full' ? parseFloat(s.amount) : parseFloat(s.paidAmount) || 0,
                pendingAmount: s.paymentMethod === 'credit' ? parseFloat(s.amount) : s.paymentMethod === 'full' ? 0 : (parseFloat(s.amount) - parseFloat(s.paidAmount)) || 0,
              })),
            },
          })),
        },
        instalments: {
          create: instalments.map(inst => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        },
        passengers: {
          create: passengers.map(pax => ({
            title: pax.title,
            firstName: pax.firstName,
            middleName: pax.middleName || null,
            lastName: pax.lastName,
            gender: pax.gender,
            email: pax.email || null,
            contactNo: pax.contactNo || null,
            nationality: pax.nationality || null,
            birthday: pax.birthday ? new Date(pax.birthday) : null,
            category: pax.category,
          })),
        },
      },
      include: {
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
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
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
      },
    });
    return apiResponse.success(res, bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return apiResponse.error(res, "Failed to get all bookings: " + error.message, 500);
  }
};

const updateBooking = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

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
      transactionMethod,
      receivedDate,
      balance,
      profit,
      invoiced,
      description,
      travelDate,
      costItems,
      instalments,
      passengers,
    } = updates;

    const validTransactionMethods = ['BANK_TRANSFER', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES'];
    if (transactionMethod && !validTransactionMethods.includes(transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    if (instalments) {
      if (!Array.isArray(instalments)) {
        return apiResponse.error(res, "instalments must be an array", 400);
      }
      for (const inst of instalments) {
        if (
          !inst.dueDate ||
          isNaN(parseFloat(inst.amount)) ||
          parseFloat(inst.amount) <= 0 ||
          !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status)
        ) {
          return apiResponse.error(res, "Each instalment must have a valid dueDate, positive amount, and valid status", 400);
        }
      }
      if (balance) {
        const totalInstalments = instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
        if (Math.abs(totalInstalments - parseFloat(balance)) > 0.01) {
          return apiResponse.error(res, "Sum of instalments must equal the balance", 400);
        }
      }
    }

    if (passengers) {
      if (!Array.isArray(passengers) || passengers.length === 0) {
        return apiResponse.error(res, "passengers must be a non-empty array", 400);
      }
      const validTitles = ['MR', 'MRS', 'MS', 'MASTER'];
      const validGenders = ['MALE', 'FEMALE', 'OTHER'];
      const validCategories = ['ADULT', 'CHILD', 'INFANT'];
      for (const pax of passengers) {
        if (
          !pax.title ||
          !validTitles.includes(pax.title) ||
          !pax.firstName ||
          !pax.lastName ||
          !pax.gender ||
          !validGenders.includes(pax.gender) ||
          !pax.birthday ||
          isNaN(new Date(pax.birthday)) ||
          !pax.category ||
          !validCategories.includes(pax.category) ||
          (pax.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) ||
          (pax.contactNo && !/^\+?\d{10,15}$/.test(pax.contactNo))
        ) {
          return apiResponse.error(
            res,
            "Each passenger must have a valid title, firstName, lastName, gender, birthday, and category. Email and contactNo must be valid if provided.",
            400
          );
        }
      }
    }

    if (costItems) {
      if (!Array.isArray(costItems)) {
        return apiResponse.error(res, "costItems must be an array", 400);
      }
      const validPaymentMethods = ['credit', 'full', 'custom'];
      for (const item of costItems) {
        if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
          return apiResponse.error(res, "Each cost item must have a category and a positive amount", 400);
        }
        if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
          return apiResponse.error(res, "Each cost item must have at least one supplier allocation", 400);
        }
        const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
          return apiResponse.error(res, "Supplier amounts must sum to the cost item amount", 400);
        }
        for (const s of item.suppliers) {
          if (!s.supplier || !['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'].includes(s.supplier) || isNaN(parseFloat(s.amount)) || parseFloat(s.amount) <= 0) {
            return apiResponse.error(res, "Each supplier allocation must have a valid supplier and positive amount", 400);
          }
          if (!validPaymentMethods.includes(s.paymentMethod)) {
            return apiResponse.error(res, `Invalid payment method for supplier ${s.supplier}. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
          }
          if (s.paymentMethod === 'custom') {
            if (isNaN(parseFloat(s.paidAmount)) || parseFloat(s.paidAmount) <= 0 || parseFloat(s.paidAmount) >= parseFloat(s.amount)) {
              return apiResponse.error(res, `Custom payment for supplier ${s.supplier} must have a valid paidAmount (0 < paidAmount < amount)`, 400);
            }
          }
        }
      }
    }

    const financialData = {
      revenue: revenue ? parseFloat(revenue) : undefined,
      prodCost: prodCost ? parseFloat(prodCost) : undefined,
      transFee: transFee ? parseFloat(transFee) : undefined,
      surcharge: surcharge ? parseFloat(surcharge) : undefined,
      received: received ? parseFloat(received) : undefined,
      balance: balance ? parseFloat(balance) : undefined,
      profit: profit ? parseFloat(profit) : undefined,
      invoiced: invoiced || undefined,
    };

    if (Object.values(financialData).some(val => val !== undefined)) {
      const revenueVal = financialData.revenue || 0;
      const prodCostVal = financialData.prodCost || 0;
      const transFeeVal = financialData.transFee || 0;
      const surchargeVal = financialData.surcharge || 0;
      const receivedVal = financialData.received || 0;
      financialData.profit = revenueVal - prodCostVal - transFeeVal - surchargeVal;
      financialData.balance = revenueVal - receivedVal;
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
        pcDate: pcDate ? new Date(pcDate) : undefined,
        issuedDate: issuedDate ? new Date(issuedDate) : undefined,
        paymentMethod,
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : undefined,
        supplier,
        travelDate: travelDate ? new Date(travelDate) : undefined,
        transactionMethod: transactionMethod || undefined,
        receivedDate: receivedDate ? new Date(receivedDate) : undefined,
        description: description || undefined,
        ...financialData,
        costItems: Array.isArray(costItems) && costItems.length > 0
          ? {
              deleteMany: {},
              create: costItems.map(item => ({
                category: item.category,
                amount: parseFloat(item.amount),
                suppliers: {
                  create: item.suppliers.map(s => ({
                    supplier: s.supplier,
                    amount: parseFloat(s.amount),
                    paymentMethod: s.paymentMethod || 'full',
                    paidAmount: s.paymentMethod === 'credit' ? 0 : s.paymentMethod === 'full' ? parseFloat(s.amount) : parseFloat(s.paidAmount) || 0,
                    pendingAmount: s.paymentMethod === 'credit' ? parseFloat(s.amount) : s.paymentMethod === 'full' ? 0 : (parseFloat(s.amount) - parseFloat(s.paidAmount)) || 0,
                  })),
                },
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
        passengers: Array.isArray(passengers) && passengers.length > 0
          ? {
              deleteMany: {},
              create: passengers.map(pax => ({
                title: pax.title,
                firstName: pax.firstName,
                middleName: pax.middleName || null,
                lastName: pax.lastName,
                gender: pax.gender,
                email: pax.email || null,
                contactNo: pax.contactNo || null,
                nationality: pax.nationality || null,
                birthday: pax.birthday ? new Date(pax.birthday) : null,
                category: pax.category,
              })),
            }
          : undefined,
      },
      include: {
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
      },
    });
    return apiResponse.success(res, booking, 200);
  } catch (error) {
    console.error('Error updating booking:', error);
    return apiResponse.error(res, `Failed to update booking: ${error.message}`, 500);
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

    return apiResponse.success(res, {
      totalBookings,
      pendingBookings,
      confirmedBookings,
      completedBookings,
      totalRevenue: totalRevenue._sum.revenue || 0,
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    return apiResponse.error(res, 'Failed to fetch dashboard stats: ' + error.message, 500);
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
        passengers: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            category: true,
          },
        },
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
        passengers: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            category: true,
          },
        },
      },
    });

    return apiResponse.success(res, {
      bookings: recentBookings,
      pendingBookings: recentPendingBookings,
    });
  } catch (error) {
    console.error('Error fetching recent bookings:', error);
    return apiResponse.error(res, 'Failed to fetch recent bookings: ' + error.message, 500);
  }
};

const getCustomerDeposits = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: { paymentMethod: { in: ['INTERNAL', 'INTERNAL_HUMM'] } },
      select: {
        id: true,
        refNo: true,
        paxName: true,
        agentName: true,
        pcDate: true,
        travelDate: true,
        received: true,
        instalments: { select: { id: true, dueDate: true, amount: true, status: true } },
        passengers: {
          select: {
            title: true,
            firstName: true,
            lastName: true,
            category: true,
          },
        },
      },
    });
    const formattedBookings = bookings.map(booking => ({
      ...booking,
      totalInstalments: booking.instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0).toFixed(2),
    }));
    return apiResponse.success(res, formattedBookings);
  } catch (error) {
    console.error('Error fetching customer deposits:', error);
    return apiResponse.error(res, `Failed to fetch customer deposits: ${error.message}`, 500);
  }
};

const updateInstalment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status } = req.body;
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return apiResponse.error(res, 'Amount must be a positive number', 400);
    }
    if (!['PENDING', 'PAID', 'OVERDUE'].includes(status)) {
      return apiResponse.error(res, `Invalid status. Must be one of: PENDING, PAID, OVERDUE`, 400);
    }
    const instalment = await prisma.instalment.findUnique({
      where: { id: parseInt(id) },
      include: { booking: true },
    });
    if (!instalment) {
      return apiResponse.error(res, 'Instalment not found', 404);
    }
    const updatedInstalment = await prisma.instalment.update({
      where: { id: parseInt(id) },
      data: { amount: parseFloat(amount), status },
    });
    const instalments = await prisma.instalment.findMany({
      where: { bookingId: instalment.bookingId },
    });
    const totalReceivedFromInstalments = instalments
      .filter(inst => inst.status === 'PAID')
      .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
    const initialReceived = instalment.booking.received || 0;
    const totalReceived = initialReceived + totalReceivedFromInstalments;
    const revenue = instalment.booking.revenue || 0;
    const balance = revenue - totalReceived;
    await prisma.booking.update({
      where: { id: instalment.bookingId },
      data: { received: totalReceived, balance: balance >= 0 ? balance : 0 },
    });
    return apiResponse.success(res, updatedInstalment);
  } catch (error) {
    console.error('Error updating instalment:', error);
    return apiResponse.error(res, `Failed to update instalment: ${error.message}`, 500);
  }
};

const getSuppliersInfo = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      select: {
        id: true,
        refNo: true,
        paxName: true,
        agentName: true,
        createdAt: true,
        costItems: {
          include: {
            suppliers: true,
          },
        },
      },
    });

    const supplierSummary = bookings.reduce((acc, booking) => {
      booking.costItems.forEach((item) => {
        item.suppliers.forEach((s) => {
          if (!acc[s.supplier]) {
            acc[s.supplier] = {
              totalAmount: 0,
              totalPaid: 0,
              totalPending: 0,
              bookings: [],
            };
          }
          acc[s.supplier].totalAmount += parseFloat(s.amount);
          acc[s.supplier].totalPaid += parseFloat(s.paidAmount) || (s.paymentMethod === 'full' ? parseFloat(s.amount) : 0);
          acc[s.supplier].totalPending += parseFloat(s.pendingAmount) || (s.paymentMethod === 'credit' ? parseFloat(s.amount) : 0);
          acc[s.supplier].bookings.push({
            bookingId: booking.id,
            refNo: booking.refNo,
            paxName: booking.paxName,
            agentName: booking.agentName,
            category: item.category,
            amount: parseFloat(s.amount),
            paymentMethod: s.paymentMethod,
            paidAmount: parseFloat(s.paidAmount) || (s.paymentMethod === 'full' ? parseFloat(s.amount) : 0),
            pendingAmount: parseFloat(s.pendingAmount) || (s.paymentMethod === 'credit' ? parseFloat(s.amount) : 0),
            createdAt: booking.createdAt,
          });
        });
      });
      return acc;
    }, {});

    return apiResponse.success(res, supplierSummary);
  } catch (error) {
    console.error('Error fetching suppliers info:', error);
    return apiResponse.error(res, `Failed to fetch suppliers info: ${error.message}`, 500);
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
  getCustomerDeposits,
  updateInstalment,
  getSuppliersInfo,
};