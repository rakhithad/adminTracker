const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

const createPendingBooking = async (req, res) => {
  console.log('Received body:', JSON.stringify(req.body, null, 2));

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
      'travelDate',
      'numPax', // Added
    ];
    const missingFields = requiredFields.filter((field) => !req.body[field] && req.body[field] !== 0);
    if (missingFields.length > 0) {
      return apiResponse.error(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
    }

    // Validate enum values
    const validTeams = ['PH', 'TOURS'];
    if (!validTeams.includes(req.body.team_name)) {
      return apiResponse.error(res, `Invalid team_name. Must be one of: ${validTeams.join(', ')}`, 400);
    }

    const validBookingTypes = ['FRESH', 'DATE_CHANGE', 'CANCELLATION'];
    if (!validBookingTypes.includes(req.body.bookingType)) {
      return apiResponse.error(res, `Invalid bookingType. Must be one of: ${validBookingTypes.join(', ')}`, 400);
    }

    const validPaymentMethods = ['FULL', 'INTERNAL', 'REFUND', 'HUMM', 'FULL_HUMM', 'INTERNAL_HUMM'];
    if (!validPaymentMethods.includes(req.body.paymentMethod)) {
      return apiResponse.error(res, `Invalid paymentMethod. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
    }

    // Validate transactionMethod
    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
    if (req.body.transactionMethod && !validTransactionMethods.includes(req.body.transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    // Validate numPax
    const numPax = parseInt(req.body.numPax);
    if (isNaN(numPax) || numPax < 1) {
      return apiResponse.error(res, 'numPax must be a positive integer', 400);
    }

    // Validate prodCostBreakdown
    const prodCostBreakdown = req.body.prodCostBreakdown || [];
    if (!Array.isArray(prodCostBreakdown)) {
      return apiResponse.error(res, 'prodCostBreakdown must be an array', 400);
    }

    const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
    const validSupplierPaymentMethods = [
      'BANK_TRANSFER',
      'CREDIT',
      'CREDIT_NOTES',
      'BANK_TRANSFER_AND_CREDIT',
      'BANK_TRANSFER_AND_CREDIT_NOTES',
      'CREDIT_AND_CREDIT_NOTES',
    ];
    for (const item of prodCostBreakdown) {
      if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
        return apiResponse.error(res, 'Each cost item must have a category and a positive amount', 400);
      }
      if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
        return apiResponse.error(res, 'Each cost item must have at least one supplier allocation', 400);
      }
      const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
      if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
        return apiResponse.error(res, 'Supplier amounts must sum to the cost item amount', 400);
      }
      for (const s of item.suppliers) {
        if (
          !s.supplier ||
          !validSuppliers.includes(s.supplier) ||
          isNaN(parseFloat(s.amount)) ||
          parseFloat(s.amount) <= 0 ||
          !validSupplierPaymentMethods.includes(s.paymentMethod) ||
          !validTransactionMethods.includes(s.transactionMethod)
        ) {
          return apiResponse.error(res, `Invalid supplier data for ${s.supplier}: must have valid supplier, amount, paymentMethod, and transactionMethod`, 400);
        }
        // Ensure paidAmount and pendingAmount are provided or default to 0
        const paidAmount = parseFloat(s.paidAmount) || 0;
        const pendingAmount = parseFloat(s.pendingAmount) || 0;
        if (isNaN(paidAmount) || isNaN(pendingAmount)) {
          return apiResponse.error(res, `Invalid paidAmount or pendingAmount for supplier ${s.supplier}`, 400);
        }
        if (['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(s.paymentMethod)) {
          const firstAmount = parseFloat(s.firstMethodAmount) || 0;
          const secondAmount = parseFloat(s.secondMethodAmount) || 0;
          if (firstAmount <= 0 || secondAmount <= 0 || Math.abs(firstAmount + secondAmount - parseFloat(s.amount)) > 0.01) {
            return apiResponse.error(res, `For supplier ${s.supplier}, combined payment method amounts must be positive and sum to the supplier amount`, 400);
          }
          const firstMethod = s.paymentMethod.split('_AND_')[0].toUpperCase();
          const secondMethod = s.paymentMethod.split('_AND_')[1].toUpperCase();
          const isFirstPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(firstMethod);
          const isSecondPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(secondMethod);
          if (
            Math.abs(paidAmount - ((isFirstPaid ? firstAmount : 0) + (isSecondPaid ? secondAmount : 0))) > 0.01 ||
            Math.abs(pendingAmount - ((isFirstPaid ? 0 : firstAmount) + (isSecondPaid ? 0 : secondAmount))) > 0.01
          ) {
            return apiResponse.error(res, `Paid and pending amounts for supplier ${s.supplier} must match payment method logic`, 400);
          }
        } else {
          const isPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(s.paymentMethod);
          if (
            Math.abs(paidAmount - (isPaid ? parseFloat(s.amount) : 0)) > 0.01 ||
            Math.abs(pendingAmount - (isPaid ? 0 : parseFloat(s.amount))) > 0.01 ||
            (s.firstMethodAmount && Math.abs(parseFloat(s.firstMethodAmount) - parseFloat(s.amount)) > 0.01) ||
            (s.secondMethodAmount && parseFloat(s.secondMethodAmount) > 0)
          ) {
            return apiResponse.error(res, `Payment amounts for supplier ${s.supplier} must match payment method logic`, 400);
          }
        }
      }
    }

    // Validate instalments
    const instalments = req.body.instalments || [];
    if (req.body.paymentMethod === 'INTERNAL' && instalments.length === 0) {
      return apiResponse.error(res, 'Instalments are required for INTERNAL payment method', 400);
    }
    for (const inst of instalments) {
      if (
        !inst.dueDate ||
        isNaN(parseFloat(inst.amount)) ||
        parseFloat(inst.amount) <= 0 ||
        !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')
      ) {
        return apiResponse.error(res, 'Each instalment must have a valid dueDate, positive amount, and valid status', 400);
      }
    }

    // Validate passenger data
    const passengers = req.body.passengers || [];
    if (!Array.isArray(passengers) || passengers.length === 0) {
      return apiResponse.error(res, 'Passengers must be a non-empty array', 400);
    }

    const validTitles = ['MR', 'MRS', 'MS', 'MASTER'];
    const validGenders = ['MALE', 'FEMALE', 'OTHER'];
    const validCategories = ['ADULT', 'CHILD', 'INFANT'];

    for (const pax of passengers) {
      console.log('Validating passenger:', JSON.stringify(pax, null, 2));
      const validationErrors = [];
      if (!pax.title || !validTitles.includes(pax.title)) validationErrors.push(`Invalid or missing title: ${pax.title}`);
      if (!pax.firstName) validationErrors.push('Missing firstName');
      if (!pax.lastName) validationErrors.push('Missing lastName');
      if (!pax.gender || !validGenders.includes(pax.gender)) validationErrors.push(`Invalid or missing gender: ${pax.gender}`);
      if (!pax.category || !validCategories.includes(pax.category)) validationErrors.push(`Invalid or missing category: ${pax.category}`);
      if (pax.birthday && isNaN(new Date(pax.birthday))) validationErrors.push(`Invalid birthday: ${pax.birthday}`);
      if (pax.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) validationErrors.push(`Invalid email: ${pax.email}`);
      if (pax.contactNo && !/^\+?\d{10,15}$/.test(pax.contactNo)) validationErrors.push(`Invalid contactNo: ${pax.contactNo}`);

      if (validationErrors.length > 0) {
        console.error('Passenger validation failed:', validationErrors);
        return apiResponse.error(res, `Passenger validation errors: ${validationErrors.join('; ')}`, 400);
      }
    }

    // Validate numPax against passengers
    if (numPax < passengers.length) {
      return apiResponse.error(res, 'numPax cannot be less than the number of passengers provided', 400);
    }

    // Calculate prodCost from prodCostBreakdown
    const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);

    // Verify provided prodCost matches calculatedProdCost
    if (req.body.prodCost && Math.abs(parseFloat(req.body.prodCost) - calculatedProdCost) > 0.01) {
      return apiResponse.error(res, 'Provided prodCost does not match the sum of prodCostBreakdown', 400);
    }

    // Verify instalments sum matches balance (for INTERNAL payment)
    if (instalments.length > 0) {
      const totalInstalments = instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
      const revenue = parseFloat(req.body.revenue) || 0;
      const received = parseFloat(req.body.received) || 0;
      const expectedBalance = revenue - received;
      if (Math.abs(totalInstalments - expectedBalance) > 0.01) {
        return apiResponse.error(res, 'Sum of instalments must equal the balance (revenue - received)', 400);
      }
    }

    // Prepare financial data
    const financialData = {
      revenue: req.body.revenue ? parseFloat(req.body.revenue) : null,
      prodCost: calculatedProdCost || null,
      transFee: req.body.transFee ? parseFloat(req.body.transFee) : null,
      surcharge: req.body.surcharge ? parseFloat(req.body.surcharge) : null,
      received: req.body.received ? parseFloat(req.body.received) : null,
      balance: null, // Will be recalculated
      profit: null, // Will be recalculated
      invoiced: req.body.invoiced || null,
    };

    // Recalculate profit and balance
    const revenue = financialData.revenue || 0;
    const prodCost = financialData.prodCost || 0;
    const transFee = financialData.transFee || 0;
    const surcharge = financialData.surcharge || 0;
    const received = financialData.received || 0;
    financialData.profit = revenue - prodCost - transFee - surcharge;
    financialData.balance = revenue - received;

    // Create pending booking
    const pendingBooking = await prisma.pendingBooking.create({
      data: {
        refNo: req.body.ref_no,
        paxName: req.body.pax_name,
        agentName: req.body.agent_name,
        teamName: req.body.team_name || null,
        pnr: req.body.pnr,
        airline: req.body.airline,
        fromTo: req.body.from_to,
        bookingType: req.body.bookingType,
        bookingStatus: 'PENDING',
        pcDate: new Date(req.body.pcDate),
        issuedDate: req.body.issuedDate ? new Date(req.body.issuedDate) : null,
        paymentMethod: req.body.paymentMethod,
        lastPaymentDate: req.body.lastPaymentDate ? new Date(req.body.lastPaymentDate) : null,
        travelDate: req.body.travelDate ? new Date(req.body.travelDate) : null,
        // supplier: null, // Omitted as unused; uncomment if needed
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
                paymentMethod: s.paymentMethod,
                paidAmount: parseFloat(s.paidAmount) || 0,
                pendingAmount: parseFloat(s.pendingAmount) || 0,
                transactionMethod: s.transactionMethod,
                firstMethodAmount: s.firstMethodAmount ? parseFloat(s.firstMethodAmount) : null,
                secondMethodAmount: s.secondMethodAmount ? parseFloat(s.secondMethodAmount) : null,
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
        numPax: numPax,
      },
      include: {
        costItems: { include: { suppliers: true } },
        instalments: true,
        passengers: true,
      },
    });

    return apiResponse.success(res, pendingBooking, 201);
  } catch (error) {
    console.error('Pending booking creation error:', error);
    if (error.name === 'PrismaClientValidationError') {
      return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
    }
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'Pending booking with this reference number already exists', 409);
    }
    if (error.code === 'P2003') {
      return apiResponse.error(res, 'Invalid enum value provided', 400);
    }
    return apiResponse.error(res, `Failed to create pending booking: ${error.message}`, 500);
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

    if (!pendingBooking.numPax || pendingBooking.numPax < pendingBooking.passengers.length) {
      return apiResponse.error(res, `Invalid numPax: must be at least ${pendingBooking.passengers.length}`, 400);
    }

    const booking = await prisma.booking.create({
      data: {
        refNo: pendingBooking.refNo,
        paxName: pendingBooking.paxName,
        agentName: pendingBooking.agentName,
        teamName: pendingBooking.teamName || null,
        pnr: pendingBooking.pnr,
        airline: pendingBooking.airline,
        fromTo: pendingBooking.fromTo,
        bookingType: pendingBooking.bookingType,
        bookingStatus: 'CONFIRMED',
        pcDate: pendingBooking.pcDate,
        issuedDate: pendingBooking.issuedDate || null,
        paymentMethod: pendingBooking.paymentMethod,
        lastPaymentDate: pendingBooking.lastPaymentDate || null,
        travelDate: pendingBooking.travelDate || null,
        revenue: pendingBooking.revenue ? parseFloat(pendingBooking.revenue) : null,
        prodCost: pendingBooking.prodCost ? parseFloat(pendingBooking.prodCost) : null,
        transFee: pendingBooking.transFee ? parseFloat(pendingBooking.transFee) : null,
        surcharge: pendingBooking.surcharge ? parseFloat(pendingBooking.surcharge) : null,
        received: pendingBooking.received ? parseFloat(pendingBooking.received) : null,
        transactionMethod: pendingBooking.transactionMethod || null,
        receivedDate: pendingBooking.receivedDate || null,
        balance: pendingBooking.balance ? parseFloat(pendingBooking.balance) : null,
        profit: pendingBooking.profit ? parseFloat(pendingBooking.profit) : null,
        invoiced: pendingBooking.invoiced || null,
        description: pendingBooking.description || null,
        numPax: pendingBooking.numPax,
        costItems: {
          create: pendingBooking.costItems.map((item) => ({
            category: item.category,
            amount: parseFloat(item.amount),
            suppliers: {
              create: item.suppliers.map((s) => ({
                supplier: s.supplier,
                amount: parseFloat(s.amount),
                paymentMethod: s.paymentMethod,
                paidAmount: parseFloat(s.paidAmount) || 0,
                pendingAmount: parseFloat(s.pendingAmount) || 0,
                transactionMethod: s.transactionMethod,
                firstMethodAmount: s.firstMethodAmount ? parseFloat(s.firstMethodAmount) : null,
                secondMethodAmount: s.secondMethodAmount ? parseFloat(s.secondMethodAmount) : null,
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

    await prisma.pendingBooking.update({
      where: { id: bookingId },
      data: { status: 'APPROVED' },
    });

    return apiResponse.success(res, booking, 200);
  } catch (error) {
    console.error('Error approving booking:', error);
    if (error.name === 'PrismaClientValidationError') {
      return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
    }
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'Booking with this reference number already exists', 409);
    }
    if (error.code === 'P2003') {
      return apiResponse.error(res, 'Invalid enum value provided', 400);
    }
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

    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
    if (req.body.transactionMethod && !validTransactionMethods.includes(req.body.transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    const prodCostBreakdown = req.body.prodCostBreakdown || [];
    if (!Array.isArray(prodCostBreakdown)) {
      return apiResponse.error(res, "prodCostBreakdown must be an array", 400);
    }

    const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
    const validPaymentMethods = [
      'BANK_TRANSFER',
      'CREDIT',
      'CREDIT_NOTES',
      'BANK_TRANSFER_AND_CREDIT',
      'BANK_TRANSFER_AND_CREDIT_NOTES',
      'CREDIT_AND_CREDIT_NOTES',
    ];
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
        if (!validTransactionMethods.includes(s.transactionMethod)) {
          return apiResponse.error(res, `Invalid transaction method for supplier ${s.supplier}. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
        }
        if (
          ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
            s.paymentMethod
          )
        ) {
          const firstAmount = parseFloat(s.firstMethodAmount) || 0;
          const secondAmount = parseFloat(s.secondMethodAmount) || 0;
          if (
            firstAmount <= 0 ||
            secondAmount <= 0 ||
            Math.abs(firstAmount + secondAmount - parseFloat(s.amount)) > 0.01
          ) {
            return apiResponse.error(
              res,
              `For supplier ${s.supplier}, combined payment method amounts must be positive and sum to the supplier amount`,
              400
            );
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
                paymentMethod: s.paymentMethod,
                paidAmount: parseFloat(s.paidAmount) || 0,
                pendingAmount: parseFloat(s.pendingAmount) || 0,
                transactionMethod: s.transactionMethod,
                firstMethodAmount: parseFloat(s.firstMethodAmount) || null,
                secondMethodAmount: parseFloat(s.secondMethodAmount) || null,
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

    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
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
      const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
      const validPaymentMethods = [
        'BANK_TRANSFER',
        'CREDIT',
        'CREDIT_NOTES',
        'BANK_TRANSFER_AND_CREDIT',
        'BANK_TRANSFER_AND_CREDIT_NOTES',
        'CREDIT_AND_CREDIT_NOTES',
      ];
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
          if (!s.supplier || !validSuppliers.includes(s.supplier) || isNaN(parseFloat(s.amount)) || parseFloat(s.amount) <= 0) {
            return apiResponse.error(res, "Each supplier allocation must have a valid supplier and positive amount", 400);
          }
          if (!validPaymentMethods.includes(s.paymentMethod)) {
            return apiResponse.error(res, `Invalid payment method for supplier ${s.supplier}. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
          }
          if (!validTransactionMethods.includes(s.transactionMethod)) {
            return apiResponse.error(res, `Invalid transaction method for supplier ${s.supplier}. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
          }
          if (
            ['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(
              s.paymentMethod
            )
          ) {
            const firstAmount = parseFloat(s.firstMethodAmount) || 0;
            const secondAmount = parseFloat(s.secondMethodAmount) || 0;
            if (
              firstAmount <= 0 ||
              secondAmount <= 0 ||
              Math.abs(firstAmount + secondAmount - parseFloat(s.amount)) > 0.01
            ) {
              return apiResponse.error(
                res,
                `For supplier ${s.supplier}, combined payment method amounts must be positive and sum to the supplier amount`,
                400
              );
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
                    paymentMethod: s.paymentMethod,
                    paidAmount: parseFloat(s.paidAmount) || 0,
                    pendingAmount: parseFloat(s.pendingAmount) || 0,
                    transactionMethod: s.transactionMethod,
                    firstMethodAmount: parseFloat(s.firstMethodAmount) || null,
                    secondMethodAmount: parseFloat(s.secondMethodAmount) || null,
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


const updateInstalment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, status, transactionMethod, paymentDate } = req.body;

    // ... (Your existing validation logic is good, keep it here)
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) { /* ... */ }
    if (!['PENDING', 'PAID', 'OVERDUE'].includes(status)) { /* ... */ }
    // ... etc.

    const instalmentToUpdate = await prisma.instalment.findUnique({
      where: { id: parseInt(id) },
      include: { 
        booking: {
            include: {
                instalments: true // Fetch all instalments for the booking
            }
        } 
      },
    });


    if (!instalmentToUpdate) {
      return apiResponse.error(res, 'Instalment not found', 404);
    }
    
    const currentTotalReceived = parseFloat(instalmentToUpdate.booking.received || 0);
    const sumOfPaidInstalments_beforeUpdate = instalmentToUpdate.booking.instalments
      .filter(inst => inst.status === 'PAID')
      .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
    const initialDeposit = currentTotalReceived - sumOfPaidInstalments_beforeUpdate;



    
    if (status === 'PAID') {
        await prisma.instalmentPayment.create({
            data: {
                instalmentId: parseInt(id),
                amount: parseFloat(amount),
                transactionMethod,
                paymentDate: new Date(paymentDate),
            },
        });
    }

    const updatedInstalment = await prisma.instalment.update({
      where: { id: parseInt(id) },
      data: { 
          amount: parseFloat(amount), 
          status 
      },
      include: { payments: true } // Include payments in the returned instalment
    });
    
    // --- START: CRITICAL RECALCULATION LOGIC ---
    // Recalculate the total received amount for the entire booking from scratch
    const allInstalments_afterUpdate = await prisma.instalment.findMany({
        where: { bookingId: instalmentToUpdate.bookingId },
    });

    const sumOfPaidInstalments_afterUpdate = allInstalments_afterUpdate
        .filter(inst => inst.status === 'PAID')
        .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);

    const newTotalReceived = initialDeposit + sumOfPaidInstalments_afterUpdate;
    const bookingRevenue = parseFloat(instalmentToUpdate.booking.revenue || 0);
    const newBalance = bookingRevenue - newTotalReceived;
    
    const updatedBooking = await prisma.booking.update({
        where: { id: instalmentToUpdate.bookingId },
        data: {
            received: newTotalReceived,
            balance: newBalance,
            lastPaymentDate: status === 'PAID' ? new Date(paymentDate) : instalmentToUpdate.booking.lastPaymentDate,
        }
    });
    
    // --- END: CRITICAL RECALCULATION LOGIC ---

    // Return a comprehensive payload to the frontend
    return apiResponse.success(res, {
        updatedInstalment,
        bookingUpdate: {
            id: updatedBooking.id,
            received: updatedBooking.received,
            balance: updatedBooking.balance
        }
    });

  } catch (error) {
    console.error('Error updating instalment:', error);
    return apiResponse.error(res, `Failed to update instalment: ${error.message}`, 500);
  }
};

const getCustomerDeposits = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        paymentMethod: {
          in: ['INTERNAL', 'INTERNAL_HUMM'],
        },
      },
      select: {
        id: true,
        refNo: true,
        paxName: true,
        agentName: true,
        pcDate: true,
        travelDate: true,
        revenue: true,
        received: true,
        // We need the original transactionMethod and receivedDate for the initial deposit
        transactionMethod: true,
        receivedDate: true,
        instalments: {
          select: {
            id: true,
            dueDate: true,
            amount: true,
            status: true,
            createdAt: true,
            payments: {
              select: {
                id: true,
                amount: true,
                transactionMethod: true,
                paymentDate: true,
                createdAt: true,
              },
            },
          },
        },
      },
    });

    const formattedBookings = bookings.map((booking) => {
      const totalReceivedFromDb = parseFloat(booking.received || 0);
      const revenue = parseFloat(booking.revenue || 0);

      const sumOfPaidInstalments = booking.instalments
        .filter((inst) => inst.status === 'PAID')
        .reduce((sum, inst) => {
            const paymentTotal = inst.payments.reduce((pSum, p) => pSum + parseFloat(p.amount), 0);
            return sum + paymentTotal;
        }, 0);
      
      const initialDeposit = totalReceivedFromDb - sumOfPaidInstalments;

      // --- NEW: Assembling the Unified Payment History ---
      const paymentHistory = [];

      // 1. Add the Initial Deposit to the history
      if (initialDeposit > 0) {
        paymentHistory.push({
          type: 'Initial Deposit',
          date: booking.receivedDate || booking.pcDate, // Fallback to pcDate
          amount: initialDeposit,
          method: booking.transactionMethod || 'N/A',
          status: 'Paid',
        });
      }

      // 2. Add all instalment and settlement payments
      booking.instalments.forEach(instalment => {
        instalment.payments.forEach(payment => {
          paymentHistory.push({
            type: instalment.status === 'SETTLEMENT' ? 'Final Settlement' : `Instalment (Due ${new Date(instalment.dueDate).toLocaleDateString('en-GB')})`,
            date: payment.paymentDate,
            amount: parseFloat(payment.amount),
            method: payment.transactionMethod,
            status: 'Paid',
          });
        });
      });
      
      // 3. Sort the entire history chronologically
      paymentHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      return {
        // Return all original fields plus the new calculated ones
        ...booking,
        revenue: revenue.toFixed(2),
        received: totalReceivedFromDb.toFixed(2),
        balance: (revenue - totalReceivedFromDb).toFixed(2),
        initialDeposit: initialDeposit.toFixed(2),
        paymentHistory: paymentHistory, // Attach the new history array
      };
    });

    return apiResponse.success(res, formattedBookings);
  } catch (error) {
    console.error('Error fetching customer deposits:', error);
    return apiResponse.error(res, `Failed to fetch customer deposits: ${error.message}`, 500);
  }
};

