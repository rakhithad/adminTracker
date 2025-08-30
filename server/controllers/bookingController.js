const { PrismaClient } = require('@prisma/client');

const apiResponse = require('../utils/apiResponse');
const { createAuditLog, ActionType } = require('../utils/auditLogger');

const prisma = new PrismaClient();

const compareFolderNumbers = (a, b) => {
  if (!a || !b) return 0;
  const partsA = a.toString().split('.').map(part => parseInt(part, 10));
  const partsB = b.toString().split('.').map(part => parseInt(part, 10));
  const mainA = partsA[0];
  const mainB = partsB[0];
  if (mainA !== mainB) return mainA - mainB;
  const subA = partsA.length > 1 ? partsA[1] : 0;
  const subB = partsB.length > 1 ? partsB[1] : 0;
  return subA - subB;
};

const compareAndLogChanges = async (tx, { modelName, recordId, userId, oldRecord, newRecord, updates }) => {
  const changes = [];
  // Get a list of all fields that were part of the update request
  const fieldsToCheck = Object.keys(updates);

  for (const key of fieldsToCheck) {
    // We don't log complex array/object updates in detail for now.
    // This can be expanded later if needed.
    if (Array.isArray(updates[key]) || typeof updates[key] === 'object' && updates[key] !== null) {
      changes.push({
        fieldName: key,
        oldValue: '(Previous Collection)',
        newValue: '(Updated Collection)',
      });
      continue;
    }

    // Only log if the value has actually changed.
    // We convert to string for a reliable, type-agnostic comparison.
    if (String(oldRecord[key]) !== String(newRecord[key])) {
      changes.push({
        fieldName: key,
        oldValue: oldRecord[key],
        newValue: newRecord[key],
      });
    }
  }

  if (changes.length > 0) {
    await createAuditLog(tx, {
      userId,
      modelName,
      recordId,
      action: ActionType.UPDATE,
      changes,
    });
  }
};

const createPendingBooking = async (req, res) => {
  console.log('Received body for pending booking:', JSON.stringify(req.body, null, 2));

  const { id: userId } = req.user;

  try {
    const pendingBooking = await prisma.$transaction(async (tx) => {
      const initialPayments = req.body.initialPayments || [];

      const requiredFields = [ 'ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'travelDate', 'numPax' ];
      const missingFields = requiredFields.filter((field) => !req.body[field] && req.body[field] !== 0);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      if (initialPayments.length === 0) {
        throw new Error('At least one initial payment must be provided.');
      }

      const prodCostBreakdown = req.body.prodCostBreakdown || [];
      for (const item of prodCostBreakdown) {
        for (const s of item.suppliers) {
          if (s.paymentMethod.includes('CREDIT_NOTES')) {
            const amountToCoverByNotes = (s.paymentMethod === 'CREDIT_NOTES')
              ? (parseFloat(s.firstMethodAmount) || 0)
              : (parseFloat(s.secondMethodAmount) || 0);
            const totalAppliedFromNotes = (s.selectedCreditNotes || []).reduce((sum, note) => sum + note.amountToUse, 0);
            if (Math.abs(totalAppliedFromNotes - amountToCoverByNotes) > 0.01) {
              throw new Error(`For supplier ${s.supplier}, the applied credit notes total (£${totalAppliedFromNotes.toFixed(2)}) does not match the required amount (£${amountToCoverByNotes.toFixed(2)}).`);
            }
            for (const usedNote of (s.selectedCreditNotes || [])) {
              const creditNote = await tx.supplierCreditNote.findUnique({ where: { id: usedNote.id } });
              if (!creditNote) throw new Error(`Credit Note with ID ${usedNote.id} not found.`);
              if (creditNote.supplier !== s.supplier) throw new Error(`Credit Note ID ${usedNote.id} does not belong to supplier ${s.supplier}.`);
              if (creditNote.remainingAmount < usedNote.amountToUse) {
                throw new Error(`Credit Note ID ${usedNote.id} has insufficient funds.`);
              }
            }
          }
        }
      }

      const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      const calculatedReceived = initialPayments.reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const revenue = req.body.revenue ? parseFloat(req.body.revenue) : 0;
      const transFee = req.body.transFee ? parseFloat(req.body.transFee) : 0;
      const surcharge = req.body.surcharge ? parseFloat(req.body.surcharge) : 0;
      const profit = revenue - calculatedProdCost - transFee - surcharge;
      const balance = revenue - calculatedReceived;

      const newPendingBooking = await tx.pendingBooking.create({
        data: {
          createdById: userId,
          refNo: req.body.ref_no,
          paxName: req.body.pax_name,
          agentName: req.body.agent_name,
          teamName: req.body.team_name,
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
          revenue: revenue || null,
          prodCost: calculatedProdCost || null,
          transFee: transFee || null,
          surcharge: surcharge || null,
          // received: calculatedReceived, // <-- THIS LINE IS REMOVED
          balance: balance,
          profit: profit,
          invoiced: req.body.invoiced || null,
          description: req.body.description || null,
          status: 'PENDING',
          numPax: parseInt(req.body.numPax),
          initialPayments: {
            create: initialPayments.map(p => ({
              amount: parseFloat(p.amount),
              transactionMethod: p.transactionMethod,
              paymentDate: new Date(p.receivedDate),
            })),
          },
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
          instalments: { create: (req.body.instalments || []).map(inst => ({ dueDate: new Date(inst.dueDate), amount: parseFloat(inst.amount), status: inst.status || 'PENDING' })) },
          passengers: { create: (req.body.passengers || []).map(pax => ({ ...pax, birthday: pax.birthday ? new Date(pax.birthday) : null })) },
        },
        include: { costItems: { include: { suppliers: true } } }
      });

      for (const [itemIndex, item] of prodCostBreakdown.entries()) {
        for (const [supplierIndex, s] of item.suppliers.entries()) {
          if (s.paymentMethod.includes('CREDIT_NOTES')) {
            const createdCostItemSupplier = newPendingBooking.costItems[itemIndex].suppliers[supplierIndex];
            
            for (const usedNote of (s.selectedCreditNotes || [])) {
              const creditNoteToUpdate = await tx.supplierCreditNote.findUnique({ where: { id: usedNote.id } });
              const newRemainingAmount = creditNoteToUpdate.remainingAmount - usedNote.amountToUse;

              await tx.supplierCreditNote.update({
                where: { id: usedNote.id },
                data: {
                  remainingAmount: newRemainingAmount,
                  status: newRemainingAmount < 0.01 ? 'USED' : 'PARTIALLY_USED',
                },
              });

              await tx.creditNoteUsage.create({
                data: {
                  amountUsed: usedNote.amountToUse,
                  creditNoteId: usedNote.id,
                  usedOnCostItemSupplierId: createdCostItemSupplier.id,
                }
              });
            }
          }
        }
      }
      await createAuditLog(tx, {
        userId: userId,
        modelName: 'PendingBooking',
        recordId: newPendingBooking.id,
        action: ActionType.CREATE_PENDING,
      });

      return tx.pendingBooking.findUnique({
          where: { id: newPendingBooking.id },
          include: { 
            costItems: { include: { suppliers: true } }, 
            instalments: true, 
            passengers: true,
            initialPayments: true
          }
      });
    });

    return apiResponse.success(res, pendingBooking, 201);
  } catch (error) {
    console.error('Pending booking creation error:', error);
    if (error instanceof Error && (error.message.includes('Missing required fields') || error.message.includes('Invalid') || error.message.includes('must') || error.message.includes('Credit Note'))) {
      return apiResponse.error(res, error.message, 400);
    }
    if (error.code === 'P2002') return apiResponse.error(res, 'A booking with a similar unique identifier already exists.', 409);
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
  const bookingId = parseInt(req.params.id);
  if (isNaN(bookingId)) {
    return apiResponse.error(res, 'Invalid booking ID', 400);
  }

  const { id: approverId } = req.user;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Fetch the complete pending booking, including the new initialPayments
      const pendingBooking = await tx.pendingBooking.findUnique({
        where: { id: bookingId },
        include: {
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
          createdBy: true,
          initialPayments: true, // <-- Include the payments
        },
      });

      if (!pendingBooking) {
        throw new Error('Pending booking not found');
      }
      if (pendingBooking.status !== 'PENDING') {
        throw new Error('Pending booking already processed');
      }

      const allBookings = await tx.booking.findMany({
        select: { folderNo: true },
      });
      const maxFolderNo = Math.max(
        0,
        ...allBookings.map(b => parseInt(b.folderNo.split('.')[0], 10))
      );
      const newFolderNo = String(maxFolderNo + 1);

      // 2. Create the new Booking
      const newBooking = await tx.booking.create({
        data: {
          folderNo: newFolderNo,
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
          // received: ..., // <-- REMOVED
          balance: pendingBooking.balance ? parseFloat(pendingBooking.balance) : null,
          profit: pendingBooking.profit ? parseFloat(pendingBooking.profit) : null,
          invoiced: pendingBooking.invoiced || null,
          description: pendingBooking.description || null,
          numPax: pendingBooking.numPax,
          // Copy the initial payments from pending to the new booking
          initialPayments: {
            create: pendingBooking.initialPayments.map(p => ({
              amount: p.amount,
              transactionMethod: p.transactionMethod,
              paymentDate: p.paymentDate,
            })),
          },
          costItems: {
            create: pendingBooking.costItems.map((item) => ({
              category: item.category,
              amount: parseFloat(item.amount),
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
            costItems: true,
        }
      });

      // 3. Graduate suppliers (remains the same)
      for (const [index, pendingItem] of pendingBooking.costItems.entries()) {
        const newCostItemId = newBooking.costItems[index].id;
        for (const supplier of pendingItem.suppliers) {
          await tx.costItemSupplier.updateMany({ // Use updateMany because there is no unique id on costItemSupplier
            where: { id: supplier.id },
            data: {
              costItemId: newCostItemId,
              pendingCostItemId: null,
            },
          });
        }
      }

      await createAuditLog(tx, {
        userId: approverId,
        modelName: 'PendingBooking',
        recordId: pendingBooking.id,
        action: ActionType.APPROVE_PENDING,
        changes: [{
          fieldName: 'status',
          oldValue: 'PENDING',
          newValue: 'APPROVED'
        }]
      });
      
      await createAuditLog(tx, {
        userId: pendingBooking.createdById,
        modelName: 'Booking',
        recordId: newBooking.id,
        action: ActionType.CREATE
      });


      await tx.pendingBooking.update({
        where: { id: bookingId },
        data: { status: 'APPROVED' },
      });
      
      return tx.booking.findUnique({
          where: { id: newBooking.id },
          include: {
              costItems: { include: { suppliers: true } },
              instalments: true,
              passengers: true,
              initialPayments: true
          }
      });
    });

    return apiResponse.success(res, booking, 200);

  } catch (error) {
    console.error('Error approving booking:', error);
    if (error.message === 'Pending booking not found') {
        return apiResponse.error(res, 'Pending booking not found', 404);
    }
    if (error.message === 'Pending booking already processed') {
        return apiResponse.error(res, 'Pending booking already processed', 409);
    }
    if (error.code === 'P2002') {
      return apiResponse.error(res, 'A booking with this unique identifier (e.g., folder number) already exists.', 409);
    }
    return apiResponse.error(res, `Failed to approve booking: ${error.message}`, 500);
  }
};


const rejectBooking = async (req, res) => {
  // --- AUDIT LOG ---
  // Get the ID of the user performing the rejection.
  const { id: userId } = req.user;
  const { id } = req.params;

  try {
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const pendingBooking = await tx.pendingBooking.findUnique({
        where: { id: parseInt(id) },
      });

      if (!pendingBooking || pendingBooking.status !== 'PENDING') {
        throw new Error("Pending booking not found or already processed");
      }
      
      // --- AUDIT LOG ---
      // Log that the status is changing from PENDING to REJECTED.
      await createAuditLog(tx, {
        userId: userId,
        modelName: 'PendingBooking',
        recordId: pendingBooking.id,
        action: ActionType.REJECT_PENDING,
        changes: [{
          fieldName: 'status',
          oldValue: 'PENDING',
          newValue: 'REJECTED'
        }]
      });

      // Instead of deleting, we update the status.
      // This preserves the record for historical and audit purposes.
      const rejectedBooking = await tx.pendingBooking.update({
        where: { id: parseInt(id) },
        data: {
          status: 'REJECTED'
        },
      });

      return rejectedBooking;
    });

    return apiResponse.success(res, { message: "Booking rejected successfully", data: updatedBooking }, 200);

  } catch (error) {
    console.error("Error rejecting booking:", error);
    if (error.message.includes('not found or already processed')) {
      return apiResponse.error(res, error.message, 404);
    }
    return apiResponse.error(res, `Failed to reject booking: ${error.message}`, 500);
  }
};

const createBooking = async (req, res) => {
  const { id: userId } = req.user;

  try {
    // --- NEW: Get initialPayments array from the start ---
    const initialPayments = req.body.initialPayments || [];

    const requiredFields = [ 'ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'travelDate' ];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length > 0) {
      return apiResponse.error(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
    }
    // --- NEW: Validate the payments array ---
    if (initialPayments.length === 0) {
      return apiResponse.error(res, "At least one initial payment must be provided.", 400);
    }

    // ... (All other validation logic for passengers, costItems etc. remains the same) ...
    const prodCostBreakdown = req.body.prodCostBreakdown || [];

    const booking = await prisma.$transaction(async (tx) => {
      const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      
      // --- NEW: Calculate received amount from the payments array ---
      const calculatedReceived = initialPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      const revenue = req.body.revenue ? parseFloat(req.body.revenue) : 0;
      const transFee = req.body.transFee ? parseFloat(req.body.transFee) : 0;
      const surcharge = req.body.surcharge ? parseFloat(req.body.surcharge) : 0;

      const profit = revenue - calculatedProdCost - transFee - surcharge;
      const balance = revenue - calculatedReceived;

      const newBooking = await tx.booking.create({
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
          description: req.body.description || null,
          // --- Financial data updates ---
          revenue,
          prodCost: calculatedProdCost,
          transFee,
          surcharge,
          profit,
          balance,
          invoiced: req.body.invoiced || null,
          // --- REMOVE OLD FIELDS ---
          // received: ...,
          // transactionMethod: ...,
          // receivedDate: ...,

          // --- ADD NEW RELATION ---
          initialPayments: {
            create: initialPayments.map(p => ({
              amount: parseFloat(p.amount),
              transactionMethod: p.transactionMethod,
              paymentDate: new Date(p.receivedDate), // Assuming frontend sends receivedDate
            })),
          },

          costItems: {
            create: prodCostBreakdown.map(item => ({
              category: item.category, amount: parseFloat(item.amount),
              suppliers: { create: item.suppliers.map(s => ({ ...s, amount: parseFloat(s.amount) })) },
            })),
          },
          instalments: {
            create: (req.body.instalments || []).map(inst => ({
              ...inst, dueDate: new Date(inst.dueDate), amount: parseFloat(inst.amount),
            })),
          },
          passengers: {
            create: (req.body.passengers || []).map(pax => ({
              ...pax, birthday: pax.birthday ? new Date(pax.birthday) : null,
            })),
          },
        },
        include: {
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
          initialPayments: true,
        },
      });

      await createAuditLog(tx, {
        userId: userId,
        modelName: 'Booking',
        recordId: newBooking.id,
        action: ActionType.CREATE,
      });

      return newBooking;
    });

    return apiResponse.success(res, booking, 201);
  } catch (error) {
    console.error("Booking creation error:", error);
    if (error.code === 'P2002') {
      return apiResponse.error(res, "Booking with this reference number already exists", 409);
    }
    return apiResponse.error(res, "Failed to create booking: " + error.message, 500);
  }
};

const getBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      // The `where` clause is no longer needed since we aren't nesting bookings
      include: {
        costItems: { include: { suppliers: true } },
        passengers: true,
        instalments: { include: { payments: true } },
        cancellation: true,
        initialPayments: true,
      },
      orderBy: { pcDate: 'desc' },
    });
    return apiResponse.success(res, bookings);
  } catch (error) {
    console.error("Error fetching bookings:", error);
    return apiResponse.error(res, "Failed to get all bookings: " + error.message, 500);
  }
};

