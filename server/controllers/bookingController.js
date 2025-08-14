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

  const { userId } = req.user;

  try {
    const pendingBooking = await prisma.$transaction(async (tx) => {
      // 1. Validate required fields
      const requiredFields = [ 'ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'travelDate', 'numPax' ];
      const missingFields = requiredFields.filter((field) => !req.body[field] && req.body[field] !== 0);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }

      // 2. Validate enums and other basic data
      const validTeams = ['PH', 'TOURS'];
      if (!validTeams.includes(req.body.team_name)) throw new Error(`Invalid team_name. Must be one of: ${validTeams.join(', ')}`);
      if (parseInt(req.body.numPax) < 1) throw new Error('numPax must be a positive integer');

      // 3. Validate Passenger Data
      const passengers = req.body.passengers || [];
      if (passengers.length === 0) throw new Error('At least one passenger detail must be provided.');
      // ... (You can add more detailed passenger validation here if needed)

      // 4. Validate Product Cost Breakdown and Credit Notes
      const prodCostBreakdown = req.body.prodCostBreakdown || [];
      for (const item of prodCostBreakdown) {
        for (const s of item.suppliers) {
          // Check for credit note logic
          if (s.paymentMethod.includes('CREDIT_NOTES')) {
            const amountToCoverByNotes = (s.paymentMethod === 'CREDIT_NOTES')
              ? (parseFloat(s.firstMethodAmount) || 0) // For single method, it's the full amount
              : (parseFloat(s.secondMethodAmount) || 0); // For combined, it's the second amount

            const totalAppliedFromNotes = (s.selectedCreditNotes || []).reduce((sum, note) => sum + note.amountToUse, 0);

            if (Math.abs(totalAppliedFromNotes - amountToCoverByNotes) > 0.01) {
              throw new Error(`For supplier ${s.supplier}, the applied credit notes total (£${totalAppliedFromNotes.toFixed(2)}) does not match the required amount (£${amountToCoverByNotes.toFixed(2)}).`);
            }

            // Validate each used credit note
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

      // 5. Calculate financials
      const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      const revenue = req.body.revenue ? parseFloat(req.body.revenue) : 0;
      const received = req.body.received ? parseFloat(req.body.received) : 0;
      const transFee = req.body.transFee ? parseFloat(req.body.transFee) : 0;
      const surcharge = req.body.surcharge ? parseFloat(req.body.surcharge) : 0;
      const profit = revenue - calculatedProdCost - transFee - surcharge;
      const balance = revenue - received;

      // 6. Create the Pending Booking record
      const newPendingBooking = await tx.pendingBooking.create({
        data: {
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
          received: received || null,
          transactionMethod: req.body.transactionMethod || null,
          receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : null,
          balance: balance,
          profit: profit,
          invoiced: req.body.invoiced || null,
          description: req.body.description || null,
          status: 'PENDING',
          numPax: parseInt(req.body.numPax),
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

      // 7. Process Credit Note Usage
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
        action: ActionType.CREATE,
      });

      return tx.pendingBooking.findUnique({
          where: { id: newPendingBooking.id },
          include: { costItems: { include: { suppliers: true } }, instalments: true, passengers: true }
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

// In server/controllers/bookingController.js

const approveBooking = async (req, res) => {
  const bookingId = parseInt(req.params.id);
  if (isNaN(bookingId)) {
    return apiResponse.error(res, 'Invalid booking ID', 400);
  }

  // --- AUDIT LOG ---
  // Get the userId of the admin/manager who is approving this booking.
  const { userId } = req.user;

  try {
    const booking = await prisma.$transaction(async (tx) => {
      // 1. Fetch the complete pending booking (remains the same)
      const pendingBooking = await tx.pendingBooking.findUnique({
        where: { id: bookingId },
        include: {
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
        },
      });

      if (!pendingBooking) {
        throw new Error('Pending booking not found');
      }
      if (pendingBooking.status !== 'PENDING') {
        throw new Error('Pending booking already processed');
      }

      // Folder Number Logic (remains the same)
      const allBookings = await tx.booking.findMany({
        select: { folderNo: true },
      });
      const maxFolderNo = Math.max(
        0,
        ...allBookings.map(b => parseInt(b.folderNo.split('.')[0], 10))
      );
      const newFolderNo = String(maxFolderNo + 1);

      // 2. Create the new Booking (remains the same)
      const newBooking = await tx.booking.create({
        data: {
          // ... all your existing booking data from pendingBooking ...
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
          received: pendingBooking.received ? parseFloat(pendingBooking.received) : null,
          initialDeposit: (pendingBooking.paymentMethod === 'INTERNAL' || pendingBooking.paymentMethod === 'INTERNAL_HUMM') 
            ? (parseFloat(pendingBooking.received) || 0) 
            : (parseFloat(pendingBooking.revenue) || 0),
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
          await tx.costItemSupplier.update({
            where: { id: supplier.id },
            data: {
              costItemId: newCostItemId,
              pendingCostItemId: null,
            },
          });
        }
      }

      // --- AUDIT LOG: Step A ---
      // Log the approval action on the PendingBooking record.
      await createAuditLog(tx, {
        userId: userId,
        modelName: 'PendingBooking',
        recordId: pendingBooking.id,
        action: ActionType.APPROVE_PENDING,
        changes: [{
          fieldName: 'status',
          oldValue: 'PENDING',
          newValue: 'APPROVED'
        }]
      });
      
      // --- AUDIT LOG: Step B ---
      // Log the creation of the new, official Booking record.
      await createAuditLog(tx, {
        userId: userId, // We attribute creation of the main booking to the approver.
        modelName: 'Booking',
        recordId: newBooking.id,
        action: ActionType.CREATE
      });


      // 4. Mark the pending booking as processed (remains the same)
      await tx.pendingBooking.update({
        where: { id: bookingId },
        data: { status: 'APPROVED' },
      });
      
      // 5. Return the full, newly created and linked booking (remains the same)
      return tx.booking.findUnique({
          where: { id: newBooking.id },
          include: {
              costItems: { include: { suppliers: true } },
              instalments: true,
              passengers: true
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
  const { userId } = req.user;
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

  const { userId } = req.user;

  try {
     const requiredFields = [
      'ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to',
      'bookingType', 'paymentMethod', 'pcDate', 'issuedDate', 'travelDate',
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

    const booking = await prisma.$transaction(async (tx) => {
      // Your financial calculations remain the same
      const prodCostBreakdown = req.body.prodCostBreakdown || [];
      const calculatedProdCost = prodCostBreakdown.reduce((sum, item) => sum + parseFloat(item.amount), 0);
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
          transactionMethod: req.body.transactionMethod || null,
          receivedDate: req.body.receivedDate ? new Date(req.body.receivedDate) : null,
          description: req.body.description || null,
          ...financialData,
          costItems: {
            create: prodCostBreakdown.map(item => ({
              category: item.category, amount: parseFloat(item.amount),
              suppliers: { create: item.suppliers.map(s => ({ ...s })) },
            })),
          },
        instalments: {
            create: (req.body.instalments || []).map(inst => ({
              ...inst, dueDate: new Date(inst.dueDate),
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
    if (error.code === 'P2003') {
      return apiResponse.error(res, "Invalid enum value provided", 400);
    }
    return apiResponse.error(res, "Failed to create booking: " + error.message, 500);
  }
};

// In bookingController.js

const getBookings = async (req, res) => {
  try {
    const bookings = await prisma.booking.findMany({
      // The `where` clause is no longer needed since we aren't nesting bookings
      include: {
        costItems: { include: { suppliers: true } },
        passengers: true,
        instalments: { include: { payments: true } },
        cancellation: true, // <-- NEW: Include the related cancellation record
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

  const { userId } = req.user;
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
  // --- AUDIT LOG ---
  const { userId } = req.user;
  const { id } = req.params;
  const { amount, status, transactionMethod, paymentDate } = req.body;

  try {
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0 || !['PENDING', 'PAID', 'OVERDUE'].includes(status)) {
        return apiResponse.error(res, 'Invalid amount or status.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // Find the instalment and its parent booking
      const instalmentToUpdate = await tx.instalment.findUnique({
        where: { id: parseInt(id) },
        include: { booking: true },
      });

      if (!instalmentToUpdate) {
        throw new Error('Instalment not found');
      }

      // --- LOGIC REMAINS THE SAME ---
      // Step 1: Create the payment record if the instalment is being marked as PAID.
      if (status === 'PAID') {
          await tx.instalmentPayment.create({
              data: {
                  instalmentId: parseInt(id),
                  amount: parseFloat(amount),
                  transactionMethod,
                  paymentDate: new Date(paymentDate),
              },
          });

          // --- AUDIT LOG: Step A ---
          // Log the status change on the Instalment record itself
          await createAuditLog(tx, {
            userId,
            modelName: 'Instalment',
            recordId: instalmentToUpdate.id,
            action: ActionType.UPDATE,
            changes: [{
              fieldName: 'status',
              oldValue: instalmentToUpdate.status,
              newValue: 'PAID'
            }]
          });

          // --- AUDIT LOG: Step B ---
          // Log that a payment was made on the parent Booking record
          await createAuditLog(tx, {
            userId,
            modelName: 'Booking',
            recordId: instalmentToUpdate.bookingId,
            action: ActionType.SETTLEMENT_PAYMENT, // Using a specific action type
            changes: [{
              fieldName: 'received',
              oldValue: instalmentToUpdate.booking.received,
              // The newValue will be calculated and logged after the update
              newValue: `(See new balance)` // Placeholder
            }]
          });
      }

      // Step 2: Update the instalment itself.
      const updatedInstalment = await tx.instalment.update({
        where: { id: parseInt(id) },
        data: { amount: parseFloat(amount), status },
        include: { payments: true }
      });

      // Step 3: Recalculate the booking's totals.
      const allPaymentsForBooking = await tx.instalmentPayment.findMany({
          where: { instalment: { bookingId: instalmentToUpdate.bookingId } }
      });
      const totalPaidViaInstalments = allPaymentsForBooking.reduce((sum, p) => sum + p.amount, 0);
      const newTotalReceived = (instalmentToUpdate.booking.initialDeposit || 0) + totalPaidViaInstalments;
      const newBalance = (instalmentToUpdate.booking.revenue || 0) - newTotalReceived;
      
      // Step 4: Update the parent booking.
      const updatedBooking = await tx.booking.update({
          where: { id: instalmentToUpdate.bookingId },
          data: {
              received: newTotalReceived,
              balance: newBalance,
              lastPaymentDate: status === 'PAID' ? new Date(paymentDate) : instalmentToUpdate.booking.lastPaymentDate,
          }
      });
      // --- END OF ORIGINAL LOGIC ---

      return {
          updatedInstalment,
          bookingUpdate: {
              id: updatedBooking.id,
              received: updatedBooking.received,
              balance: updatedBooking.balance
          }
      };
    });

    return apiResponse.success(res, result);
  } catch (error) {
    console.error('Error updating instalment:', error);
    if (error.message === 'Instalment not found') {
      return apiResponse.error(res, error.message, 404);
    }
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
        folderNo: true, 
        refNo: true,
        paxName: true,
        agentName: true,
        pcDate: true,
        travelDate: true,
        revenue: true,
        received: true,
        transactionMethod: true,
        receivedDate: true,
        bookingStatus: true,
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
                refundToPassenger: true,
                profitOrLoss: true,
                refundPayment: { 
                    select: {
                        amount: true,
                        transactionMethod: true,
                        refundDate: true
                    }
                },
                refundStatus: true, // It's good practice to select this too
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
      const totalReceivedFromDb = parseFloat(booking.received || 0);
      const revenue = parseFloat(booking.revenue || 0);

      const sumOfPaidInstalments = (booking.instalments || [])
        .filter((inst) => inst.status === 'PAID')
        .reduce((sum, inst) => {
            const paymentTotal = (inst.payments || []).reduce((pSum, p) => pSum + parseFloat(p.amount), 0);
            return sum + paymentTotal;
        }, 0);
      
      const initialDeposit = totalReceivedFromDb - sumOfPaidInstalments;

      const paymentHistory = [];
      if (initialDeposit > 0.01) {
        paymentHistory.push({
          type: 'Initial Deposit',
          date: booking.receivedDate || booking.pcDate,
          amount: initialDeposit,
          method: booking.transactionMethod || 'N/A',
        });
      }

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
      
      if (booking.cancellation) {
        // Add the refund payment to the history if it exists
        if (booking.cancellation.refundPayment) {
            paymentHistory.push({
                type: 'Passenger Refund Paid',
                date: booking.cancellation.refundPayment.refundDate,
                amount: booking.cancellation.refundPayment.amount,
                method: booking.cancellation.refundPayment.transactionMethod,
            });
        }

        // --- STEP 2: ADD CUSTOMER DEBT PAYMENTS TO THE HISTORY ---
        if (booking.cancellation.createdCustomerPayable) {
            const settlements = booking.cancellation.createdCustomerPayable.settlements || [];
            settlements.forEach(settlement => {
                paymentHistory.push({
                    type: 'Cancellation Debt Paid', // A clear description
                    date: settlement.paymentDate,
                    amount: settlement.amount,
                    method: settlement.transactionMethod
                });
            });
        }
      }
      
      // Sort all transactions chronologically
      paymentHistory.sort((a, b) => new Date(a.date) - new Date(b.date));
      
      // Because we use the spread operator '...booking', the new 'folderNo' field will automatically be included here.
      return {
        ...booking,
        revenue: revenue.toFixed(2),
        received: totalReceivedFromDb.toFixed(2),
        balance: (revenue - totalReceivedFromDb).toFixed(2),
        initialDeposit: initialDeposit.toFixed(2),
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

  const { userId } = req.user;
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
    // --- 1. FETCH ALL DATA SOURCES ---

    const bookings = await prisma.booking.findMany({
      select: {
        id: true, refNo: true, bookingStatus: true, folderNo: true,
        costItems: {
          select: {
            category: true,
            suppliers: {
              select: {
                id: true, supplier: true, amount: true, paidAmount: true, pendingAmount: true, createdAt: true, paymentMethod: true, firstMethodAmount: true, secondMethodAmount: true,
                settlements: true, paidByCreditNoteUsage: { include: { creditNote: { select: { id: true } } } }
              }
            }
          }
        },
        cancellation: {
          include: { createdPayable: true }
        }
      }
    });


    const allCreditNotes = await prisma.supplierCreditNote.findMany({
      include: {
        generatedFromCancellation: { include: { originalBooking: { select: { refNo: true } } } },
        usageHistory: {
          include: {
            usedOnCostItemSupplier: {
              include: {
                costItem: { include: { booking: { select: { refNo: true } } } },
                pendingCostItem: { include: { pendingBooking: { select: { refNo: true } } } }
              }
            }
          }
        }
      }
    });

    // --- FIX #1: Use 'include' to traverse relationships instead of a non-existent direct field ---
    const allPayables = await prisma.supplierPayable.findMany({
      where: { status: 'PENDING' },
      include: { // Use include to fetch related data
        settlements: true,
        createdFromCancellation: { // The link to the cancellation
          select: {
            originalBooking: { // The link from cancellation to the root booking
              select: {
                folderNo: true // The field we need!
              }
            }
          }
        }
      }
    });

    const cancellationOutcomes = new Map();
    bookings.forEach(booking => {
        if (booking.cancellation) {
            const baseFolderNo = booking.folderNo.toString().split('.')[0];
            cancellationOutcomes.set(baseFolderNo, {
                creditNoteAmount: booking.cancellation.creditNoteAmount,
                payable: booking.cancellation.createdPayable
            });
        }
    });

    // --- 2. BUILD THE SUPPLIER SUMMARY OBJECT ---
    const supplierSummary = {};

    const ensureSupplier = (supplierName) => {
      if (!supplierSummary[supplierName]) {
        supplierSummary[supplierName] = {
          totalAmount: 0, totalPaid: 0, totalPending: 0,
          transactions: [], payables: [],
        };
      }
    };

    bookings.forEach(booking => {
      const baseFolderNo = booking.folderNo.toString().split('.')[0];
      const outcome = cancellationOutcomes.get(baseFolderNo);

      booking.costItems.forEach(item => {
        item.suppliers.forEach(s => {
          ensureSupplier(s.supplier);
          supplierSummary[s.supplier].transactions.push({
            type: 'Booking',
            data: {
              ...s,
              folderNo: booking.folderNo, // This part for bookings is correct.
              refNo: booking.refNo,
              category: item.category,
              bookingStatus: booking.bookingStatus,
              pendingAmount: booking.bookingStatus === 'CANCELLED' ? 0 : s.pendingAmount,
              cancellationOutcome: outcome || null,
            },
          });
        });
      });
    });

    allCreditNotes.forEach(note => {
      ensureSupplier(note.supplier);
      const modifiedUsageHistory = note.usageHistory.map(usage => ({
        ...usage,
        usedOnRefNo: usage.usedOnCostItemSupplier?.costItem?.booking?.refNo || usage.usedOnCostItemSupplier?.pendingCostItem?.pendingBooking?.refNo || 'N/A',
      }));
      supplierSummary[note.supplier].transactions.push({
        type: 'CreditNote',
        data: {
          ...note,
          usageHistory: modifiedUsageHistory,
          generatedFromRefNo: note.generatedFromCancellation?.originalBooking?.refNo || 'N/A'
        }
      });
    });
    
    // Process all payables
    allPayables.forEach(payable => {
      ensureSupplier(payable.supplier);

      // --- FIX #2: Extract the folder number from the included relationship and add it ---
      const originatingFolderNo = payable.createdFromCancellation?.originalBooking?.folderNo || 'N/A';

      supplierSummary[payable.supplier].payables.push({
        ...payable, // keep all original payable fields
        originatingFolderNo: originatingFolderNo, // add the field the frontend expects
      });
    });

    // --- 3. FINAL CALCULATION AND SORTING ---
    for (const supplierName in supplierSummary) {
      const supplier = supplierSummary[supplierName];
      
      const bookingTotals = supplier.transactions
        .filter(t => t.type === 'Booking')
        .reduce((acc, tx) => {
          acc.totalAmount += tx.data.amount || 0;
          acc.totalPaid += tx.data.paidAmount || 0;
          acc.totalPending += tx.data.pendingAmount || 0;
          return acc;
        }, { totalAmount: 0, totalPaid: 0, totalPending: 0 });

      const payablesPending = supplier.payables.reduce((sum, p) => sum + p.pendingAmount, 0);

      supplier.totalAmount = bookingTotals.totalAmount;
      supplier.totalPaid = bookingTotals.totalPaid;
      supplier.totalPending = bookingTotals.totalPending + payablesPending;
      
      supplier.transactions.sort((a, b) => new Date(b.data.createdAt) - new Date(a.data.createdAt));
    }

    return apiResponse.success(res, supplierSummary);
  } catch (error) {
    console.error('Error fetching suppliers info:', error);
    return apiResponse.error(res, `Failed to fetch suppliers info: ${error.message}`, 500);
  }
};

const updatePendingBooking = async (req, res) => {
  const { userId } = req.user;
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
  const { userId } = req.user;
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
        include: { instalments: true },
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
      
      // --- AUDIT LOG ---
      // Log this payment event on the main Booking record.
      await createAuditLog(tx, {
          userId,
          modelName: 'Booking',
          recordId: booking.id,
          action: ActionType.SETTLEMENT_PAYMENT,
          changes: [{
            fieldName: 'received',
            oldValue: booking.received,
            newValue: `(Received settlement of £${paymentAmount.toFixed(2)})`
          }]
      });


      // --- 4. Recalculate Totals for the Booking ---
      const allInstalments = await tx.instalment.findMany({
          where: { bookingId: booking.id },
          include: { payments: true }
      });

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

      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          received: newTotalReceived,
          balance: newBalance,
          lastPaymentDate: new Date(paymentDate),
        },
      });

      // --- 5. Return a useful payload ---
      return {
          bookingUpdate: {
              id: updatedBooking.id,
              received: updatedBooking.received,
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
    // --- 1. FETCH ALL FINANCIAL EVENTS FROM APPROVED BOOKINGS ONLY ---

    // === MONEY IN ===

    // A) Initial Payments for NON-INSTALMENT bookings (e.g., 'FULL' payment)
    const nonInstalmentPayments = await prisma.booking.findMany({
      where: {
        received: { gt: 0 },
        paymentMethod: { notIn: ['INTERNAL', 'INTERNAL_HUMM'] },
      },
      select: { id: true, refNo: true, paxName: true, received: true, receivedDate: true, transactionMethod: true },
    });

    // B) Data for calculating Initial Deposits for INSTALMENT bookings
    const internalBookings = await prisma.booking.findMany({
        where: {
            paymentMethod: { in: ['INTERNAL', 'INTERNAL_HUMM'] },
            received: { gt: 0 }
        },
        include: {
            instalments: {
                where: { status: 'PAID' },
                include: { payments: true }
            }
        }
    });

    // C) All Instalment Payments (this will be used for both deposits and regular instalments)
    const instalmentPayments = await prisma.instalmentPayment.findMany({
      include: { instalment: { select: { booking: { select: { refNo: true, paxName: true } } } } },
    });

    // --- FIX #1: Credit Notes are now treated as INCOMING ---
    // D) Credit Notes Received from a supplier
    const creditNotesReceived = await prisma.supplierCreditNote.findMany({
      select: { id: true, supplier: true, initialAmount: true, createdAt: true, generatedFromCancellation: { include: { originalBooking: { select: { refNo: true } } } } },
    });


    // === MONEY OUT ===

    // --- FIX #2: Filter payments to only include those from APPROVED bookings ---
    // E) Initial Supplier Payments (cash out at booking time)
    const initialSupplierPayments = await prisma.costItemSupplier.findMany({
      where: {
        paymentMethod: 'BANK_TRANSFER',
        costItemId: { not: null } // This ensures it's linked to an approved booking's CostItem
      },
      include: {
        costItem: { include: { booking: { select: { refNo: true } } } },
      }
    });

    // F) Supplier Settlements (subsequent cash out)
    const supplierSettlements = await prisma.supplierPaymentSettlement.findMany({
      where: {
        costItemSupplier: {
          costItemId: { not: null } // This ensures it's linked to an approved booking's CostItem
        }
      },
      include: { costItemSupplier: { select: { supplier: true, costItem: { select: { booking: { select: { refNo: true } } } } } } },
    });
    // --- END OF FIX #2 ---

    // G) Passenger Refunds (cash out to customer on cancellation)
    const passengerRefunds = await prisma.cancellation.findMany({
      where: { refundToPassenger: { gt: 0 } },
      include: { originalBooking: { select: { refNo: true, paxName: true } } },
    });

    const adminFees = await prisma.cancellation.findMany({
      where: {
        adminFee: { gt: 0 }
      },
      include: {
        originalBooking: { select: { refNo: true } }
      }
    });


    // --- 2. MAP ALL EVENTS TO A STANDARDIZED FORMAT ---

    const transactionsList = [];

    // Map A) Non-Instalment Full Payments
    nonInstalmentPayments.forEach(booking => {
        transactionsList.push({ id: `fullpay-${booking.id}`, type: 'Incoming', category: 'Full Payment', date: booking.receivedDate, amount: booking.received, bookingRefNo: booking.refNo, method: booking.transactionMethod, details: `From: ${booking.paxName}` });
    });

    // Map B) Calculate and Map Initial Deposits from Instalment Bookings
    internalBookings.forEach(booking => {
        const totalReceived = parseFloat(booking.received || 0);
        const sumOfPaidInstalments = booking.instalments.reduce((sum, inst) => sum + inst.payments.reduce((pSum, p) => pSum + parseFloat(p.amount), 0), 0);
        const initialDeposit = totalReceived - sumOfPaidInstalments;

        if (initialDeposit > 0.01) {
            transactionsList.push({ id: `deposit-${booking.id}`, type: 'Incoming', category: 'Customer Deposit', date: booking.createdAt, amount: initialDeposit, bookingRefNo: booking.refNo, method: booking.transactionMethod || 'N/A', details: `From: ${booking.paxName}` });
        }
    });

    // Map C) All Instalment Payments
    instalmentPayments.forEach(payment => {
        transactionsList.push({ id: `inst-${payment.id}`, type: 'Incoming', category: 'Instalment', date: payment.paymentDate, amount: payment.amount, bookingRefNo: payment.instalment.booking.refNo, method: payment.transactionMethod, details: `From: ${payment.instalment.booking.paxName}` });
    });

    // Map D) Credit Notes Received
    creditNotesReceived.forEach(note => {
        transactionsList.push({ id: `cn-recv-${note.id}`, type: 'Incoming', category: 'Credit Note Received', date: note.createdAt, amount: note.initialAmount, bookingRefNo: note.generatedFromCancellation?.originalBooking?.refNo || 'N/A', method: 'Internal Credit', details: `From Supplier: ${note.supplier}` });
    });
    
    // Map E) Initial Supplier Payments
    initialSupplierPayments.forEach(payment => {
        transactionsList.push({ id: `supp-initial-${payment.id}`, type: 'Outgoing', category: 'Initial Supplier Pmt', date: payment.createdAt, amount: payment.amount, bookingRefNo: payment.costItem?.booking?.refNo || 'N/A', method: payment.transactionMethod, details: `To: ${payment.supplier}` });
    });
    
    // Map F) Supplier Settlements
    supplierSettlements.forEach(settlement => {
      transactionsList.push({ id: `supp-settle-${settlement.id}`, type: 'Outgoing', category: 'Supplier Settlement', date: settlement.settlementDate, amount: settlement.amount, bookingRefNo: settlement.costItemSupplier?.costItem?.booking?.refNo || 'N/A', method: settlement.transactionMethod, details: `To: ${settlement.costItemSupplier?.supplier || 'Unknown'}` });
    });

    // Map G) Passenger Refunds
    passengerRefunds.forEach(cancellation => {
      transactionsList.push({ id: `refund-${cancellation.id}`, type: 'Outgoing', category: 'Passenger Refund', date: cancellation.createdAt, amount: cancellation.refundToPassenger, bookingRefNo: cancellation.originalBooking.refNo, method: cancellation.refundTransactionMethod, details: `To: ${cancellation.originalBooking.paxName}` });
    });

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
  // --- AUDIT LOG ---
  const { userId } = req.user;
  const { id: triggerBookingId } = req.params;
  const { supplierCancellationFee, adminFee, refundTransactionMethod } = req.body;

  if (supplierCancellationFee === undefined || adminFee === undefined || !refundTransactionMethod) {
    return apiResponse.error(res, 'Supplier Fee, Admin Fee, and Method are required.', 400);
  }

  try {
    // This function already uses a transaction, which is perfect.
    const result = await prisma.$transaction(async (tx) => {
      // --- All your existing logic for finding bookings and calculating financials remains the same ---
      const triggerBooking = await tx.booking.findUnique({ where: { id: parseInt(triggerBookingId) } });
      if (!triggerBooking) throw new Error('Booking not found.');

      const baseFolderNo = triggerBooking.folderNo.toString().split('.')[0];
      const chainBookings = await tx.booking.findMany({
        where: { OR: [{ folderNo: baseFolderNo }, { folderNo: { startsWith: `${baseFolderNo}.` } }] },
        include: { costItems: { include: { suppliers: true } } },
      });

      if (chainBookings.some(b => b.bookingStatus === 'CANCELLED')) {
        throw new Error('This booking chain has already been cancelled.');
      }
      const rootBookingInChain = chainBookings.find(b => b.folderNo === baseFolderNo);
      if (!rootBookingInChain) throw new Error('Could not find root booking.');

      const totalChainPaidToSupplier = chainBookings.flatMap(b => b.costItems).flatMap(ci => ci.suppliers).reduce((sum, s) => sum + (s.paidAmount || 0), 0);
      const totalChainReceivedFromCustomer = chainBookings.reduce((sum, b) => sum + (b.received || 0), 0);

      const supCancellationFee = parseFloat(supplierCancellationFee);
      const customerTotalCancellationFee = supCancellationFee + parseFloat(adminFee);

      const supplierDifference = totalChainPaidToSupplier - supCancellationFee;
      const customerDifference = totalChainReceivedFromCustomer - customerTotalCancellationFee;
      
      const refundToPassenger = customerDifference > 0 ? customerDifference : 0;
      const payableByCustomer = customerDifference < 0 ? Math.abs(customerDifference) : 0;
      
      const profitOrLoss = (totalChainReceivedFromCustomer - totalChainPaidToSupplier) - refundToPassenger + payableByCustomer;
      // --- End of existing logic ---


      // --- CREATE CANCELLATION RECORD ---
      const newCancellationRecord = await tx.cancellation.create({
        data: {
          // ... all your existing cancellation data ...
          originalBookingId: rootBookingInChain.id, folderNo: `${baseFolderNo}.C`, refundTransactionMethod,
          originalRevenue: rootBookingInChain.revenue || 0, originalProdCost: rootBookingInChain.prodCost || 0,
          supplierCancellationFee: supCancellationFee,
          refundToPassenger: refundToPassenger,
          adminFee: parseFloat(adminFee), // Make sure admin fee is stored
          creditNoteAmount: supplierDifference > 0 ? supplierDifference : 0,
          refundStatus: refundToPassenger > 0 ? 'PENDING' : 'N/A',
          profitOrLoss: profitOrLoss,
          description: `Cancellation for chain ${baseFolderNo}.`,
        },
      });

      // --- AUDIT LOG: Step A ---
      // Log the creation of the Cancellation record itself.
      await createAuditLog(tx, {
        userId,
        modelName: 'Cancellation',
        recordId: newCancellationRecord.id,
        action: ActionType.CREATE,
      });

      // --- AUDIT LOG: Step B ---
      // Log that the cancellation process was initiated on the root booking.
      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: rootBookingInChain.id,
        action: ActionType.CREATE_CANCELLATION, // Using a specific action type
        changes: [{
            fieldName: 'bookingStatus',
            oldValue: rootBookingInChain.bookingStatus,
            newValue: 'CANCELLED'
        }]
      });
      

      // --- CREATE PAYABLES OR CREDIT NOTES ---
      if (supplierDifference > 0) {
        // ... credit note creation logic
      } else if (supplierDifference < 0) {
        // ... payable creation logic
      }
      if (payableByCustomer > 0) {
        // ... customer payable creation logic
      }


      // Update all bookings in the chain to CANCELLED status
      await tx.booking.updateMany({ where: { id: { in: chainBookings.map(b => b.id) } }, data: { bookingStatus: 'CANCELLED' } });
      
      // --- AUDIT LOG: Step C ---
      // Log the status change for all other bookings in the chain
      for (const booking of chainBookings) {
        // Skip the root booking since we already logged it more specifically
        if (booking.id === rootBookingInChain.id) continue;
        
        await createAuditLog(tx, {
            userId,
            modelName: 'Booking',
            recordId: booking.id,
            action: ActionType.UPDATE,
            changes: [{
                fieldName: 'bookingStatus',
                oldValue: booking.bookingStatus,
                newValue: 'CANCELLED'
            }]
        });
      }

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
  // --- AUDIT LOG ---
  const { userId } = req.user;
  const originalBookingId = parseInt(req.params.id);
  const data = req.body;

  try {
    // This function already uses a transaction, which is great.
    const newBooking = await prisma.$transaction(async (tx) => {
      // --- Step 1: Validation and Setup (remains the same) ---
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
      // --- End of validation ---

      // --- Step 2: Folder Number and Status Update Logic ---
      const relatedBookings = await tx.booking.findMany({ where: { folderNo: { startsWith: `${baseFolderNo}.` } } });
      const newIndex = relatedBookings.length; // Corrected index logic
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
      
      // --- AUDIT LOG: Step A ---
      // Log the status change on the now-completed booking.
      await createAuditLog(tx, {
          userId,
          modelName: 'Booking',
          recordId: bookingToUpdateId,
          action: ActionType.DATE_CHANGE, // A specific action for clarity
          changes: [{
            fieldName: 'bookingStatus',
            oldValue: oldBookingStatus,
            newValue: 'COMPLETED'
          }]
      });

      // --- Step 3: Create the new date-changed Booking record ---
      const newBookingRecord = await tx.booking.create({
        data: {
          // ... all your existing booking data ...
          originalBookingId: originalBooking.id, folderNo: newFolderNo, bookingStatus: 'CONFIRMED', bookingType: 'DATE_CHANGE',
          refNo: data.ref_no, paxName: data.pax_name, agentName: data.agent_name, teamName: data.team_name,
          pnr: data.pnr, airline: data.airline, fromTo: data.from_to, pcDate: new Date(data.pcDate),
          issuedDate: data.issuedDate ? new Date(data.issuedDate) : null,
          paymentMethod: data.paymentMethod, lastPaymentDate: data.lastPaymentDate ? new Date(data.lastPaymentDate) : null,
          travelDate: new Date(data.travelDate), revenue: data.revenue, prodCost: data.prodCost,
          transFee: data.transFee, surcharge: data.surcharge, received: data.received,
          initialDeposit: (data.paymentMethod === 'INTERNAL' || data.paymentMethod === 'INTERNAL_HUMM') 
              ? (parseFloat(data.received) || 0) 
              : (parseFloat(data.revenue) || 0),
          transactionMethod: data.transactionMethod, receivedDate: data.receivedDate ? new Date(data.receivedDate) : null,
          balance: data.balance, profit: data.profit, invoiced: data.invoiced,
          description: data.description, numPax: data.numPax,
        },
      });

      // --- AUDIT LOG: Step B ---
      // Log the creation of this new booking in the chain.
      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: newBookingRecord.id,
        action: ActionType.CREATE,
      });


      // --- Step 4: Sequentially create related records (remains the same) ---
      if (data.passengers && data.passengers.length > 0) {
        // ... passenger creation logic ...
      }
      if (data.instalments && data.instalments.length > 0) {
        // ... instalment creation logic ...
      }
      for (const item of (data.prodCostBreakdown || [])) {
        // ... cost item and supplier creation logic ...
      }


      // --- Step 5: Return the complete booking (remains the same) ---
      return tx.booking.findUnique({
        where: { id: newBookingRecord.id },
        include: { costItems: { include: { suppliers: true } }, instalments: true, passengers: true }
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
    const { userId } = req.user;
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
    // --- AUDIT LOG ---
    const { userId } = req.user;
    const { id: payableId } = req.params;
    const { amount, transactionMethod, paymentDate } = req.body;

    try {
        // --- 1. Validation (remains the same) ---
        if (!payableId || !amount || !transactionMethod || !paymentDate) {
            return apiResponse.error(res, 'Missing required fields.', 400);
        }
        const paymentAmount = parseFloat(amount);
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return apiResponse.error(res, 'Amount must be a positive number.', 400);
        }

        // --- 2. Database operations in a transaction (already exists, which is perfect) ---
        const result = await prisma.$transaction(async (tx) => {
            const payable = await tx.customerPayable.findUnique({
                where: { id: parseInt(payableId) },
                include: { booking: true } // This correctly includes the parent booking
            });

            if (!payable) throw new Error('Payable record not found.');
            if (paymentAmount > payable.pendingAmount + 0.01) {
                throw new Error(`Payment amount exceeds pending balance.`);
            }

            // --- AUDIT LOG ---
            // Log this incoming payment on the parent Booking's history.
            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: payable.bookingId, // We have the bookingId directly from the payable record
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [{
                    fieldName: 'customerPayableSettled',
                    oldValue: `Customer owed ${payable.totalAmount.toFixed(2)}`,
                    newValue: `Customer paid ${paymentAmount.toFixed(2)} to settle debt`
                }]
            });

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

            // C. CRITICAL: Update the parent Booking's totals
            const updatedBooking = await tx.booking.update({
                where: { id: payable.bookingId },
                data: {
                    received: (payable.booking.received || 0) + paymentAmount,
                    balance: (payable.booking.balance || 0) - paymentAmount,
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
    const { userId } = req.user;
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
  recordPassengerRefund
};