const createSupplierPaymentSettlement = async (req, res) => {
  try {
    const { costItemSupplierId, amount, transactionMethod, settlementDate } = req.body;

    // Validate required fields
    if (!costItemSupplierId || isNaN(parseFloat(amount)) || amount <= 0 || !transactionMethod || !settlementDate) {
      return apiResponse.error(res, 'Missing or invalid required fields: costItemSupplierId, amount, transactionMethod, settlementDate', 400);
    }

    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
    if (!validTransactionMethods.includes(transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    // Validate settlement date
    if (isNaN(new Date(settlementDate))) {
      return apiResponse.error(res, 'Invalid settlementDate', 400);
    }

    // Fetch the CostItemSupplier
    const costItemSupplier = await prisma.costItemSupplier.findUnique({
      where: { id: parseInt(costItemSupplierId) },
    });

    if (!costItemSupplier) {
      return apiResponse.error(res, 'CostItemSupplier not found', 404);
    }

    // Validate amount does not exceed pending amount
    const pendingAmount = parseFloat(costItemSupplier.pendingAmount) || 0;
    if (parseFloat(amount) > pendingAmount) {
      return apiResponse.error(res, `Settlement amount (£${amount}) exceeds pending amount (£${pendingAmount.toFixed(2)})`, 400);
    }

    // Create the settlement record
    const newSettlement = await prisma.supplierPaymentSettlement.create({
      data: {
        costItemSupplierId: parseInt(costItemSupplierId),
        amount: parseFloat(amount),
        transactionMethod,
        settlementDate: new Date(settlementDate),
      },
    });

    // Update CostItemSupplier paidAmount and pendingAmount
    const newPaidAmount = (parseFloat(costItemSupplier.paidAmount) || 0) + parseFloat(amount);
    const newPendingAmount = pendingAmount - parseFloat(amount);

    const updatedCostItemSupplier = await prisma.costItemSupplier.update({
      where: { id: parseInt(costItemSupplierId) },
      data: {
        paidAmount: newPaidAmount,
        pendingAmount: newPendingAmount,
      },
      // Also include all settlements so the frontend has the full, updated history
      include: {
        settlements: true,
      },
    });

    // Return a comprehensive payload with the newly created record and the updated parent record
    return apiResponse.success(res, { newSettlement, updatedCostItemSupplier }, 201);
  } catch (error) {
    console.error('Error creating supplier payment settlement:', error);
    if (error.name === 'PrismaClientValidationError') {
      return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
    }
    return apiResponse.error(res, `Failed to create supplier payment settlement: ${error.message}`, 500);
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
            suppliers: {
              include: {
                settlements: true, // Include settlement history
              },
            },
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
          acc[s.supplier].totalPaid += parseFloat(s.paidAmount) || 0;
          acc[s.supplier].totalPending += parseFloat(s.pendingAmount) || 0;
          acc[s.supplier].bookings.push({
            bookingId: booking.id,
            refNo: booking.refNo,
            paxName: booking.paxName,
            agentName: booking.agentName,
            category: item.category,
            amount: parseFloat(s.amount),
            paymentMethod: s.paymentMethod,
            paidAmount: parseFloat(s.paidAmount) || 0,
            pendingAmount: parseFloat(s.pendingAmount) || 0,
            createdAt: booking.createdAt,
            costItemSupplierId: s.id, // Include for settlement reference
            settlements: s.settlements.map((settlement) => ({
              id: settlement.id,
              amount: parseFloat(settlement.amount),
              transactionMethod: settlement.transactionMethod,
              settlementDate: settlement.settlementDate,
              createdAt: settlement.createdAt,
            })),
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

const updatePendingBooking = async (req, res) => {
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
      paymentMethod,
      pcDate,
      issuedDate,
      lastPaymentDate,
      travelDate,
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
      costItems,
      instalments,
      passengers,
      numPax,
    } = updates;

    // Validate required fields if provided
    const validTeams = ['PH', 'TOURS'];
    if (teamName && !validTeams.includes(teamName)) {
      return apiResponse.error(res, `Invalid team_name. Must be one of: ${validTeams.join(', ')}`, 400);
    }

    const validBookingTypes = ['FRESH', 'DATE_CHANGE', 'CANCELLATION'];
    if (bookingType && !validBookingTypes.includes(bookingType)) {
      return apiResponse.error(res, `Invalid bookingType. Must be one of: ${validBookingTypes.join(', ')}`, 400);
    }

    const validPaymentMethods = ['FULL', 'INTERNAL', 'REFUND', 'HUMM', 'FULL_HUMM', 'INTERNAL_HUMM'];
    if (paymentMethod && !validPaymentMethods.includes(paymentMethod)) {
      return apiResponse.error(res, `Invalid paymentMethod. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
    }

    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
    if (transactionMethod && !validTransactionMethods.includes(transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    // Validate numPax if provided
    if (numPax !== undefined && (isNaN(parseInt(numPax)) || parseInt(numPax) < 1)) {
      return apiResponse.error(res, 'numPax must be a positive integer', 400);
    }

    // Validate costItems if provided
    if (costItems) {
      if (!Array.isArray(costItems)) {
        return apiResponse.error(res, 'costItems must be an array', 400);
      }
      const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
      const validSupplierPaymentMethods = [
        'BANK_TRANSFER',
        'CREDIT',
        'CREDIT_NOTES',
        'BANK_TRANSFER_AND_CREDIT',
        'BANK_TRANSFER_AND_CREDIT_NOTES',
        'CREDIT_AND_CREDIT_NOTES',
      ];
      for (const item of costItems) {
        if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
          return apiResponse.error(res, 'Each cost item must have a category and a positive amount', 400);
        }
        if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
          return apiResponse.error(res, 'Each cost item must have at least one supplier allocation', 400);
        }
        const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
        if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
          return apiResponse.error(res, 'Supplier amounts must sum to the cost item amount', 400);
        }
        for (const s of item.suppliers) {
          if (
            !s.supplier ||
            !validSuppliers.includes(s.supplier) ||
            isNaN(parseFloat(s.amount)) ||
            parseFloat(s.amount) <= 0 ||
            !validSupplierPaymentMethods.includes(s.paymentMethod) ||
            !validTransactionMethods.includes(s.transactionMethod)
          ) {
            return apiResponse.error(res, `Invalid supplier data for ${s.supplier}: must have valid supplier, amount, paymentMethod, and transactionMethod`, 400);
          }
          const paidAmount = parseFloat(s.paidAmount) || 0;
          const pendingAmount = parseFloat(s.pendingAmount) || 0;
          if (isNaN(paidAmount) || isNaN(pendingAmount)) {
            return apiResponse.error(res, `Invalid paidAmount or pendingAmount for supplier ${s.supplier}`, 400);
          }
          if (['BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES'].includes(s.paymentMethod)) {
            const firstAmount = parseFloat(s.firstMethodAmount) || 0;
            const secondAmount = parseFloat(s.secondMethodAmount) || 0;
            if (firstAmount <= 0 || secondAmount <= 0 || Math.abs(firstAmount + secondAmount - parseFloat(s.amount)) > 0.01) {
              return apiResponse.error(res, `For supplier ${s.supplier}, combined payment method amounts must be positive and sum to the supplier amount`, 400);
            }
            const firstMethod = s.paymentMethod.split('_AND_')[0].toUpperCase();
            const secondMethod = s.paymentMethod.split('_AND_')[1].toUpperCase();
            const isFirstPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(firstMethod);
            const isSecondPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(secondMethod);
            if (
              Math.abs(paidAmount - ((isFirstPaid ? firstAmount : 0) + (isSecondPaid ? secondAmount : 0))) > 0.01 ||
              Math.abs(pendingAmount - ((isFirstPaid ? 0 : firstAmount) + (isSecondPaid ? 0 : secondAmount))) > 0.01
            ) {
              return apiResponse.error(res, `Paid and pending amounts for supplier ${s.supplier} must match payment method logic`, 400);
            }
          } else {
            const isPaid = ['BANK_TRANSFER', 'CREDIT_NOTES'].includes(s.paymentMethod);
            if (
              Math.abs(paidAmount - (isPaid ? parseFloat(s.amount) : 0)) > 0.01 ||
              Math.abs(pendingAmount - (isPaid ? 0 : parseFloat(s.amount))) > 0.01 ||
              (s.firstMethodAmount && Math.abs(parseFloat(s.firstMethodAmount) - parseFloat(s.amount)) > 0.01) ||
              (s.secondMethodAmount && parseFloat(s.secondMethodAmount) > 0)
            ) {
              return apiResponse.error(res, `Payment amounts for supplier ${s.supplier} must match payment method logic`, 400);
            }
          }
        }
      }
      // Validate prodCost matches sum of costItems
      const calculatedProdCost = costItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      if (prodCost && Math.abs(parseFloat(prodCost) - calculatedProdCost) > 0.01) {
        return apiResponse.error(res, 'Provided prodCost does not match the sum of costItems', 400);
      }
    }

    // Validate instalments if provided
    if (instalments) {
      if (!Array.isArray(instalments)) {
        return apiResponse.error(res, 'instalments must be an array', 400);
      }
      for (const inst of instalments) {
        if (
          !inst.dueDate ||
          isNaN(parseFloat(inst.amount)) ||
          parseFloat(inst.amount) <= 0 ||
          !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')
        ) {
          return apiResponse.error(res, 'Each instalment must have a valid dueDate, positive amount, and valid status', 400);
        }
      }
      if (paymentMethod === 'INTERNAL' && instalments.length === 0) {
        return apiResponse.error(res, 'Instalments are required for INTERNAL payment method', 400);
      }
      if (balance) {
        const totalInstalments = instalments.reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
        const revenueVal = revenue ? parseFloat(revenue) : 0;
        const receivedVal = received ? parseFloat(received) : 0;
        const expectedBalance = revenueVal - receivedVal;
        if (Math.abs(totalInstalments - expectedBalance) > 0.01) {
          return apiResponse.error(res, 'Sum of instalments must equal the balance (revenue - received)', 400);
        }
      }
    }

    // Validate passengers if provided
    if (passengers) {
      if (!Array.isArray(passengers) || passengers.length === 0) {
        return apiResponse.error(res, 'passengers must be a non-empty array', 400);
      }
      const validTitles = ['MR', 'MRS', 'MS', 'MASTER'];
      const validGenders = ['MALE', 'FEMALE', 'OTHER'];
      const validCategories = ['ADULT', 'CHILD', 'INFANT'];
      for (const pax of passengers) {
        const validationErrors = [];
        if (!pax.title || !validTitles.includes(pax.title)) validationErrors.push(`Invalid or missing title: ${pax.title}`);
        if (!pax.firstName) validationErrors.push('Missing firstName');
        if (!pax.lastName) validationErrors.push('Missing lastName');
        if (!pax.gender || !validGenders.includes(pax.gender)) validationErrors.push(`Invalid or missing gender: ${pax.gender}`);
        if (!pax.category || !validCategories.includes(pax.category)) validationErrors.push(`Invalid or missing category: ${pax.category}`);
        if (pax.birthday && isNaN(new Date(pax.birthday))) validationErrors.push(`Invalid birthday: ${pax.birthday}`);
        if (pax.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) validationErrors.push(`Invalid email: ${pax.email}`);
        if (pax.contactNo && !/^\+?\d{10,15}$/.test(pax.contactNo)) validationErrors.push(`Invalid contactNo: ${pax.contactNo}`);
        if (validationErrors.length > 0) {
          return apiResponse.error(res, `Passenger validation errors: ${validationErrors.join('; ')}`, 400);
        }
      }
      // Validate numPax against passengers
      if (numPax !== undefined && parseInt(numPax) < passengers.length) {
        return apiResponse.error(res, 'numPax cannot be less than the number of passengers provided', 400);
      }
    }

    // Prepare financial data
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

    // Recalculate profit and balance if financial data is provided
    if (Object.values(financialData).some(val => val !== undefined)) {
      const revenueVal = financialData.revenue || 0;
      const prodCostVal = financialData.prodCost || 0;
      const transFeeVal = financialData.transFee || 0;
      const surchargeVal = financialData.surcharge || 0;
      const receivedVal = financialData.received || 0;
      financialData.profit = revenueVal - prodCostVal - transFeeVal - surchargeVal;
      financialData.balance = revenueVal - receivedVal;
    }

    // Update the pending booking
    const pendingBooking = await prisma.pendingBooking.update({
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
        pcDate: pcDate ? new Date(pcDate) : undefined,
        issuedDate: issuedDate ? new Date(issuedDate) : undefined,
        paymentMethod,
        lastPaymentDate: lastPaymentDate ? new Date(lastPaymentDate) : undefined,
        travelDate: travelDate ? new Date(travelDate) : undefined,
        transactionMethod: transactionMethod || undefined,
        receivedDate: receivedDate ? new Date(receivedDate) : undefined,
        description: description || undefined,
        numPax: numPax !== undefined ? parseInt(numPax) : undefined,
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
                    paymentMethod: s.paymentMethod,
                    paidAmount: parseFloat(s.paidAmount) || 0,
                    pendingAmount: parseFloat(s.pendingAmount) || 0,
                    transactionMethod: s.transactionMethod,
                    firstMethodAmount: parseFloat(s.firstMethodAmount) || null,
                    secondMethodAmount: parseFloat(s.secondMethodAmount) || null,
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
                status: inst.status || 'PENDING',
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

    return apiResponse.success(res, pendingBooking, 200);
  } catch (error) {
    console.error('Error updating pending booking:', error);
    if (error.name === 'PrismaClientValidationError') {
      return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
    }
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'Pending booking with this reference number already exists', 409);
    }
    if (error.code === 'P2003') {
      return apiResponse.error(res, 'Invalid enum value provided', 400);
    }
    return apiResponse.error(res, `Failed to update pending booking: ${error.message}`, 500);
  }
};

const recordSettlementPayment = async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { amount, transactionMethod, paymentDate } = req.body;

    // --- 1. Validation ---
    if (!bookingId || isNaN(parseInt(bookingId))) {
      return apiResponse.error(res, 'Invalid Booking ID', 400);
    }
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return apiResponse.error(res, 'Payment amount must be a positive number', 400);
    }

    const booking = await prisma.booking.findUnique({
      where: { id: parseInt(bookingId) },
      include: { instalments: true },
    });

    if (!booking) {
      return apiResponse.error(res, 'Booking not found', 404);
    }
    if (paymentAmount > booking.balance) {
        return apiResponse.error(res, `Payment (£${paymentAmount.toFixed(2)}) exceeds balance (£${booking.balance.toFixed(2)})`, 400);
    }

    // --- 2. Find or Create the Special "SETTLEMENT" Instalment ---
    let settlementInstalment = booking.instalments.find(inst => inst.status === 'SETTLEMENT');

    if (!settlementInstalment) {
      // It doesn't exist, so create it. This happens on the first settlement payment.
      settlementInstalment = await prisma.instalment.create({
        data: {
          bookingId: booking.id,
          dueDate: new Date(),
          // The initial amount is the entire remaining balance
          amount: booking.balance,
          status: 'SETTLEMENT',
        },
      });
    }

    // --- 3. Record the Actual Payment ---
    await prisma.instalmentPayment.create({
      data: {
        instalmentId: settlementInstalment.id,
        amount: paymentAmount,
        transactionMethod,
        paymentDate: new Date(paymentDate),
      },
    });

    // --- 4. Recalculate Totals for the Booking (CRITICAL for data integrity) ---
    // This logic should be familiar from your updateInstalment controller
    const allInstalments = await prisma.instalment.findMany({
        where: { bookingId: booking.id },
        include: { payments: true }
    });

    // Recalculate initial deposit
    const totalReceivedFromDb = parseFloat(booking.received || 0);
    const sumOfPaidScheduledInstalments = booking.instalments
      .filter((inst) => inst.status === 'PAID')
      .reduce((sum, inst) => sum + parseFloat(inst.amount), 0);
    const initialDeposit = totalReceivedFromDb - sumOfPaidScheduledInstalments;

    // Recalculate total received from all paid instalments
    const newSumOfPaidInstalments = allInstalments
        .filter(inst => inst.status === 'PAID')
        .reduce((sum, inst) => sum + inst.amount, 0);

    // Recalculate total received from the settlement instalment's payments
    const settlementPaymentsTotal = allInstalments
        .find(inst => inst.status === 'SETTLEMENT')?.payments
        .reduce((sum, p) => sum + p.amount, 0) || 0;
        
    const newTotalReceived = initialDeposit + newSumOfPaidInstalments + settlementPaymentsTotal;
    const newBalance = parseFloat(booking.revenue) - newTotalReceived;

    const updatedBooking = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        received: newTotalReceived,
        balance: newBalance,
        lastPaymentDate: new Date(paymentDate),
      },
    });

    // --- 5. Return a useful payload to the frontend ---
    return apiResponse.success(res, {
        bookingUpdate: {
            id: updatedBooking.id,
            received: updatedBooking.received,
            balance: updatedBooking.balance
        }
    });

  } catch (error) {
    console.error('Error recording settlement payment:', error);
    return apiResponse.error(res, `Failed to record settlement: ${error.message}`, 500);
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
  createSupplierPaymentSettlement,
  updatePendingBooking,
  recordSettlementPayment
};