const updateBooking = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  const updates = req.body;

  try {
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
      travelDate,
      revenue,
      prodCost,
      transFee,
      surcharge,
      profit,
      invoiced,
      description,
      costItems,
      instalments,
      passengers,
      initialPayments, // The new array for payments
    } = updates;

    // --- Validation (can be kept as is) ---
    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT'];
    if (updates.transactionMethod && !validTransactionMethods.includes(updates.transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }
    // ... any other validation you have for passengers, cost items, etc. ...

    // --- Transaction to ensure data integrity ---
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const bookingToUpdate = await tx.booking.findUnique({
        where: { id: parseInt(id) },
        include: { initialPayments: true } // Include current payments for calculation
      });

      if (!bookingToUpdate) {
        throw new Error("Booking not found");
      }

      // --- Financial Recalculation ---
      const newRevenue = revenue !== undefined ? parseFloat(revenue) : bookingToUpdate.revenue;
      const newProdCost = prodCost !== undefined ? parseFloat(prodCost) : bookingToUpdate.prodCost;
      const newTransFee = transFee !== undefined ? parseFloat(transFee) : bookingToUpdate.transFee;
      const newSurcharge = surcharge !== undefined ? parseFloat(surcharge) : bookingToUpdate.surcharge;
      
      let calculatedReceived;
      if (Array.isArray(initialPayments)) {
        // If the frontend sends a new payments array, use it
        calculatedReceived = initialPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
      } else {
        // Otherwise, calculate from the existing payments in the DB
        calculatedReceived = bookingToUpdate.initialPayments.reduce((sum, p) => sum + p.amount, 0);
      }
      
      const newProfit = newRevenue - newProdCost - newTransFee - newSurcharge;
      const newBalance = newRevenue - calculatedReceived;

      // Log changes before updating
      const oldRecord = await tx.booking.findUnique({ where: { id: parseInt(id) } });
      
      const dataForUpdate = {
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
        invoiced,
        description,
        revenue: newRevenue,
        prodCost: newProdCost,
        transFee: newTransFee,
        surcharge: newSurcharge,
        profit: newProfit,
        balance: newBalance,
        
        initialPayments: Array.isArray(initialPayments)
          ? {
              deleteMany: {}, // Delete all old payments
              create: initialPayments.map(p => ({ // Recreate with new data
                amount: parseFloat(p.amount),
                transactionMethod: p.transactionMethod,
                paymentDate: new Date(p.receivedDate), // Assuming frontend sends receivedDate
              })),
            }
          : undefined,

        costItems: Array.isArray(costItems)
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
                    firstMethodAmount: s.firstMethodAmount ? parseFloat(s.firstMethodAmount) : null,
                    secondMethodAmount: s.secondMethodAmount ? parseFloat(s.secondMethodAmount) : null,
                  })),
                },
              })),
            }
          : undefined,

        instalments: Array.isArray(instalments)
          ? {
              deleteMany: {},
              create: instalments.map(inst => ({
                dueDate: new Date(inst.dueDate),
                amount: parseFloat(inst.amount),
                status: inst.status,
              })),
            }
          : undefined,

        passengers: Array.isArray(passengers)
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
      };

      const finalBooking = await tx.booking.update({
        where: { id: parseInt(id) },
        data: dataForUpdate,
        include: {
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
          initialPayments: true,
        },
      });

      // Pass the transaction 'tx' to the audit logger
      await compareAndLogChanges(tx, {
        modelName: 'Booking',
        recordId: finalBooking.id,
        userId,
        oldRecord,
        newRecord: finalBooking,
        updates, // Pass the original updates object to see what fields were intended to change
      });

      return finalBooking;
    });

    return apiResponse.success(res, updatedBooking, 200);

  } catch (error) {
    console.error('Error updating booking:', error);
    if (error.message === "Booking not found") {
      return apiResponse.error(res, error.message, 404);
    }
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
  const { id: userId } = req.user;
  const { id } = req.params; // This is the Instalment ID
  const { amount, status, transactionMethod, paymentDate } = req.body; // 'amount' here is the payment amount

  try {
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
        return apiResponse.error(res, 'Payment amount must be a positive number.', 400);
    }
    // For this flow, we assume a payment means the instalment status will become PAID.
    // If partial payments were allowed, this logic would be more complex.
    if (status !== 'PAID') {
        return apiResponse.error(res, 'Invalid status for payment action. Expected "PAID".', 400);
    }
    if (!transactionMethod || !paymentDate) {
        return apiResponse.error(res, 'Transaction method and payment date are required.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Fetch the instalment and its associated booking with all necessary details
      const instalmentToUpdate = await tx.instalment.findUnique({
        where: { id: parseInt(id) },
        include: { 
            booking: {
                // Select all fields needed for comprehensive balance calculation
                select: {
                    id: true,
                    revenue: true,
                    initialPayments: true,
                    // Note: We'll re-fetch all instalments and their payments separately for accuracy
                }
            },
            payments: true // Include existing payments for this specific instalment
        },
      });

      if (!instalmentToUpdate) {
        throw new Error('Instalment not found');
      }

      // Prevent re-processing if already paid (based on current flow's assumption)
      if (instalmentToUpdate.status === 'PAID') {
          throw new Error('This instalment has already been marked as PAID.');
      }

      // 2. Create the new instalment payment record
      const newPayment = await tx.instalmentPayment.create({
          data: {
              instalmentId: parseInt(id),
              amount: paymentAmount,
              transactionMethod,
              paymentDate: new Date(paymentDate),
          },
      });

      // 3. Update the instalment's status (DO NOT update instalment.amount with payment amount)
      const updatedInstalment = await tx.instalment.update({
        where: { id: parseInt(id) },
        data: { status: 'PAID' }, // Mark instalment as PAID after successful payment
        include: { payments: true } // Re-fetch payments to ensure we have the very latest for return
      });

      // --- Recalculate Booking's Total Received and Balance from scratch ---
      // This is the most reliable way to ensure consistency after a payment.

      // Get all initial payments for the booking
      const sumOfInitialPayments = instalmentToUpdate.booking.initialPayments.reduce((sum, p) => sum + p.amount, 0);

      // Get ALL instalments for the booking (with their latest payments)
      // This ensures we capture the payment just added and any other existing payments.
      const allBookingsInstalments = await tx.instalment.findMany({
          where: { bookingId: instalmentToUpdate.bookingId },
          include: { payments: true }
      });

      // Calculate total paid via all instalments for the booking
      const totalPaidViaInstalments = allBookingsInstalments.reduce((instSum, inst) => 
          instSum + inst.payments.reduce((paySum, p) => paySum + p.amount, 0), 0
      );
      
      const newTotalReceived = sumOfInitialPayments + totalPaidViaInstalments;
      const newBalance = (instalmentToUpdate.booking.revenue || 0) - newTotalReceived;
      
      // 4. Update the parent booking's balance and lastPaymentDate
      const oldBookingBalance = instalmentToUpdate.booking.balance; // Store old balance for audit log
      const updatedBooking = await tx.booking.update({
          where: { id: instalmentToUpdate.bookingId },
          data: {
              balance: newBalance,
              lastPaymentDate: new Date(paymentDate), // Update last payment date
          }
      });

      // 5. Create Audit Logs for both Instalment and Booking
      await createAuditLog(tx, {
        userId,
        modelName: 'Instalment',
        recordId: instalmentToUpdate.id,
        action: ActionType.UPDATE,
        changes: [{
          fieldName: 'status',
          oldValue: instalmentToUpdate.status,
          newValue: 'PAID'
        },
        {
          fieldName: 'payment_recorded', // Specific audit for the payment itself
          oldValue: `No payment recorded`,
          newValue: `£${paymentAmount.toFixed(2)} via ${transactionMethod}`
        }
        ]
      });

      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: instalmentToUpdate.bookingId,
        action: ActionType.SETTLEMENT_PAYMENT,
        changes: [{
          fieldName: 'balance',
          oldValue: oldBookingBalance !== undefined ? oldBookingBalance.toFixed(2) : 'N/A',
          newValue: newBalance.toFixed(2)
        }]
      });

      // 6. Return the updated instalment and booking details for frontend state update
      return {
          updatedInstalment: updatedInstalment, // Already includes the new payment due to include: { payments: true }
          bookingUpdate: {
              id: updatedBooking.id,
              balance: updatedBooking.balance,
              received: newTotalReceived.toFixed(2) // Frontend expects this for its state update
          }
      };
    }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds (default is 5s)
    }); // End of prisma.$transaction

    return apiResponse.success(res, result);
  } catch (error) {
    console.error('Error updating instalment:', error);
    if (error.message.includes('not found') || error.message.includes('already been marked as PAID')) {
      return apiResponse.error(res, error.message, 404);
    }
    // Catch generic transaction or other errors
    return apiResponse.error(res, `Failed to update instalment: ${error.message}`, 500);
  }
};


const getCustomerDeposits = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      where: {
        // This 'in' clause still filters only 'INTERNAL' and 'INTERNAL_HUMM'.
        // To show FULL/HUMM bookings in the table, you would need to adjust this.
        // For now, I'm working within the existing filter.
        paymentMethod: {
          in: ['INTERNAL', 'INTERNAL_HUMM', 'FULL', 'HUMM', 'FULL_HUMM'], // <-- MODIFIED THIS LINE
        },
      },
      select: {
        id: true,
        folderNo: true,
        refNo: true,
        paxName: true,
        agentName: true,
        pcDate: true,
        travelDate: true,
        revenue: true,
        bookingStatus: true,
        paymentMethod: true, // <-- ADDED THIS TO DETERMINE LOGIC
        initialDeposit: true, // <-- KEPT THIS AS IS, IT'S FROM THE DB MODEL
        initialPayments: {
          select: {
            amount: true,
            transactionMethod: true,
            paymentDate: true,
          }
        },
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
        cancellation: {
          select: {
            id: true,
            adminFee: true,
            supplierCancellationFee: true,
            refundToPassenger: true,
            profitOrLoss: true,
            refundPayment: {
              select: {
                amount: true,
                transactionMethod: true,
                refundDate: true
              }
            },
            refundStatus: true,
            createdCustomerPayable: {
              include: {
                settlements: true
              }
            }
          }
        }
      },
    });

    const formattedBookings = bookings.map((booking) => {
      const revenue = parseFloat(booking.revenue || 0);

      // --- Base Calculations: Sums of actual money received from customer ---
      const sumOfInitialPayments = (booking.initialPayments || [])
        .reduce((sum, p) => sum + parseFloat(p.amount), 0);

      const sumOfPaidInstalments = (booking.instalments || [])
        .reduce((sum, inst) => {
          const paymentTotal = (inst.payments || []).reduce((pSum, p) => pSum + parseFloat(p.amount), 0);
          return sum + paymentTotal;
        }, 0);
      
      let totalReceived = sumOfInitialPayments + sumOfPaidInstalments; // Total cash-in from customer
      let currentBalance = revenue - totalReceived; // Initial balance calculation (money owed to us)

      // --- Payment History for Pop-up (remains mostly the same) ---
      const paymentHistory = [];
      (booking.initialPayments || []).forEach(payment => {
        paymentHistory.push({
          type: 'Initial Payment',
          date: payment.paymentDate,
          amount: parseFloat(payment.amount),
          method: payment.transactionMethod,
        });
      });
      (booking.instalments || []).forEach(instalment => {
        (instalment.payments || []).forEach(payment => {
          paymentHistory.push({
            type: `Instalment Payment`,
            date: payment.paymentDate,
            amount: parseFloat(payment.amount),
            method: payment.transactionMethod,
          });
        });
      });
      
      // --- CANCELLATION SPECIFIC LOGIC ---
      if (booking.bookingStatus === 'CANCELLED' && booking.cancellation) {
        const cancellation = booking.cancellation;
        const refundToPassenger = parseFloat(cancellation.refundToPassenger || 0);
        const customerPayable = cancellation.createdCustomerPayable;

        // If a refund has been paid, deduct it from totalReceived for a 'net received' view
        if (cancellation.refundPayment) {
          totalReceived -= parseFloat(cancellation.refundPayment.amount);
          paymentHistory.push({
            type: 'Passenger Refund Paid',
            date: cancellation.refundPayment.refundDate,
            amount: -parseFloat(cancellation.refundPayment.amount), // Negative to indicate money out
            method: cancellation.refundPayment.transactionMethod,
          });
        }

        // Adjust balance based on cancellation financial outcome
        if (customerPayable && customerPayable.pendingAmount > 0) {
            // Customer still owes us money from cancellation
            currentBalance = parseFloat(customerPayable.pendingAmount);
        } else if (customerPayable && customerPayable.pendingAmount <= 0.01) {
            // Customer debt fully settled. If a refund was due, it's now net zero or paid.
            currentBalance = 0;
        } else if (refundToPassenger > 0 && cancellation.refundStatus === 'PENDING') {
            // We owe the customer a refund
            currentBalance = -refundToPassenger; // Negative balance indicates money owed TO customer
        } else if (refundToPassenger > 0 && cancellation.refundStatus === 'PAID') {
            // Refund was due and has been paid. Net balance should be 0 from customer's perspective.
            currentBalance = 0;
        } else {
            // No refund due, no payable pending. Assume settled.
            currentBalance = 0;
        }

        // Add customer payable settlements to history if applicable
        if (customerPayable) {
          const settlements = customerPayable.settlements || [];
          settlements.forEach(settlement => {
            paymentHistory.push({
              type: 'Cancellation Debt Paid',
              date: settlement.paymentDate,
              amount: parseFloat(settlement.amount),
              method: settlement.transactionMethod
            });
          });
        }
      }
      
      paymentHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      return {
        ...booking,
        revenue: revenue.toFixed(2),
        received: totalReceived.toFixed(2), 
        balance: currentBalance.toFixed(2), 
        initialDeposit: sumOfInitialPayments.toFixed(2), 
        paymentHistory: paymentHistory,
      };
    });

    return apiResponse.success(res, formattedBookings);
  } catch (error) {
    console.error('Error fetching customer deposits:', error);
    return apiResponse.error(res, `Failed to fetch customer deposits: ${error.message}`, 500);
  }
};


const createSupplierPaymentSettlement = async (req, res) => {

  const { id: userId } = req.user;
  const { costItemSupplierId, amount, transactionMethod, settlementDate } = req.body;

  try {

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

    const { newSettlement, updatedCostItemSupplier } = await prisma.$transaction(async (tx) => {
      // Fetch the CostItemSupplier and its related booking for logging
      const costItemSupplier = await tx.costItemSupplier.findUnique({
        where: { id: parseInt(costItemSupplierId) },
        include: {
          costItem: { // Include the parent costItem
            include: {
              booking: true // Include the parent booking
            }
          }
        }
      });

      if (!costItemSupplier) {
        throw new Error('CostItemSupplier not found');
      }
      // This ensures we can log against the correct main booking
      if (!costItemSupplier.costItem?.booking?.id) {
        throw new Error('Could not find the parent booking for this cost item.');
      }

      const pendingAmount = parseFloat(costItemSupplier.pendingAmount) || 0;
      if (parseFloat(amount) > pendingAmount) {
        throw new Error(`Settlement amount (£${amount}) exceeds pending amount (£${pendingAmount.toFixed(2)})`);
      }

      // --- AUDIT LOG ---
      // Log this outgoing payment on the main Booking record's history.
      await createAuditLog(tx, {
          userId,
          modelName: 'Booking',
          recordId: costItemSupplier.costItem.booking.id,
          action: ActionType.SETTLEMENT_PAYMENT, // Re-using the same action type is fine
          changes: [{
            fieldName: 'supplierPaid', // A descriptive, non-schema field name is ok here
            oldValue: `Paid: ${costItemSupplier.paidAmount.toFixed(2)}`,
            newValue: `Paid an additional ${parseFloat(amount).toFixed(2)} to ${costItemSupplier.supplier}`
          }]
      });

      // --- ORIGINAL LOGIC ---
      // Create the settlement record
      const createdSettlement = await tx.supplierPaymentSettlement.create({
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

      const finalUpdatedSupplier = await tx.costItemSupplier.update({
        where: { id: parseInt(costItemSupplierId) },
        data: {
          paidAmount: newPaidAmount,
          pendingAmount: newPendingAmount,
        },
        include: {
          settlements: true,
        },
      });

      return { newSettlement: createdSettlement, updatedCostItemSupplier: finalUpdatedSupplier };
    });

    return apiResponse.success(res, { newSettlement, updatedCostItemSupplier }, 201);
  } catch (error) {
    console.error('Error creating supplier payment settlement:', error);
    if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
    if (error.message.includes('exceeds pending amount')) return apiResponse.error(res, error.message, 400);
    if (error.name === 'PrismaClientValidationError') return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
    return apiResponse.error(res, `Failed to create supplier payment settlement: ${error.message}`, 500);
  }
};

// In controllers/bookingController.js

// In server/controllers/bookingController.js

const getSuppliersInfo = async (req, res) => {
    try {
        const supplierSummary = {};

        const ensureSupplier = (supplierName) => {
            if (!supplierSummary[supplierName]) {
                supplierSummary[supplierName] = {
                    totalAmount: 0,
                    totalPaid: 0,
                    totalPending: 0,
                    transactions: [],
                    payables: [],
                };
            }
        };

        const bookingsWithCostItems = await prisma.booking.findMany({
            select: {
                id: true,
                refNo: true,
                bookingStatus: true,
                folderNo: true,
                costItems: {
                    select: {
                        category: true,
                        suppliers: {
                            select: {
                                id: true,
                                supplier: true,
                                amount: true,
                                paidAmount: true,
                                pendingAmount: true,
                                createdAt: true,
                            },
                        },
                    },
                },
            },
        });

        bookingsWithCostItems.forEach((booking) => {
            booking.costItems.forEach((item) => {
                item.suppliers.forEach((s) => {
                    ensureSupplier(s.supplier);
                    supplierSummary[s.supplier].transactions.push({
                        type: "Booking",
                        data: {
                            ...s,
                            folderNo: booking.folderNo,
                            refNo: booking.refNo,
                            category: item.category,
                            bookingStatus: booking.bookingStatus,
                            pendingAmount: booking.bookingStatus === "CANCELLED" ? 0 : s.pendingAmount,
                        },
                    });
                });
            });
        });

        const allCreditNotes = await prisma.supplierCreditNote.findMany({
            include: {
                generatedFromCancellation: {
                    include: {
                        originalBooking: {
                            select: {
                                refNo: true
                            }
                        }
                    },
                },
                usageHistory: {
                    include: {
                        usedOnCostItemSupplier: {
                            include: {
                                costItem: {
                                    include: {
                                        booking: {
                                            select: {
                                                refNo: true
                                            }
                                        }
                                    }
                                },
                            },
                        },
                    },
                },
            },
        });

        allCreditNotes.forEach((note) => {
            if (note.supplier) {
                ensureSupplier(note.supplier);
                const modifiedUsageHistory = note.usageHistory.map(usage => ({
                    ...usage,
                    usedOnRefNo: usage.usedOnCostItemSupplier?.costItem?.booking?.refNo || "N/A",
                }));

                supplierSummary[note.supplier].transactions.push({
                    type: "CreditNote",
                    data: {
                        ...note,
                        usageHistory: modifiedUsageHistory,
                        generatedFromRefNo: note.generatedFromCancellation?.originalBooking?.refNo || "N/A",
                    },
                });
            }
        });

        const allPayables = await prisma.supplierPayable.findMany({
            where: { status: "PENDING" },
            include: {
                createdFromCancellation: {
                    select: {
                        originalBooking: {
                            select: { folderNo: true },
                        },
                    },
                },
            },
        });

        allPayables.forEach((payable) => {
            if (payable.supplier) {
                ensureSupplier(payable.supplier);
                supplierSummary[payable.supplier].payables.push({
                    ...payable,
                    originatingFolderNo: payable.createdFromCancellation?.originalBooking?.folderNo || "N/A",
                });
            }
        });

        for (const supplierName in supplierSummary) {
            const supplier = supplierSummary[supplierName];
            const bookingTotals = supplier.transactions
                .filter((t) => t.type === "Booking")
                .reduce(
                    (acc, tx) => {
                        acc.totalAmount += tx.data.amount || 0;
                        acc.totalPaid += tx.data.paidAmount || 0;
                        acc.totalPending += tx.data.pendingAmount || 0;
                        return acc;
                    }, {
                        totalAmount: 0,
                        totalPaid: 0,
                        totalPending: 0
                    }
                );

            const payablesPending = supplier.payables.reduce(
                (sum, p) => sum + p.pendingAmount,
                0
            );

            supplier.totalAmount = bookingTotals.totalAmount;
            supplier.totalPaid = bookingTotals.totalPaid;
            supplier.totalPending = bookingTotals.totalPending + payablesPending;

            supplier.transactions.sort(
                (a, b) => new Date(b.data.createdAt) - new Date(a.data.createdAt)
            );
        }

        return apiResponse.success(res, supplierSummary);
    } catch (error) {
        console.error("Error fetching suppliers info:", error);
        return apiResponse.error(
            res,
            `Failed to fetch suppliers info: ${error.message}`,
            500
        );
    }
};

const updatePendingBooking = async (req, res) => {
  const { id: userId } = req.user;
  const { id } = req.params;
  const updates = req.body;
  try {
    
    const { teamName, bookingType, paymentMethod, transactionMethod, numPax, costItems, instalments, passengers, balance, revenue, received, prodCost } = updates;

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

    const updatedPendingBooking = await prisma.$transaction(async (tx) => {
      // 1. Get the record's state BEFORE the update
      const oldBooking = await tx.pendingBooking.findUnique({
        where: { id: parseInt(id) }
      });

      if (!oldBooking) {
        throw new Error('Pending booking not found');
      }

    const financialData = {
        revenue: revenue ? parseFloat(revenue) : undefined,
        prodCost: prodCost ? parseFloat(prodCost) : undefined,
        transFee: updates.transFee ? parseFloat(updates.transFee) : undefined,
        surcharge: updates.surcharge ? parseFloat(updates.surcharge) : undefined,
        received: received ? parseFloat(received) : undefined,
        balance: balance ? parseFloat(balance) : undefined,
        profit: updates.profit ? parseFloat(updates.profit) : undefined,
        invoiced: updates.invoiced || undefined,
      };

    if (Object.values(financialData).some(val => val !== undefined)) {
        const revenueVal = financialData.revenue ?? oldBooking.revenue ?? 0;
        const prodCostVal = financialData.prodCost ?? oldBooking.prodCost ?? 0;
        const transFeeVal = financialData.transFee ?? oldBooking.transFee ?? 0;
        const surchargeVal = financialData.surcharge ?? oldBooking.surcharge ?? 0;
        const receivedVal = financialData.received ?? oldBooking.received ?? 0;
        financialData.profit = revenueVal - prodCostVal - transFeeVal - surchargeVal;
        financialData.balance = revenueVal - receivedVal;
      }

    const newBooking = await tx.pendingBooking.update({
        where: { id: parseInt(id) },
        data: {
          // All the data fields from your original update block
          refNo: updates.refNo,
          paxName: updates.paxName,
          agentName: updates.agentName,
          teamName: updates.teamName,
          pnr: updates.pnr,
          airline: updates.airline,
          fromTo: updates.fromTo,
          bookingType: updates.bookingType,
          pcDate: updates.pcDate ? new Date(updates.pcDate) : undefined,
          issuedDate: updates.issuedDate ? new Date(updates.issuedDate) : undefined,
          paymentMethod: updates.paymentMethod,
          lastPaymentDate: updates.lastPaymentDate ? new Date(updates.lastPaymentDate) : undefined,
          travelDate: updates.travelDate ? new Date(updates.travelDate) : undefined,
          transactionMethod: updates.transactionMethod || undefined,
          receivedDate: updates.receivedDate ? new Date(updates.receivedDate) : undefined,
          description: updates.description || undefined,
          numPax: numPax !== undefined ? parseInt(numPax) : undefined,
          ...financialData,
          costItems: Array.isArray(costItems) && costItems.length > 0 ? {
            deleteMany: {},
            create: costItems.map(item => ({
              category: item.category, amount: parseFloat(item.amount),
              suppliers: { create: item.suppliers.map(s => ({...s})) },
            })),
          } : undefined,
          instalments: Array.isArray(instalments) && instalments.length > 0 ? {
            deleteMany: {},
            create: instalments.map(inst => ({...inst, dueDate: new Date(inst.dueDate)})),
          } : undefined,
          passengers: Array.isArray(passengers) && passengers.length > 0 ? {
            deleteMany: {},
            create: passengers.map(pax => ({...pax, birthday: pax.birthday ? new Date(pax.birthday) : null})),
          } : undefined,
        },
        include: {
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
        },
      });

      // 3. Compare and log the changes
      await compareAndLogChanges(tx, {
        userId,
        modelName: 'PendingBooking',
        recordId: newBooking.id,
        oldRecord: oldBooking,
        newRecord: newBooking,
        updates: { ...updates, ...financialData } // Pass all potential changes
      });
      
      return newBooking;
    });

    return apiResponse.success(res, updatedPendingBooking, 200);

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
  // --- AUDIT LOG ---
  const { id: userId } = req.user;
  const { bookingId } = req.params;
  const { amount, transactionMethod, paymentDate } = req.body;

  try {
    // --- 1. Validation (remains the same) ---
    if (!bookingId || isNaN(parseInt(bookingId))) {
      return apiResponse.error(res, 'Invalid Booking ID', 400);
    }
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return apiResponse.error(res, 'Payment amount must be a positive number', 400);
    }

    // --- AUDIT LOG ---
    // Wrap all database operations in a transaction
    const result = await prisma.$transaction(async (tx) => {
      const booking = await tx.booking.findUnique({
        where: { id: parseInt(bookingId) },
        include: { 
          instalments: true,
          initialPayments: true
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }
      if (paymentAmount > booking.balance + 0.01) { // Add tolerance for float issues
          throw new Error(`Payment (£${paymentAmount.toFixed(2)}) exceeds balance (£${booking.balance.toFixed(2)})`);
      }

      // --- 2. Find or Create the Special "SETTLEMENT" Instalment ---
      let settlementInstalment = booking.instalments.find(inst => inst.status === 'SETTLEMENT');

      if (!settlementInstalment) {
        settlementInstalment = await tx.instalment.create({
          data: {
            bookingId: booking.id,
            dueDate: new Date(),
            amount: booking.balance,
            status: 'SETTLEMENT',
          },
        });
      }

      // --- 3. Record the Actual Payment ---
      await tx.instalmentPayment.create({
        data: {
          instalmentId: settlementInstalment.id,
          amount: paymentAmount,
          transactionMethod,
          paymentDate: new Date(paymentDate),
        },
      });
      
      


      // --- 4. Recalculate Totals for the Booking ---
      const allInstalments = await tx.instalment.findMany({
          where: { bookingId: booking.id },
          include: { payments: true }
      });

      const sumOfInitialPayments = booking.initialPayments.reduce((sum, p) => sum + p.amount, 0);

      // Recalculating totals...
      const sumOfPaidScheduledInstalments = allInstalments
        .filter((inst) => inst.status === 'PAID')
        .reduce((sum, inst) => sum + inst.payments.reduce((pSum, p) => pSum + p.amount, 0), 0);

      const initialDeposit = (booking.initialDeposit || 0);

      const settlementPaymentsTotal = allInstalments
        .find(inst => inst.status === 'SETTLEMENT')?.payments
        .reduce((sum, p) => sum + p.amount, 0) || 0;
        
      const newTotalReceived = initialDeposit + sumOfPaidScheduledInstalments + settlementPaymentsTotal;
      const newBalance = parseFloat(booking.revenue) - newTotalReceived;

      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: booking.id,
        action: ActionType.SETTLEMENT_PAYMENT,
        changes: [{
          fieldName: 'balance', 
          oldValue: booking.balance,
          newValue: newBalance
        }]
    });

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          // received: newTotalReceived, // <-- REMOVE THIS LINE
          balance: newBalance,
          lastPaymentDate: new Date(paymentDate),
        },
      });

      // --- 5. Return a useful payload ---
      return {
          bookingUpdate: {
              id: updatedBooking.id,
              balance: updatedBooking.balance
          }
      };
    });

    return apiResponse.success(res, result);

  } catch (error) {
    console.error('Error recording settlement payment:', error);
    if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
    if (error.message.includes('exceeds balance')) return apiResponse.error(res, error.message, 400);
    return apiResponse.error(res, `Failed to record settlement: ${error.message}`, 500);
  }
};



const getTransactions = async (req, res) => {
  try {
    // --- 1. FETCH ALL FINANCIAL EVENTS ---

    // === MONEY IN ===

    // A) ALL Initial Payments from customers, for ALL booking types.
    // This single query replaces the old 'nonInstalmentPayments' and 'internalBookings' fetches.
    const allInitialPayments = await prisma.initialPayment.findMany({
      where: {
        bookingId: { not: null } // Ensure it's from an approved booking
      },
      include: {
        booking: {
          select: { refNo: true, paxName: true }
        }
      }
    });

    // B) All Instalment Payments (this query remains the same and is correct)
    const instalmentPayments = await prisma.instalmentPayment.findMany({
      include: {
        instalment: {
          select: {
            booking: { select: { refNo: true, paxName: true } }
          }
        }
      },
    });

    // C) Credit Notes Received from a supplier (remains the same)
    const creditNotesReceived = await prisma.supplierCreditNote.findMany({
      select: { id: true, supplier: true, initialAmount: true, createdAt: true, generatedFromCancellation: { include: { originalBooking: { select: { refNo: true } } } } },
    });

    // D) Admin Fees from cancellations (remains the same)
    const adminFees = await prisma.cancellation.findMany({
      where: { adminFee: { gt: 0 } },
      include: { originalBooking: { select: { refNo: true } } }
    });


    // === MONEY OUT ===

    // E) Initial Supplier Payments (remains the same and is correct)
    const initialSupplierPayments = await prisma.costItemSupplier.findMany({
      where: {
        paymentMethod: 'BANK_TRANSFER',
        costItemId: { not: null }
      },
      include: {
        costItem: { include: { booking: { select: { refNo: true } } } },
      }
    });

    // F) Supplier Settlements (remains the same and is correct)
    const supplierSettlements = await prisma.supplierPaymentSettlement.findMany({
      where: {
        costItemSupplier: { costItemId: { not: null } }
      },
      include: { costItemSupplier: { select: { supplier: true, costItem: { select: { booking: { select: { refNo: true } } } } } } },
    });

    // G) Passenger Refunds (remains the same and is correct)
    const passengerRefunds = await prisma.passengerRefundPayment.findMany({
        include: {
            cancellation: {
                include: {
                    originalBooking: { select: { refNo: true, paxName: true } }
                }
            }
        }
    });


    // --- 2. MAP ALL EVENTS TO A STANDARDIZED FORMAT ---

    const transactionsList = [];

    // Map A) ALL Initial Payments
    allInitialPayments.forEach(payment => {
      transactionsList.push({
        id: `initialpay-${payment.id}`,
        type: 'Incoming',
        category: 'Initial Payment',
        date: payment.paymentDate,
        amount: payment.amount,
        bookingRefNo: payment.booking?.refNo || 'N/A',
        method: payment.transactionMethod,
        details: `From: ${payment.booking?.paxName || 'N/A'}`
      });
    });

    // Map B) All Instalment Payments
    instalmentPayments.forEach(payment => {
      transactionsList.push({
        id: `inst-${payment.id}`,
        type: 'Incoming',
        category: 'Instalment',
        date: payment.paymentDate,
        amount: payment.amount,
        bookingRefNo: payment.instalment.booking.refNo,
        method: payment.transactionMethod,
        details: `From: ${payment.instalment.booking.paxName}`
      });
    });

    // Map C) Credit Notes Received
    creditNotesReceived.forEach(note => {
      transactionsList.push({
        id: `cn-recv-${note.id}`,
        type: 'Incoming',
        category: 'Credit Note Received',
        date: note.createdAt,
        amount: note.initialAmount,
        bookingRefNo: note.generatedFromCancellation?.originalBooking?.refNo || 'N/A',
        method: 'Internal Credit',
        details: `From Supplier: ${note.supplier}`
      });
    });
    
    // Map D) Admin Fees
    adminFees.forEach(cancellation => {
      transactionsList.push({
        id: `adminfee-${cancellation.id}`,
        type: 'Incoming',
        category: 'Admin Fee',
        date: cancellation.createdAt,
        amount: cancellation.adminFee,
        bookingRefNo: cancellation.originalBooking.refNo,
        method: 'Internal',
        details: `Cancellation Admin Fee`
      });
    });

    // Map E) Initial Supplier Payments
    initialSupplierPayments.forEach(payment => {
      transactionsList.push({
        id: `supp-initial-${payment.id}`,
        type: 'Outgoing',
        category: 'Initial Supplier Pmt',
        date: payment.createdAt,
        amount: payment.amount,
        bookingRefNo: payment.costItem?.booking?.refNo || 'N/A',
        method: payment.transactionMethod,
        details: `To: ${payment.supplier}`
      });
    });
    
    // Map F) Supplier Settlements
    supplierSettlements.forEach(settlement => {
      transactionsList.push({
        id: `supp-settle-${settlement.id}`,
        type: 'Outgoing',
        category: 'Supplier Settlement',
        date: settlement.settlementDate,
        amount: settlement.amount,
        bookingRefNo: settlement.costItemSupplier?.costItem?.booking?.refNo || 'N/A',
        method: settlement.transactionMethod,
        details: `To: ${settlement.costItemSupplier?.supplier || 'Unknown'}`
      });
    });

    // Map G) Passenger Refunds
    passengerRefunds.forEach(refund => {
        const cancellation = refund.cancellation;
        transactionsList.push({
            id: `refund-${refund.id}`,
            type: 'Outgoing',
            category: 'Passenger Refund',
            date: refund.refundDate,
            amount: refund.amount,
            bookingRefNo: cancellation.originalBooking.refNo,
            method: refund.transactionMethod,
            details: `To: ${cancellation.originalBooking.paxName}`
        });
    });


    // --- 3. COMBINE, SORT, AND CALCULATE TOTALS ---
    const allTransactions = transactionsList.filter(t => t && t.id);
    allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

    const totalIncoming = allTransactions.filter(t => t.type === 'Incoming').reduce((sum, t) => sum + (t.amount || 0), 0);
    const totalOutgoing = allTransactions.filter(t => t.type === 'Outgoing').reduce((sum, t) => sum + (t.amount || 0), 0);
    const netBalance = totalIncoming - totalOutgoing;

    const payload = {
      transactions: allTransactions,
      totals: { incoming: totalIncoming, outgoing: totalOutgoing, netBalance: netBalance },
    };
     
    return apiResponse.success(res, payload);

  } catch (error) {
    console.error('Error fetching transactions:', error);
    return apiResponse.error(res, `Failed to fetch transactions: ${error.message}`, 500);
  }
};


const createCancellation = async (req, res) => {
  const { id: userId } = req.user;
  const { id: triggerBookingId } = req.params;
  const { supplierCancellationFee, adminFee } = req.body;

  if (supplierCancellationFee === undefined || adminFee === undefined ) {
    return apiResponse.error(res, 'Supplier Fee, Admin Fee, and Refund Method are required.', 400);
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const triggerBooking = await tx.booking.findUnique({ where: { id: parseInt(triggerBookingId) } });
      if (!triggerBooking) throw new Error('Booking not found.');

      const baseFolderNo = triggerBooking.folderNo.toString().split('.')[0];

      const chainBookings = await tx.booking.findMany({
        where: { OR: [{ folderNo: baseFolderNo }, { folderNo: { startsWith: `${baseFolderNo}.` } }] },
        include: {
          initialPayments: true,
          instalments: { include: { payments: true } }
        },
      });

      if (chainBookings.some(b => b.bookingStatus === 'CANCELLED')) {
        throw new Error('This booking chain has already been cancelled.');
      }
      const rootBookingInChain = chainBookings.find(b => b.folderNo === baseFolderNo);
      if (!rootBookingInChain) throw new Error('Could not find root booking.');

      // --- NEW CORRECTED CALCULATION ---
      // This correctly sums the product cost of all non-cancelled bookings in the chain.
      // This represents the total amount the supplier was entitled to before cancellation.
      const totalOwedToSupplierBeforeCancellation = chainBookings.reduce((sum, booking) => {
        if (booking.bookingStatus !== 'CANCELLED') {
          return sum + (booking.prodCost || 0);
        }
        return sum;
      }, 0);

      const totalChainReceivedFromCustomer = chainBookings.reduce((sum, booking) => {
        const initialSum = (booking.initialPayments || []).reduce((acc, p) => acc + p.amount, 0);
        const instalmentSum = (booking.instalments || []).reduce((acc, inst) => {
          const paymentsSum = (inst.payments || []).reduce((pAcc, p) => pAcc + p.amount, 0);
          return acc + paymentsSum;
        }, 0);
        return sum + initialSum + instalmentSum;
      }, 0);

      const supCancellationFee = parseFloat(supplierCancellationFee);
      const customerTotalCancellationFee = supCancellationFee + parseFloat(adminFee);
      
      // The supplier difference is what they were owed minus their cancellation fee.
      const supplierDifference = totalOwedToSupplierBeforeCancellation - supCancellationFee;
      
      const customerDifference = totalChainReceivedFromCustomer - customerTotalCancellationFee;
      
      const refundToPassenger = customerDifference > 0 ? customerDifference : 0;
      const payableByCustomer = customerDifference < 0 ? Math.abs(customerDifference) : 0;
      
      // The credit note is the positive difference from the supplier's side.
      const creditNoteAmount = supplierDifference > 0 ? supplierDifference : 0;

      // The profit or loss calculation is now based on these correct figures.
      const profitOrLoss = (totalChainReceivedFromCustomer - totalOwedToSupplierBeforeCancellation) - refundToPassenger + payableByCustomer;

      const newCancellationRecord = await tx.cancellation.create({
        data: {
          originalBookingId: rootBookingInChain.id,
          folderNo: `${baseFolderNo}.C`,
          originalRevenue: rootBookingInChain.revenue || 0,
          originalProdCost: rootBookingInChain.prodCost || 0,
          supplierCancellationFee: supCancellationFee,
          refundToPassenger: refundToPassenger,
          adminFee: parseFloat(adminFee),
          creditNoteAmount: creditNoteAmount,
          refundStatus: refundToPassenger > 0 ? 'PENDING' : 'N/A',
          profitOrLoss: profitOrLoss,
          description: `Cancellation for chain ${baseFolderNo}.`,
        },
      });
      
      if (supplierDifference > 0) {
        const supplierForCreditNote = await tx.costItemSupplier.findFirst({
            where: { costItem: { bookingId: rootBookingInChain.id } },
            select: { supplier: true }
        });

        if (supplierForCreditNote) {
            await tx.supplierCreditNote.create({
                data: {
                    supplier: supplierForCreditNote.supplier,
                    initialAmount: creditNoteAmount,
                    remainingAmount: creditNoteAmount,
                    status: 'AVAILABLE',
                    generatedFromCancellationId: newCancellationRecord.id,
                }
            });
        }
      } else if (supplierDifference < 0) {
        const supplierInfo = await tx.costItemSupplier.findFirst({
            where: { costItem: { bookingId: rootBookingInChain.id } },
            select: { supplier: true }
        });

        if (supplierInfo) {
            const amountOwedToSupplier = Math.abs(supplierDifference);

            await tx.supplierPayable.create({
                data: {
                    supplier: supplierInfo.supplier,
                    totalAmount: amountOwedToSupplier,
                    pendingAmount: amountOwedToSupplier, // The full amount is pending initially
                    reason: `Cancellation fee shortfall for booking chain ${baseFolderNo}`,
                    status: 'PENDING',
                    // Link this payable directly to the cancellation that created it
                    createdFromCancellationId: newCancellationRecord.id,
                }
            });
        }
      }
      
      if (payableByCustomer > 0) {
        await tx.customerPayable.create({
          data: {
            totalAmount: payableByCustomer,
            pendingAmount: payableByCustomer, 
            reason: `Cancellation shortfall for booking chain ${baseFolderNo}`,
            status: 'PENDING',
            createdFromCancellationId: newCancellationRecord.id, 
            bookingId: rootBookingInChain.id,
          },
        });
      }

      await tx.booking.updateMany({ where: { id: { in: chainBookings.map(b => b.id) } }, data: { bookingStatus: 'CANCELLED' } });

      await createAuditLog(tx, {
        userId,
        modelName: 'Cancellation',
        recordId: newCancellationRecord.id,
        action: "CREATE_CANCELLATION",
      });

      return newCancellationRecord;
    });

    return apiResponse.success(res, result, 201);
  } catch (error) {
    console.error("Error creating cancellation:", error);
    if (error.message.includes('already been cancelled') || error.message.includes('Booking not found')) {
      return apiResponse.error(res, error.message, 404);
    }
    return apiResponse.error(res, `Failed to create cancellation: ${error.message}`, 500);
  }
};


const getAvailableCreditNotes = async (req, res) => {
  try {
    const { supplier } = req.params;

    if (!supplier) {
      return apiResponse.error(res, 'Supplier name is required', 400);
    }
    
    const availableNotes = await prisma.supplierCreditNote.findMany({
      where: {
        supplier: supplier,
        status: { in: ['AVAILABLE', 'PARTIALLY_USED'] },
        remainingAmount: { gt: 0 }
      },
      // This include block is correct based on your schema
      include: {
        generatedFromCancellation: { // This matches your schema
          include: {
            originalBooking: {       // This assumes the relation on the Cancellation model is named 'originalBooking'
              select: {
                refNo: true          // This assumes the field on the Booking model is 'refNo'
              }
            }
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return apiResponse.success(res, availableNotes);

  } catch (error) {
    console.error('Error fetching available credit notes:', error);
    return apiResponse.error(res, `Failed to fetch credit notes: ${error.message}`, 500);
  }
};

// In controllers/bookingController.js

// In server/controllers/bookingController.js

const createDateChangeBooking = async (req, res) => {
  const { id: userId } = req.user;
  const originalBookingId = parseInt(req.params.id);
  const data = req.body;

  try {
    const newBooking = await prisma.$transaction(async (tx) => {
      if (!data.travelDate || !data.revenue) {
        throw new Error('Travel Date and Revenue are required for a date change.');
      }
      const originalBooking = await tx.booking.findUnique({ where: { id: originalBookingId } });
      if (!originalBooking) throw new Error('Original booking not found.');

      const baseFolderNo = originalBooking.folderNo.toString().split('.')[0];
      const isChainCancelled = await tx.booking.findFirst({
        where: {
          OR: [{ folderNo: baseFolderNo }, { folderNo: { startsWith: `${baseFolderNo}.` } }],
          bookingStatus: 'CANCELLED',
        },
      });

      if (isChainCancelled) {
        throw new Error('This booking chain has been cancelled and cannot be modified further.');
      }

      const relatedBookings = await tx.booking.findMany({ where: { folderNo: { startsWith: `${baseFolderNo}.` } } });
      const newIndex = relatedBookings.length;
      const newFolderNo = `${baseFolderNo}.${newIndex + 1}`;
      
      let bookingToUpdateId = originalBooking.id;
      let oldBookingStatus = originalBooking.bookingStatus;

      if (relatedBookings.length > 0) {
        const lastRelatedBooking = relatedBookings.sort((a, b) => {
            const subA = a.folderNo.includes('.') ? parseInt(a.folderNo.split('.')[1]) : 0;
            const subB = b.folderNo.includes('.') ? parseInt(b.folderNo.split('.')[1]) : 0;
            return subA - subB;
        }).pop();
        bookingToUpdateId = lastRelatedBooking.id;
        oldBookingStatus = lastRelatedBooking.bookingStatus;
      }
      
      await tx.booking.update({ where: { id: bookingToUpdateId }, data: { bookingStatus: 'COMPLETED' } });
      
      await createAuditLog(tx, {
          userId,
          modelName: 'Booking',
          recordId: bookingToUpdateId,
          action: ActionType.DATE_CHANGE,
          changes: [{
            fieldName: 'bookingStatus',
            oldValue: oldBookingStatus,
            newValue: 'COMPLETED'
          }]
      });

      const newBookingRecord = await tx.booking.create({
        data: {
          originalBooking: { connect: { id: originalBooking.id } },
          folderNo: newFolderNo,
          bookingStatus: 'CONFIRMED',
          bookingType: 'DATE_CHANGE',
          refNo: data.ref_no,
          paxName: data.pax_name,
          agentName: data.agent_name,
          teamName: data.team_name,
          pnr: data.pnr,
          airline: data.airline,
          fromTo: data.from_to,
          pcDate: new Date(data.pcDate),
          issuedDate: data.issuedDate ? new Date(data.issuedDate) : null,
          paymentMethod: data.paymentMethod,
          lastPaymentDate: data.lastPaymentDate ? new Date(data.lastPaymentDate) : null,
          travelDate: new Date(data.travelDate),
          revenue: data.revenue,
          prodCost: data.prodCost,
          transFee: data.transFee,
          surcharge: data.surcharge,
          balance: data.balance,
          profit: data.profit,
          invoiced: data.invoiced,
          description: data.description,
          numPax: data.numPax,
          initialPayments: {
            create: (data.initialPayments || []).map(p => ({
              amount: parseFloat(p.amount),
              transactionMethod: p.transactionMethod,
              paymentDate: new Date(p.receivedDate),
            })),
          },
          passengers: {
            create: (data.passengers || []).map(pax => ({
                title: pax.title,
                firstName: pax.firstName,
                middleName: pax.middleName,
                lastName: pax.lastName,
                gender: pax.gender,
                email: pax.email,
                contactNo: pax.contactNo,
                nationality: pax.nationality,
                birthday: pax.birthday ? new Date(pax.birthday) : null,
                category: pax.category,
            }))
          },
          instalments: {
            create: (data.instalments || []).map(inst => ({
              dueDate: new Date(inst.dueDate),
              amount: parseFloat(inst.amount),
              status: inst.status || 'PENDING'
            }))
          },
          costItems: {
            create: (data.prodCostBreakdown || []).map(item => ({
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
                    firstMethodAmount: s.firstMethodAmount ? parseFloat(s.firstMethodAmount) : null,
                    secondMethodAmount: s.secondMethodAmount ? parseFloat(s.secondMethodAmount) : null,
                }))
              }
            }))
          }
        },
      });

      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: newBookingRecord.id,
        action: ActionType.CREATE,
      });

      return tx.booking.findUnique({
        where: { id: newBookingRecord.id },
        include: { costItems: { include: { suppliers: true } }, instalments: true, passengers: true, initialPayments: true }
      });
    });

    return apiResponse.success(res, newBooking, 201);
  } catch (error) {
    console.error('Error creating date change booking:', error);
    if (error.message.includes('booking chain has been cancelled')) {
        return apiResponse.error(res, error.message, 409);
    }
    return apiResponse.error(res, `Failed to create date change booking: ${error.message}`, 500);
  }
};

const createSupplierPayableSettlement = async (req, res) => {
    // --- AUDIT LOG ---
    const { id: userId } = req.user;
    const { payableId, amount, transactionMethod, settlementDate } = req.body;

    try {
        // --- 1. Validation (remains the same) ---
        if (!payableId || !amount || !transactionMethod || !settlementDate) {
            return apiResponse.error(res, 'Missing required fields', 400);
        }
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return apiResponse.error(res, 'Amount must be a positive number', 400);
        }
        if (isNaN(new Date(settlementDate))) {
            return apiResponse.error(res, 'Invalid settlement date', 400);
        }

        // --- 2. Database Operations within a Transaction ---
        const result = await prisma.$transaction(async (tx) => {
            // A. Find the parent payable record and its related booking for logging
            const payable = await tx.supplierPayable.findUnique({
                where: { id: parseInt(payableId) },
                include: {
                    createdFromCancellation: { // Go from Payable -> Cancellation
                        include: {
                            originalBooking: true // Go from Cancellation -> Original Booking
                        }
                    }
                }
            });
            if (!payable) {
                throw new Error('Payable record not found.');
            }
            // Ensure we can find the root booking to log against
            const rootBookingId = payable.createdFromCancellation?.originalBooking?.id;
            if (!rootBookingId) {
                throw new Error('Could not find the originating booking for this payable.');
            }

            if (paymentAmount > payable.pendingAmount + 0.01) {
                throw new Error(`Settlement amount exceeds pending amount.`);
            }

            // --- AUDIT LOG ---
            // Log this outgoing payment on the main originating Booking's history.
            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: rootBookingId,
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [{
                    fieldName: 'supplierPayableSettled',
                    oldValue: `Owed ${payable.totalAmount.toFixed(2)} to ${payable.supplier}`,
                    newValue: `Paid ${paymentAmount.toFixed(2)} to settle debt`
                }]
            });


            // B. Create the settlement history record
            await tx.supplierPayableSettlement.create({
                data: {
                    supplierPayableId: parseInt(payableId),
                    amount: paymentAmount,
                    transactionMethod: transactionMethod,
                    settlementDate: new Date(settlementDate),
                },
            });

            // C. Update the parent payable record's amounts and status
            const newPaidAmount = payable.paidAmount + paymentAmount;
            const newPendingAmount = payable.pendingAmount - paymentAmount;
            
            const updatedPayable = await tx.supplierPayable.update({
                where: { id: parseInt(payableId) },
                data: {
                    paidAmount: newPaidAmount,
                    pendingAmount: newPendingAmount,
                    status: newPendingAmount < 0.01 ? 'PAID' : 'PENDING',
                },
            });

            return updatedPayable;
        });

        // --- 3. Send Success Response ---
        return apiResponse.success(res, { updatedPayable: result }, 201);

    } catch (error) {
        console.error('Error creating supplier payable settlement:', error);
        if (error.message.includes('not found') || error.message.includes('originating booking')) {
            return apiResponse.error(res, error.message, 404);
        }
        if (error.message.includes('exceeds pending amount')) {
            return apiResponse.error(res, error.message, 400);
        }
        return apiResponse.error(res, `Failed to create payable settlement: ${error.message}`, 500);
    }
};

const settleCustomerPayable = async (req, res) => {
    const { id: userId } = req.user;
    const { id: payableId } = req.params;
    const { amount, transactionMethod, paymentDate } = req.body;

    try {
        if (!payableId || !amount || !transactionMethod || !paymentDate) {
            return apiResponse.error(res, 'Missing required fields.', 400);
        }
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return apiResponse.error(res, 'Amount must be a positive number.', 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            const payable = await tx.customerPayable.findUnique({
                where: { id: parseInt(payableId) }
            });

            if (!payable) throw new Error('Payable record not found.');
            if (paymentAmount > payable.pendingAmount + 0.01) {
                throw new Error(`Payment amount exceeds pending balance.`);
            }

            // STEP 1: Fetch the full booking and all its payment sources
            const booking = await tx.booking.findUnique({
                where: { id: payable.bookingId },
                include: {
                    initialPayments: true,
                    instalments: { include: { payments: true } },
                    customerPayables: { include: { settlements: true } },
                }
            });
            if (!booking) throw new Error('Associated booking not found.');

            // A. Create the settlement history record
            await tx.customerPayableSettlement.create({
                data: {
                    customerPayableId: parseInt(payableId),
                    amount: paymentAmount,
                    transactionMethod,
                    paymentDate: new Date(paymentDate),
                },
            });

            // B. Update the CustomerPayable record itself
            const newPaidAmount = payable.paidAmount + paymentAmount;
            const newPendingAmount = payable.pendingAmount - paymentAmount;
            await tx.customerPayable.update({
                where: { id: parseInt(payableId) },
                data: {
                    paidAmount: newPaidAmount,
                    pendingAmount: newPendingAmount,
                    status: newPendingAmount < 0.01 ? 'PAID' : 'PENDING',
                },
            });

            // STEP 2: Recalculate the balance from all sources
            const sumOfInitialPayments = booking.initialPayments.reduce((sum, p) => sum + p.amount, 0);

            const sumOfInstalmentPayments = booking.instalments.reduce((sum, inst) => 
                sum + inst.payments.reduce((pSum, p) => pSum + p.amount, 0), 0);

            // Fetch the settlements again to include the one we just made
            const allSettlements = await tx.customerPayableSettlement.findMany({
                where: { payable: { bookingId: booking.id } }
            });
            const sumOfPayableSettlements = allSettlements.reduce((sum, s) => sum + s.amount, 0);
            
            const newTotalReceived = sumOfInitialPayments + sumOfInstalmentPayments + sumOfPayableSettlements;
            const newBalance = booking.revenue - newTotalReceived;

            // Audit Log (Now logging the balance change)
            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: booking.id,
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [{
                    fieldName: 'balance',
                    oldValue: booking.balance,
                    newValue: newBalance
                }]
            });

            // STEP 3: Update only the fields that exist on the Booking model
            const updatedBooking = await tx.booking.update({
                where: { id: payable.bookingId },
                data: {
                    balance: newBalance,
                    lastPaymentDate: new Date(paymentDate),
                }
            });

            return updatedBooking;
        });

        return apiResponse.success(res, { bookingUpdate: result }, 201);
    } catch (error) {
        console.error("Error settling customer payable:", error);
        if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
        if (error.message.includes('exceeds pending balance')) return apiResponse.error(res, error.message, 400);
        return apiResponse.error(res, `Failed to settle payable: ${error.message}`, 500);
    }
};

const recordPassengerRefund = async (req, res) => {
    // --- AUDIT LOG ---
    const { id: userId } = req.user;
    const { id: cancellationId } = req.params;
    const { amount, transactionMethod, refundDate } = req.body;

    try {
        if (!cancellationId || !amount || !transactionMethod || !refundDate) {
            return apiResponse.error(res, 'Missing required fields.', 400);
        }

        // This function already uses a transaction, which is perfect.
        const result = await prisma.$transaction(async (tx) => {
            // Fetch the cancellation and its parent booking for logging
            const cancellation = await tx.cancellation.findUnique({
                where: { id: parseInt(cancellationId) },
                include: {
                    originalBooking: true // Include the booking to get its ID
                }
            });

            if (!cancellation) throw new Error('Cancellation record not found.');
            if (cancellation.refundStatus === 'PAID') throw new Error('This refund has already been paid.');

            // --- AUDIT LOG ---
            // Log this outgoing refund payment on the original Booking's history.
            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: cancellation.originalBookingId, // The ID of the booking being refunded
                action: ActionType.REFUND_PAYMENT,
                changes: [{
                    fieldName: 'passengerRefund',
                    oldValue: `Owed to passenger: ${cancellation.refundToPassenger.toFixed(2)}`,
                    newValue: `Paid refund of ${parseFloat(amount).toFixed(2)}`
                }]
            });
            
            // Log the status change on the Cancellation record itself
            await createAuditLog(tx, {
                userId,
                modelName: 'Cancellation',
                recordId: cancellation.id,
                action: ActionType.UPDATE,
                changes: [{
                    fieldName: 'refundStatus',
                    oldValue: cancellation.refundStatus,
                    newValue: 'PAID'
                }]
            });


            // 1. Create the payment record
            const refundPayment = await tx.passengerRefundPayment.create({
                data: {
                    cancellationId: parseInt(cancellationId),
                    amount: parseFloat(amount),
                    transactionMethod,
                    refundDate: new Date(refundDate),
                },
            });

            // 2. Update the cancellation status
            await tx.cancellation.update({
                where: { id: parseInt(cancellationId) },
                data: { refundStatus: 'PAID' },
            });

            return refundPayment;
        });

        return apiResponse.success(res, { refundPayment: result }, 201);
    } catch (error) {
        console.error("Error recording passenger refund:", error);
        if (error.message.includes('not found') || error.message.includes('already been paid')) {
            return apiResponse.error(res, error.message, 400);
        }
        return apiResponse.error(res, `Failed to record refund: ${error.message}`, 500);
    }
};


const voidBooking = async (req, res) => {
    const { id } = req.params;
    const { reason } = req.body;
    const { id: userId } = req.user;

    if (!reason) {
        return apiResponse.error(res, 'A reason is required to void a booking.', 400);
    }

    try {
        const updatedBooking = await prisma.$transaction(async (tx) => {
            const bookingToVoid = await tx.booking.findUnique({ where: { id: parseInt(id) } });

            if (!bookingToVoid) throw new Error('Booking not found');
            if (bookingToVoid.bookingStatus === 'VOID') throw new Error('Booking is already voided');

            const voidedBooking = await tx.booking.update({
                where: { id: parseInt(id) },
                data: {
                    bookingStatus: 'VOID',
                    statusBeforeVoid: bookingToVoid.bookingStatus, // Store the original status
                    voidReason: reason,
                    voidedAt: new Date(),
                    voidedById: userId,
                },
            });

            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: voidedBooking.id,
                action: ActionType.VOID_BOOKING,
                changes: [{ fieldName: 'status', oldValue: bookingToVoid.bookingStatus, newValue: 'VOID' }],
                newValue: reason, // Use newValue to store the reason for context in the log
            });

            return voidedBooking;
        });

        return apiResponse.success(res, updatedBooking, 200, "Booking voided successfully.");
    } catch (error) {
        console.error("Error voiding booking:", error);
        return apiResponse.error(res, `Failed to void booking: ${error.message}`, 500);
    }
};

const unvoidBooking = async (req, res) => {
    const { id } = req.params;
    const { id: userId } = req.user;

    try {
        const updatedBooking = await prisma.$transaction(async (tx) => {
            const bookingToUnvoid = await tx.booking.findUnique({ where: { id: parseInt(id) } });

            if (!bookingToUnvoid) throw new Error('Booking not found');
            if (bookingToUnvoid.bookingStatus !== 'VOID') throw new Error('Booking is not voided');
            if (!bookingToUnvoid.statusBeforeVoid) throw new Error('Cannot unvoid: original status is unknown.');

            const unvoidedBooking = await tx.booking.update({
                where: { id: parseInt(id) },
                data: {
                    bookingStatus: bookingToUnvoid.statusBeforeVoid, // Restore original status
                    statusBeforeVoid: null, // Clear all void-related fields
                    voidReason: null,
                    voidedAt: null,
                    voidedById: null,
                },
            });

            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: unvoidedBooking.id,
                action: ActionType.UNVOID_BOOKING,
                changes: [{ fieldName: 'status', oldValue: 'VOID', newValue: unvoidedBooking.bookingStatus }],
            });

            return unvoidedBooking;
        });

        return apiResponse.success(res, updatedBooking, 200, "Booking has been restored.");
    } catch (error) {
        console.error("Error unvoiding booking:", error);
        return apiResponse.error(res, `Failed to unvoid booking: ${error.message}`, 500);
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
  recordSettlementPayment,
  getTransactions,
  createCancellation,
  getAvailableCreditNotes,
  createDateChangeBooking,
  createSupplierPayableSettlement,
  settleCustomerPayable,
  recordPassengerRefund,
  voidBooking,
  unvoidBooking
};