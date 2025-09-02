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
  // console.log('Received body for pending booking:', JSON.stringify(req.body, null, 2)); // Keep for debugging if needed

  const { id: userId } = req.user;

  try {
    const pendingBookingResult = await prisma.$transaction(async (tx) => {
      const {
        ref_no, pax_name, agent_name, team_name, pnr, airline, from_to, bookingType,
        paymentMethod, pcDate, issuedDate, travelDate, numPax, revenue, transFee,
        surcharge, invoiced, description, initialPayments, prodCostBreakdown, instalments, passengers
      } = req.body;

      // --- 1. Initial Validation ---
      const requiredFields = [ 'ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'numPax' ];
      const missingFields = requiredFields.filter((field) => !req.body[field] && req.body[field] !== 0);
      if (missingFields.length > 0) {
        throw new Error(`Missing required fields: ${missingFields.join(', ')}`);
      }
      if (!initialPayments || initialPayments.length === 0) {
        throw new Error('At least one initial payment must be provided.');
      }
      if (parseInt(numPax) <= 0) {
          throw new Error('Number of passengers must be a positive integer.');
      }

      const parsedRevenue = parseFloat(revenue || 0);
      if (isNaN(parsedRevenue)) throw new Error('Invalid revenue amount.');

      // --- 2. Pre-process and Validate Credit Notes (Optimized) ---
      const creditNoteUsageMap = new Map(); // Map: creditNoteId -> [{ amountToUse, supplier, costItemSupplierIndex, itemIndex, supplierIndex }]
      const allCreditNoteIds = new Set();

      (prodCostBreakdown || []).forEach((item, itemIdx) => {
        (item.suppliers || []).forEach((s, supplierIdx) => {
          if (s.paymentMethod.includes('CREDIT_NOTES')) {
            const amountToCoverByNotes = (s.paymentMethod === 'CREDIT_NOTES')
              ? (parseFloat(s.firstMethodAmount) || 0)
              : (parseFloat(s.secondMethodAmount) || 0);
            
            let totalAppliedFromNotes = 0;
            (s.selectedCreditNotes || []).forEach(usedNote => {
              const parsedAmountToUse = parseFloat(usedNote.amountToUse || 0);
              if (isNaN(parsedAmountToUse) || parsedAmountToUse <= 0) {
                throw new Error(`Invalid credit note usage amount for Credit Note ID ${usedNote.id}.`);
              }
              totalAppliedFromNotes += parsedAmountToUse;
              allCreditNoteIds.add(usedNote.id);

              if (!creditNoteUsageMap.has(usedNote.id)) {
                  creditNoteUsageMap.set(usedNote.id, []);
              }
              creditNoteUsageMap.get(usedNote.id).push({
                  amountToUse: parsedAmountToUse,
                  supplier: s.supplier,
                  itemIndex: itemIdx,
                  supplierIndex: supplierIdx
              });
            });

            if (Math.abs(totalAppliedFromNotes - amountToCoverByNotes) > 0.01) {
              throw new Error(`For supplier ${s.supplier}, the applied credit notes total (£${totalAppliedFromNotes.toFixed(2)}) does not match the required amount (£${amountToCoverByNotes.toFixed(2)}).`);
            }
          }
        });
      });

      // Fetch all unique credit notes in one go for validation
      const existingCreditNotes = await tx.supplierCreditNote.findMany({
        where: { id: { in: Array.from(allCreditNoteIds) } },
      });
      const creditNoteLookup = new Map(existingCreditNotes.map(cn => [cn.id, cn]));

      // Final validation of credit notes against fetched data
      for (const [cnId, usages] of creditNoteUsageMap.entries()) {
        const creditNote = creditNoteLookup.get(cnId);
        if (!creditNote) throw new Error(`Credit Note with ID ${cnId} not found.`);

        let totalUsedForThisCN = 0;
        for (const usage of usages) {
          if (creditNote.supplier !== usage.supplier) {
            throw new Error(`Credit Note ID ${cnId} does not belong to supplier ${usage.supplier}.`);
          }
          totalUsedForThisCN += usage.amountToUse;
        }

        if (creditNote.remainingAmount < totalUsedForThisCN) {
          throw new Error(`Credit Note ID ${cnId} has insufficient funds. Remaining: £${creditNote.remainingAmount.toFixed(2)}, Attempted to use: £${totalUsedForThisCN.toFixed(2)}.`);
        }
      }

      // --- 3. Calculate financial summaries ---
      const calculatedProdCost = (prodCostBreakdown || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      const calculatedReceived = (initialPayments || []).reduce((sum, payment) => sum + parseFloat(payment.amount || 0), 0);
      const parsedTransFee = parseFloat(transFee || 0);
      const parsedSurcharge = parseFloat(surcharge || 0);
      const profit = parsedRevenue - calculatedProdCost - parsedTransFee - parsedSurcharge;
      const balance = parsedRevenue - calculatedReceived;

      // --- 4. Create PendingBooking and its relations ---
      const newPendingBooking = await tx.pendingBooking.create({
        data: {
          createdById: userId,
          refNo: ref_no,
          paxName: pax_name,
          agentName: agent_name,
          teamName: team_name,
          pnr: pnr,
          airline: airline,
          fromTo: from_to,
          bookingType: bookingType,
          bookingStatus: 'PENDING', // Initial status for pending
          pcDate: new Date(pcDate),
          issuedDate: issuedDate ? new Date(issuedDate) : null,
          paymentMethod: paymentMethod,
          // lastPaymentDate will be updated when initialPayments are created below.
          lastPaymentDate: (initialPayments && initialPayments.length > 0) 
                           ? new Date(initialPayments[initialPayments.length - 1].receivedDate) 
                           : null,
          travelDate: travelDate ? new Date(travelDate) : null,
          revenue: parsedRevenue,
          prodCost: calculatedProdCost,
          transFee: parsedTransFee,
          surcharge: parsedSurcharge,
          balance: balance,
          profit: profit,
          invoiced: invoiced || null,
          description: description || null,
          status: 'PENDING', // PendingBooking's own status
          numPax: parseInt(numPax),
          
          initialPayments: {
            create: (initialPayments || []).map(p => ({
              amount: parseFloat(p.amount),
              transactionMethod: p.transactionMethod,
              paymentDate: new Date(p.receivedDate),
            })),
          },
          costItems: {
            create: (prodCostBreakdown || []).map((item) => ({
              category: item.category,
              amount: parseFloat(item.amount),
              suppliers: {
                create: (item.suppliers || []).map((s) => ({
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
            create: (instalments || []).map(inst => ({ 
              dueDate: new Date(inst.dueDate), 
              amount: parseFloat(inst.amount), 
              status: inst.status || 'PENDING' 
            })) 
          },
          passengers: { 
            create: (passengers || []).map(pax => ({ 
              ...pax, 
              // Ensure birthday is always a Date object or null
              birthday: pax.birthday ? new Date(pax.birthday) : null 
            })) 
          },
        },
        // Include costItems with suppliers to link credit note usage later
        include: { costItems: { include: { suppliers: true } } } 
      });

      // --- 5. Apply Credit Note Usages and Update Credit Notes ---
      for (const [itemIndex, item] of (prodCostBreakdown || []).entries()) {
        for (const [supplierIndex, s] of (item.suppliers || []).entries()) {
          if (s.paymentMethod.includes('CREDIT_NOTES')) {
            const createdCostItemSupplier = newPendingBooking.costItems[itemIndex].suppliers[supplierIndex];
            
            for (const usedNote of (s.selectedCreditNotes || [])) {
              // Now we can use the pre-fetched creditNoteLookup for the current state
              const creditNoteToUpdate = creditNoteLookup.get(usedNote.id); 
              const amountToUse = parseFloat(usedNote.amountToUse);
              const newRemainingAmount = creditNoteToUpdate.remainingAmount - amountToUse;

              await tx.supplierCreditNote.update({
                where: { id: usedNote.id },
                data: {
                  remainingAmount: newRemainingAmount,
                  status: newRemainingAmount < 0.01 ? 'USED' : 'PARTIALLY_USED',
                },
              });

              await tx.creditNoteUsage.create({
                data: {
                  amountUsed: amountToUse,
                  creditNoteId: usedNote.id,
                  usedOnCostItemSupplierId: createdCostItemSupplier.id,
                }
              });
            }
          }
        }
      }

      // --- 6. Create Audit Log ---
      await createAuditLog(tx, {
        userId: userId,
        modelName: 'PendingBooking',
        recordId: newPendingBooking.id,
        action: ActionType.CREATE_PENDING,
      });

      // --- 7. Fetch and return the complete PendingBooking object ---
      // This ensures the frontend gets a fully populated object, matching typical 'findUnique' includes.
      return tx.pendingBooking.findUnique({
          where: { id: newPendingBooking.id },
          include: { 
            costItems: { include: { suppliers: true } }, 
            instalments: true, 
            passengers: true,
            initialPayments: true
          }
      });
    }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, pendingBookingResult, 201);
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
        initialPayments: true, // <-- Added initialPayments for completeness, if frontend uses it
      },
      orderBy: { // Good practice to have a default order for list views
        createdAt: 'desc',
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
    return apiResponse.error(res, 'Invalid pending booking ID', 400);
  }

  const { id: approverId } = req.user;

  try {
    const approvedBookingResult = await prisma.$transaction(async (tx) => {
      // 1. Fetch the complete pending booking with all its relations
      const pendingBooking = await tx.pendingBooking.findUnique({
        where: { id: bookingId },
        include: {
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
          createdBy: true,
          initialPayments: true,
        },
      });

      if (!pendingBooking) {
        throw new Error('Pending booking not found');
      }
      if (pendingBooking.status !== 'PENDING') {
        throw new Error(`Pending booking already processed with status: ${pendingBooking.status}`);
      }

      // 2. Generate a new unique folder number for the approved booking
      // NOTE: This approach fetches all folder numbers. For very large datasets,
      // consider a sequence in the database or a more optimized approach if this becomes a bottleneck.
      const allBookings = await tx.booking.findMany({
        select: { folderNo: true },
      });
      const maxFolderNo = allBookings.reduce((max, b) => {
          const folderNum = parseInt(b.folderNo.split('.')[0], 10);
          return isNaN(folderNum) ? max : Math.max(max, folderNum);
      }, 0);
      const newFolderNo = String(maxFolderNo + 1);

      // 3. Create the new Booking by copying data from the pending booking
      const newBooking = await tx.booking.create({
        data: {
          originalBookingId: pendingBooking.originalBookingId, // Ensure this is also copied if present
          folderNo: newFolderNo,
          refNo: pendingBooking.refNo,
          paxName: pendingBooking.paxName,
          agentName: pendingBooking.agentName,
          teamName: pendingBooking.teamName || null,
          pnr: pendingBooking.pnr,
          airline: pendingBooking.airline,
          fromTo: pendingBooking.fromTo,
          bookingType: pendingBooking.bookingType,
          bookingStatus: 'CONFIRMED', // Set to confirmed
          pcDate: pendingBooking.pcDate,
          issuedDate: pendingBooking.issuedDate,
          paymentMethod: pendingBooking.paymentMethod,
          lastPaymentDate: pendingBooking.lastPaymentDate,
          travelDate: pendingBooking.travelDate,
          // Financials are copied directly, ensuring they are numbers or null
          revenue: pendingBooking.revenue, 
          prodCost: pendingBooking.prodCost,
          transFee: pendingBooking.transFee,
          surcharge: pendingBooking.surcharge,
          balance: pendingBooking.balance,
          profit: pendingBooking.profit,
          invoiced: pendingBooking.invoiced || null,
          description: pendingBooking.description || null,
          numPax: pendingBooking.numPax,
          
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
              amount: item.amount, // Already a float from createPendingBooking
            })),
          },
          instalments: {
            create: pendingBooking.instalments.map((inst) => ({
              dueDate: new Date(inst.dueDate),
              amount: inst.amount, // Already a float
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
        // Include costItems to get their newly generated IDs for supplier migration
        include: {
            costItems: true,
        }
      });

      // 4. Migrate CostItemSuppliers from pendingCostItemId to costItemId
      // Iterate through the original pendingBooking's cost items to find their suppliers
      for (const [index, pendingItem] of pendingBooking.costItems.entries()) {
        // Find the corresponding new cost item created in the approved booking
        const newCostItem = newBooking.costItems.find(ci => ci.category === pendingItem.category && ci.amount === pendingItem.amount);
        
        if (!newCostItem) {
            console.warn(`Could not find newly created CostItem for pendingItem ID ${pendingItem.id}. Skipping supplier migration for this item.`);
            continue;
        }

        // For each supplier attached to the pending cost item
        for (const supplier of pendingItem.suppliers) {
          // Update the existing CostItemSupplier record
          await tx.costItemSupplier.update({
            where: { id: supplier.id }, // Target the specific CostItemSupplier record
            data: {
              costItemId: newCostItem.id, // Link to the new CostItem
              pendingCostItemId: null, // Clear the pending link
            },
          });
        }
      }

      // 5. Update the PendingBooking status to 'APPROVED'
      await tx.pendingBooking.update({
        where: { id: bookingId },
        data: { status: 'APPROVED' },
      });

      // 6. Create Audit Logs
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
        userId: pendingBooking.createdById, // Logged as created by the original submitter
        modelName: 'Booking',
        recordId: newBooking.id,
        action: ActionType.CREATE,
        // Optional: Add more details about the approval process here if needed
      });

      // 7. Fetch and return the complete newly created Booking object
      return tx.booking.findUnique({
          where: { id: newBooking.id },
          include: {
              costItems: { include: { suppliers: true } },
              instalments: true,
              passengers: true,
              initialPayments: true
          }
      });
    }, {
        timeout: 20000 // <--- INCREASED TIMEOUT HERE TO 20 SECONDS
    }); // End of prisma.$transaction

    return apiResponse.success(res, approvedBookingResult, 200);

  } catch (error) {
    console.error('Error approving booking:', error);
    if (error.message.includes('not found')) { // Catches 'Pending booking not found'
        return apiResponse.error(res, error.message, 404);
    }
    if (error.message.includes('already processed')) {
        return apiResponse.error(res, error.message, 409);
    }
    if (error.code === 'P2002') { // Unique constraint violation
      return apiResponse.error(res, 'A booking with this unique identifier (e.g., folder number) already exists.', 409);
    }
    return apiResponse.error(res, `Failed to approve booking: ${error.message}`, 500);
  }
};


const rejectBooking = async (req, res) => {
  // Get the ID of the user performing the rejection.
  const { id: userId } = req.user;
  const { id } = req.params; // This is the PendingBooking ID

  try {
    const updatedBooking = await prisma.$transaction(async (tx) => {
      const pendingBooking = await tx.pendingBooking.findUnique({
        where: { id: parseInt(id) },
      });

      if (!pendingBooking) {
        throw new Error("Pending booking not found");
      }
      if (pendingBooking.status !== 'PENDING') {
        throw new Error(`Pending booking already processed with status: ${pendingBooking.status}`);
      }
      
      // Audit Log for status change
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

      // Update the status to 'REJECTED'
      const rejectedBooking = await tx.pendingBooking.update({
        where: { id: parseInt(id) },
        data: {
          status: 'REJECTED'
        },
      });

      return rejectedBooking;
    }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, { message: "Booking rejected successfully", data: updatedBooking }, 200);

  } catch (error) {
    console.error("Error rejecting booking:", error);
    if (error.message.includes('not found')) { // Catches 'Pending booking not found'
      return apiResponse.error(res, error.message, 404);
    }
    if (error.message.includes('already processed')) {
      return apiResponse.error(res, error.message, 409);
    }
    return apiResponse.error(res, `Failed to reject booking: ${error.message}`, 500);
  }
};

const createBooking = async (req, res) => {
  const { id: userId } = req.user;

  try {
    const {
      ref_no, pax_name, agent_name, team_name, pnr, airline, from_to, bookingType,
      paymentMethod, pcDate, issuedDate, travelDate, description, revenue, transFee,
      surcharge, invoiced, numPax, initialPayments, prodCostBreakdown, instalments, passengers,
      bookingStatus // Allow overriding default status if provided, e.g., for direct confirmed bookings
    } = req.body;

    // --- 1. Initial Validation ---
    const requiredFields = [ 'ref_no', 'pax_name', 'agent_name', 'pnr', 'airline', 'from_to', 'bookingType', 'paymentMethod', 'pcDate', 'travelDate', 'numPax' ];
    const missingFields = requiredFields.filter(field => !req.body[field] && req.body[field] !== 0); // Check for 0 as valid value
    if (missingFields.length > 0) {
      return apiResponse.error(res, `Missing required fields: ${missingFields.join(', ')}`, 400);
    }
    
    // Validate initial payments
    if (!initialPayments || initialPayments.length === 0) {
      return apiResponse.error(res, "At least one initial payment must be provided.", 400);
    }
    for (const payment of initialPayments) {
      if (isNaN(parseFloat(payment.amount)) || parseFloat(payment.amount) <= 0 || !payment.transactionMethod || !payment.receivedDate) {
        return apiResponse.error(res, "Invalid initial payment details (amount, method, or date).", 400);
      }
    }

    // Validate number fields
    const parsedRevenue = parseFloat(revenue || 0);
    if (isNaN(parsedRevenue)) return apiResponse.error(res, "Invalid revenue amount.", 400);
    const parsedProdCost = (prodCostBreakdown || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
    if (isNaN(parsedProdCost)) return apiResponse.error(res, "Invalid production cost amount.", 400);
    const parsedTransFee = parseFloat(transFee || 0);
    if (isNaN(parsedTransFee)) return apiResponse.error(res, "Invalid transaction fee amount.", 400);
    const parsedSurcharge = parseFloat(surcharge || 0);
    if (isNaN(parsedSurcharge)) return apiResponse.error(res, "Invalid surcharge amount.", 400);
    const parsedNumPax = parseInt(numPax);
    if (isNaN(parsedNumPax) || parsedNumPax <= 0) return apiResponse.error(res, "Number of passengers must be a positive integer.", 400);


    const booking = await prisma.$transaction(async (tx) => {
      // 2. Generate a new unique folder number for the new booking
      const allBookings = await tx.booking.findMany({
        select: { folderNo: true },
      });
      const maxFolderNo = allBookings.reduce((max, b) => {
          const folderNum = parseInt(b.folderNo.split('.')[0], 10);
          return isNaN(folderNum) ? max : Math.max(max, folderNum);
      }, 0);
      const newFolderNo = String(maxFolderNo + 1);

      // 3. Calculate financial summaries
      const calculatedReceived = initialPayments.reduce((sum, p) => sum + parseFloat(p.amount), 0);
      const profit = parsedRevenue - parsedProdCost - parsedTransFee - parsedSurcharge;
      const balance = parsedRevenue - calculatedReceived;

      // Determine lastPaymentDate from initialPayments
      const sortedInitialPayments = [...initialPayments].sort((a, b) => new Date(a.receivedDate) - new Date(b.receivedDate));
      const latestPaymentDate = sortedInitialPayments.length > 0 
                                ? new Date(sortedInitialPayments[sortedInitialPayments.length - 1].receivedDate) 
                                : null;


      // 4. Create the new Booking and its relations
      const newBooking = await tx.booking.create({
        data: {
          folderNo: newFolderNo, // Generated folder number
          refNo: ref_no,
          paxName: pax_name,
          agentName: agent_name,
          teamName: teamName || null,
          pnr: pnr,
          airline: airline,
          fromTo: from_to,
          bookingType: bookingType,
          bookingStatus: bookingStatus || 'PENDING', // Use provided status or default to PENDING
          pcDate: new Date(pcDate),
          issuedDate: issuedDate ? new Date(issuedDate) : null, // Make optional as per schema
          paymentMethod: paymentMethod,
          lastPaymentDate: latestPaymentDate, // Set from initial payments
          travelDate: new Date(travelDate),
          description: description || null,
          revenue: parsedRevenue,
          prodCost: parsedProdCost,
          transFee: parsedTransFee,
          surcharge: parsedSurcharge,
          profit: profit,
          balance: balance,
          invoiced: invoiced || null,
          numPax: parsedNumPax,

          initialPayments: {
            create: initialPayments.map(p => ({
              amount: parseFloat(p.amount),
              transactionMethod: p.transactionMethod,
              paymentDate: new Date(p.receivedDate),
            })),
          },

          costItems: {
            create: (prodCostBreakdown || []).map(item => ({
              category: item.category, 
              amount: parseFloat(item.amount),
              suppliers: { 
                create: (item.suppliers || []).map(s => ({ 
                  supplier: s.supplier,
                  amount: parseFloat(s.amount),
                  paymentMethod: s.paymentMethod,
                  paidAmount: parseFloat(s.paidAmount) || 0,
                  pendingAmount: parseFloat(s.pendingAmount) || 0,
                  transactionMethod: s.transactionMethod,
                  firstMethodAmount: s.firstMethodAmount ? parseFloat(s.firstMethodAmount) : null,
                  secondMethodAmount: s.secondMethodAmount ? parseFloat(s.secondMethodAmount) : null,
                })) 
              },
            })),
          },
          instalments: {
            create: (instalments || []).map(inst => ({
              dueDate: new Date(inst.dueDate), 
              amount: parseFloat(inst.amount),
              status: inst.status || 'PENDING',
            })),
          },
          passengers: {
            create: (passengers || []).map(pax => ({
              ...pax, 
              birthday: pax.birthday ? new Date(pax.birthday) : null,
            })),
          },
        },
        include: { // Include relations for the response
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
          initialPayments: true,
        },
      });

      // 5. Create Audit Log
      await createAuditLog(tx, {
        userId: userId,
        modelName: 'Booking',
        recordId: newBooking.id,
        action: ActionType.CREATE,
      });

      return newBooking;
    }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, booking, 201);
  } catch (error) {
    console.error("Booking creation error:", error);
    if (error.message.includes('Missing required fields')) {
      return apiResponse.error(res, error.message, 400);
    }
    if (error.code === 'P2002') {
      // Catch specific unique constraint violations more gracefully
      if (error.meta?.target?.includes('folder_no')) {
        return apiResponse.error(res, "A booking with this folder number already exists (try again).", 409);
      }
      if (error.meta?.target?.includes('ref_no')) {
        return apiResponse.error(res, "A booking with this reference number already exists.", 409);
      }
      return apiResponse.error(res, "A booking with a similar unique identifier already exists.", 409);
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
  const bookingId = parseInt(req.params.id);

  if (isNaN(bookingId)) {
    return apiResponse.error(res, 'Invalid booking ID', 400);
  }

  const updates = req.body;

  try {
    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT', 'BANK_TRANSFER']; // Added BANK_TRANSFER from schema
    if (updates.transactionMethod && !validTransactionMethods.includes(updates.transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }
    // Add more validation for specific update fields if necessary
    if (updates.numPax !== undefined && (isNaN(parseInt(updates.numPax)) || parseInt(updates.numPax) <= 0)) {
        return apiResponse.error(res, 'Number of passengers must be a positive integer.', 400);
    }

    const updatedBookingResult = await prisma.$transaction(async (tx) => {
      // 1. Fetch the current state of the booking with all relations needed for financial recalculation and audit logging
      const bookingToUpdate = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          initialPayments: true,
          instalments: { include: { payments: true } },
          customerPayables: { include: { settlements: true } }, // Needed for full received calculation
          costItems: { include: { suppliers: true } }, // For audit log or future diffing
          passengers: true, // For audit log or future diffing
        }
      });

      if (!bookingToUpdate) {
        throw new Error("Booking not found");
      }

      // Store old record for audit logging
      const oldRecordForAudit = { ...bookingToUpdate }; // Shallow copy, deep copy for nested if compareAndLogChanges requires

      // 2. Prepare financial values, prioritizing updates from request body
      const currentRevenue = bookingToUpdate.revenue || 0;
      const currentProdCost = bookingToUpdate.prodCost || 0;
      const currentTransFee = bookingToUpdate.transFee || 0;
      const currentSurcharge = bookingToUpdate.surcharge || 0;

      const newRevenue = updates.revenue !== undefined ? parseFloat(updates.revenue) : currentRevenue;
      if (isNaN(newRevenue)) throw new Error('Invalid revenue amount.');

      const newProdCost = updates.prodCost !== undefined ? parseFloat(updates.prodCost) : currentProdCost;
      if (isNaN(newProdCost)) throw new Error('Invalid production cost amount.');

      const newTransFee = updates.transFee !== undefined ? parseFloat(updates.transFee) : currentTransFee;
      if (isNaN(newTransFee)) throw new Error('Invalid transaction fee amount.');

      const newSurcharge = updates.surcharge !== undefined ? parseFloat(updates.surcharge) : currentSurcharge;
      if (isNaN(newSurcharge)) throw new Error('Invalid surcharge amount.');
      
      // 3. Recalculate Total Received (comprehensive)
      let sumOfInitialPayments = 0;
      let latestPaymentDate = bookingToUpdate.lastPaymentDate; // Start with current last payment date

      if (Array.isArray(updates.initialPayments)) {
        // If initialPayments are being updated/replaced, calculate from the new array
        sumOfInitialPayments = updates.initialPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        // Determine the latest payment date from the new initial payments
        const dates = updates.initialPayments.map(p => new Date(p.paymentDate || p.receivedDate));
        if (dates.length > 0) {
            latestPaymentDate = new Date(Math.max(...dates));
        }
      } else {
        // Otherwise, use existing initial payments from the database
        sumOfInitialPayments = bookingToUpdate.initialPayments.reduce((sum, p) => sum + p.amount, 0);
      }

      // Sum of all instalment payments (existing ones + any new ones, although instalments are fully replaced)
      // This is crucial for a consistent "total received" value
      const totalPaidViaInstalments = (updates.instalments || bookingToUpdate.instalments || []).reduce((instSum, inst) => {
          if (Array.isArray(updates.instalments)) { // If instalments are updated, they won't have 'payments' relation here
              return instSum; // Assume payments are handled separately or come later
          } else { // Use existing payments from DB
              return instSum + inst.payments.reduce((paySum, p) => paySum + p.amount, 0);
          }
      }, 0);

      // Sum of all customer payable settlements
      const sumOfPayableSettlements = (bookingToUpdate.customerPayables || []).reduce((sum, payable) => 
          sum + (payable.settlements || []).reduce((sSum, s) => sSum + s.amount, 0), 0);
      
      const newTotalReceived = sumOfInitialPayments + totalPaidViaInstalments + sumOfPayableSettlements;

      // 4. Recalculate Profit and Balance
      const newProfit = newRevenue - newProdCost - newTransFee - newSurcharge;
      const newBalance = newRevenue - newTotalReceived;

      // 5. Construct the data object for the update, applying changes only if provided
      const dataForUpdate = {};

      if (refNo !== undefined) dataForUpdate.refNo = refNo;
      if (paxName !== undefined) dataForUpdate.paxName = paxName;
      if (agentName !== undefined) dataForUpdate.agentName = agentName;
      if (teamName !== undefined) dataForUpdate.teamName = teamName;
      if (pnr !== undefined) dataForUpdate.pnr = pnr;
      if (airline !== undefined) dataForUpdate.airline = airline;
      if (fromTo !== undefined) dataForUpdate.fromTo = fromTo;
      if (bookingType !== undefined) dataForUpdate.bookingType = bookingType;
      if (bookingStatus !== undefined) dataForUpdate.bookingStatus = bookingStatus;
      if (pcDate !== undefined) dataForUpdate.pcDate = new Date(pcDate);
      if (issuedDate !== undefined) dataForUpdate.issuedDate = issuedDate ? new Date(issuedDate) : null;
      if (paymentMethod !== undefined) dataForUpdate.paymentMethod = paymentMethod;
      if (travelDate !== undefined) dataForUpdate.travelDate = new Date(travelDate);
      if (invoiced !== undefined) dataForUpdate.invoiced = invoiced;
      if (description !== undefined) dataForUpdate.description = description;
      if (updates.numPax !== undefined) dataForUpdate.numPax = parseInt(updates.numPax);

      // Apply calculated financials
      dataForUpdate.revenue = newRevenue;
      dataForUpdate.prodCost = newProdCost;
      dataForUpdate.transFee = newTransFee;
      dataForUpdate.surcharge = newSurcharge;
      dataForUpdate.profit = newProfit;
      dataForUpdate.balance = newBalance;
      if (latestPaymentDate) dataForUpdate.lastPaymentDate = latestPaymentDate;


      // Handle nested relations (deleteMany then create)
      if (Array.isArray(initialPayments)) {
        dataForUpdate.initialPayments = {
          deleteMany: {}, // Delete all old payments
          create: initialPayments.map(p => ({ // Recreate with new data
            amount: parseFloat(p.amount),
            transactionMethod: p.transactionMethod,
            paymentDate: new Date(p.receivedDate || p.paymentDate), // Support both names
          })),
        };
      }

      if (Array.isArray(costItems)) {
        dataForUpdate.costItems = {
          deleteMany: {},
          create: costItems.map(item => ({
            category: item.category,
            amount: parseFloat(item.amount),
            suppliers: {
              create: (item.suppliers || []).map(s => ({
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
        };
      }

      if (Array.isArray(instalments)) {
        dataForUpdate.instalments = {
          deleteMany: {},
          create: instalments.map(inst => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        };
      }

      if (Array.isArray(passengers)) {
        dataForUpdate.passengers = {
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
        };
      }

      // 6. Perform the update
      const finalBooking = await tx.booking.update({
        where: { id: bookingId },
        data: dataForUpdate,
        include: {
          costItems: { include: { suppliers: true } },
          instalments: { include: { payments: true } }, // Include payments for full data
          passengers: true,
          initialPayments: true,
          customerPayables: { include: { settlements: true } }, // For full response object
          cancellation: true, // For full response object
        },
      });

      // 7. Audit Log changes
      // Ensure your compareAndLogChanges function can handle deep comparisons if needed,
      // or that the changes object passed is sufficient.
      await compareAndLogChanges(tx, {
        modelName: 'Booking',
        recordId: finalBooking.id,
        userId,
        oldRecord: oldRecordForAudit, // The state before the update
        newRecord: finalBooking,     // The state after the update
        updates,                     // The raw updates from the request body
      });

      return finalBooking;
    }, {
        timeout: 15000 // Increased transaction timeout to 15 seconds due to multiple nested updates
    }); // End of prisma.$transaction

    return apiResponse.success(res, updatedBookingResult, 200);

  } catch (error) {
    console.error('Error updating booking:', error);
    if (error.message.includes("Booking not found")) {
      return apiResponse.error(res, error.message, 404);
    }
    if (error.message.includes('Invalid')) { // Catches various "Invalid X amount/type" errors
        return apiResponse.error(res, error.message, 400);
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
        paymentMethod: {
          in: ['INTERNAL', 'INTERNAL_HUMM', 'FULL', 'HUMM', 'FULL_HUMM'],
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
        paymentMethod: true,
        initialDeposit: true,
        initialPayments: {
          select: {
            amount: true,
            transactionMethod: true,
            paymentDate: true,
            createdAt: true, // Include createdAt for sorting if paymentDate is the same
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
                createdAt: true, // Include createdAt for sorting if paymentDate is the same
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
                refundDate: true,
                createdAt: true, // Include createdAt for sorting if refundDate is the same
              }
            },
            refundStatus: true,
            createdCustomerPayable: {
              include: {
                settlements: { // Include settlements directly here
                  select: {
                    id: true,
                    amount: true,
                    transactionMethod: true,
                    paymentDate: true,
                    createdAt: true, // Include createdAt for sorting if paymentDate is the same
                  }
                }
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

      // --- Payment History for Pop-up ---
      const paymentHistory = [];

      // Add each initial payment to the history
      (booking.initialPayments || []).forEach(payment => {
        paymentHistory.push({
          type: 'Initial Deposit', // More descriptive
          date: payment.paymentDate,
          amount: parseFloat(payment.amount),
          method: payment.transactionMethod,
          recordedAt: payment.createdAt,
        });
      });

      // Add each instalment payment to the history
      (booking.instalments || []).forEach(instalment => {
        (instalment.payments || []).forEach(payment => {
          paymentHistory.push({
            type: instalment.status === 'SETTLEMENT' ? 'Final Settlement Payment' : `Instalment Payment (${instalment.id})`, // Differentiate settlement payments
            date: payment.paymentDate,
            amount: parseFloat(payment.amount),
            method: payment.transactionMethod,
            recordedAt: payment.createdAt,
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
            recordedAt: cancellation.refundPayment.createdAt,
          });
        }

        // Adjust balance based on cancellation financial outcome
        if (customerPayable && customerPayable.pendingAmount > 0) {
            currentBalance = parseFloat(customerPayable.pendingAmount);
        } else if (customerPayable && customerPayable.pendingAmount <= 0.01) {
            currentBalance = 0;
        } else if (refundToPassenger > 0 && cancellation.refundStatus === 'PENDING') {
            currentBalance = -refundToPassenger;
        } else if (refundToPassenger > 0 && cancellation.refundStatus === 'PAID') {
            currentBalance = 0;
        } else {
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
              method: settlement.transactionMethod,
              recordedAt: settlement.createdAt,
            });
          });
        }
      }
      
      // Sort payment history by date, then by recordedAt for consistent order if dates are identical
      paymentHistory.sort((a, b) => {
        const dateComparison = new Date(a.date).getTime() - new Date(b.date).getTime();
        if (dateComparison === 0 && a.recordedAt && b.recordedAt) {
            return new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime();
        }
        return dateComparison;
      });
      
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
    const parsedAmount = parseFloat(amount);

    // 1. Initial Validation
    if (!costItemSupplierId || isNaN(parsedAmount) || parsedAmount <= 0 || !transactionMethod || !settlementDate) {
      return apiResponse.error(res, 'Missing or invalid required fields: costItemSupplierId, amount, transactionMethod, settlementDate', 400);
    }

    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT', 'BANK_TRANSFER'];
    if (!validTransactionMethods.includes(transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }

    if (isNaN(new Date(settlementDate).getTime())) {
      return apiResponse.error(res, 'Invalid settlementDate', 400);
    }

    const { newSettlement, updatedCostItemSupplier, updatedBooking } = await prisma.$transaction(async (tx) => {
      // 2. Fetch the CostItemSupplier and its full chain to the Booking for comprehensive recalculation and logging
      const costItemSupplier = await tx.costItemSupplier.findUnique({
        where: { id: parseInt(costItemSupplierId) },
        include: {
          costItem: {
            include: {
              booking: { // Include the parent booking and its related financial components
                include: {
                    initialPayments: true,
                    instalments: { include: { payments: true } },
                    customerPayables: { include: { settlements: true } },
                    costItems: { include: { suppliers: { include: { settlements: true } } } }, // Deep include for all supplier settlements
                }
              }
            }
          }
        }
      });

      if (!costItemSupplier) {
        throw new Error('CostItemSupplier not found');
      }
      if (!costItemSupplier.costItem?.booking) {
        throw new Error('Could not find the parent booking for this cost item.');
      }

      const currentBooking = costItemSupplier.costItem.booking;
      // Ensure pendingAmount is always a number for comparison
      const pendingAmount = parseFloat(costItemSupplier.pendingAmount ?? 0) || 0; 

      if (parsedAmount > pendingAmount + 0.01) {
        throw new Error(`Settlement amount (£${parsedAmount.toFixed(2)}) exceeds pending amount (£${pendingAmount.toFixed(2)})`);
      }

      // 3. Create the new settlement record
      const createdSettlement = await tx.supplierPaymentSettlement.create({
        data: {
          costItemSupplierId: parseInt(costItemSupplierId),
          amount: parsedAmount,
          transactionMethod,
          settlementDate: new Date(settlementDate),
        },
      });

      // 4. Update CostItemSupplier paidAmount and pendingAmount
      // Ensure old paidAmount is treated as 0 if null
      const newPaidAmountForSupplier = (parseFloat(costItemSupplier.paidAmount ?? 0) || 0) + parsedAmount;
      const newPendingAmountForSupplier = pendingAmount - parsedAmount;

      const finalUpdatedSupplier = await tx.costItemSupplier.update({
        where: { id: parseInt(costItemSupplierId) },
        data: {
          paidAmount: newPaidAmountForSupplier,
          pendingAmount: newPendingAmountForSupplier,
        },
        include: { settlements: true },
      });

      // 5. Recalculate Booking's comprehensive financial state
      // --- Sum of all payments received from customer ---
      const sumOfInitialPayments = (currentBooking.initialPayments || []).reduce((sum, p) => sum + p.amount, 0);
      const sumOfInstalmentPayments = (currentBooking.instalments || []).reduce((sum, inst) => 
          sum + (inst.payments || []).reduce((pSum, p) => pSum + p.amount, 0), 0);
      const sumOfCustomerPayableSettlements = (currentBooking.customerPayables || []).reduce((sum, payable) => 
          sum + (payable.settlements || []).reduce((sSum, s) => sSum + s.amount, 0), 0);
      
      const totalReceivedFromCustomer = sumOfInitialPayments + sumOfInstalmentPayments + sumOfCustomerPayableSettlements;

      // --- Sum of all payments made to suppliers ---
      // Ensure all amounts are treated as numbers (0 if null) before summing
      const totalPaidToSuppliers = (currentBooking.costItems || []).reduce((ciSum, costItem) => 
          ciSum + (costItem.suppliers || []).reduce((sSum, supplier) => 
              sSum + (supplier.settlements || []).reduce((setSum, settlement) => setSum + settlement.amount, 0), 0), 0);
      
      // Calculate derived fields (profit, balance) based on the latest figures
      const newRevenue = currentBooking.revenue ?? 0; // Ensure revenue is a number
      const newTransFee = currentBooking.transFee ?? 0; // Ensure transFee is a number
      const newSurcharge = currentBooking.surcharge ?? 0; // Ensure surcharge is a number

      const newProfit = newRevenue - totalPaidToSuppliers - newTransFee - newSurcharge;
      const newBalance = newRevenue - totalReceivedFromCustomer;

      // Store old booking balance and profit for audit log, ensuring they are numbers or 'N/A'
      const oldBookingBalance = currentBooking.balance ?? 0;
      const oldBookingProfit = currentBooking.profit ?? 0;

      // 6. Update the main Booking record with new financials
      const updatedBookingRecord = await tx.booking.update({
          where: { id: currentBooking.id },
          data: {
              balance: newBalance,
              profit: newProfit,
              lastPaymentDate: new Date(settlementDate), // Consider if this should be last customer or last overall payment
          }
      });

      // 7. Create Audit Logs
      await createAuditLog(tx, {
          userId,
          modelName: 'CostItemSupplier',
          recordId: costItemSupplier.id,
          action: ActionType.SETTLEMENT_PAYMENT,
          changes: [{
            fieldName: 'supplierPaid',
            // FIX: Use nullish coalescing operator for costItemSupplier.paidAmount before toFixed()
            oldValue: `Paid: ${(costItemSupplier.paidAmount ?? 0).toFixed(2)}`, 
            newValue: `Paid: ${newPaidAmountForSupplier.toFixed(2)} (Settlement of £${parsedAmount.toFixed(2)} via ${transactionMethod})`
          },
          {
            fieldName: 'pendingAmount',
            // pendingAmount is already ensured as a number above, so this is safe
            oldValue: `Pending: ${pendingAmount.toFixed(2)}`, 
            newValue: `Pending: ${newPendingAmountForSupplier.toFixed(2)}`
          }]
      });

      await createAuditLog(tx, {
          userId,
          modelName: 'Booking',
          recordId: currentBooking.id,
          action: ActionType.SETTLEMENT_PAYMENT,
          changes: [
              {
                fieldName: 'balance',
                oldValue: oldBookingBalance.toFixed(2), // Now oldBookingBalance is guaranteed a number
                newValue: newBalance.toFixed(2)
              },
              {
                fieldName: 'profit',
                oldValue: oldBookingProfit.toFixed(2), // Now oldBookingProfit is guaranteed a number
                newValue: newProfit.toFixed(2)
              }
          ]
      });

      return { newSettlement: createdSettlement, updatedCostItemSupplier: finalUpdatedSupplier, updatedBooking: updatedBookingRecord };
    }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, { newSettlement, updatedCostItemSupplier, updatedBooking }, 201);
  } catch (error) {
    console.error('Error creating supplier payment settlement:', error);
    if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
    if (error.message.includes('exceeds pending amount')) return apiResponse.error(res, error.message, 400);
    if (error.message.includes('Invalid')) return apiResponse.error(res, error.message, 400);
    if (error.name === 'PrismaClientValidationError') return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
    return apiResponse.error(res, `Failed to create supplier payment settlement: ${error.message}`, 500);
  }
};

const getSuppliersInfo = async (req, res) => {
    try {
        // --- 1. Fetch all individual CostItemSupplier records for detailed transactions ---
        // This includes all necessary details for the SettlePaymentPopup
        const detailedBookingCostItems = await prisma.costItemSupplier.findMany({
            select: {
                id: true, // This is the costItemSupplierId
                supplier: true,
                amount: true,
                paidAmount: true,
                pendingAmount: true, // The raw pending amount from the cost item
                createdAt: true,
                paymentMethod: true,     // Added for SettlePaymentPopup payment history
                firstMethodAmount: true, // Added for SettlePaymentPopup payment history
                secondMethodAmount: true,// Added for SettlePaymentPopup payment history
                settlements: {           // Added for SettlePaymentPopup payment history
                    select: {
                        amount: true,
                        transactionMethod: true,
                        settlementDate: true,
                        createdAt: true, // For sorting/details
                    },
                },
                paidByCreditNoteUsage: { // Added for SettlePaymentPopup payment history
                    select: {
                        amountUsed: true,
                        usedAt: true,
                        creditNote: { // Include credit note details if needed for display
                            select: { id: true, supplier: true, initialAmount: true, remainingAmount: true },
                        },
                    },
                },
                costItem: {
                    select: {
                        category: true,
                        booking: {
                            select: {
                                id: true,
                                folderNo: true,
                                refNo: true,
                                bookingStatus: true,
                            },
                        },
                    },
                },
            },
            where: {
                costItem: {
                    booking: {
                        bookingStatus: {
                            not: 'VOID' // Ensure we don't fetch from voided bookings
                        }
                    }
                }
            }
        });

        // Pre-process detailedBookingCostItems to get accurate pending sums and prepare for transactions list
        const supplierBookingCostItemSums = {};
        const supplierTransactions = {}; // This will hold all transactions (BookingCostItem, CreditNote)

        detailedBookingCostItems.forEach(item => {
            const supplierName = item.supplier;
            if (!supplierBookingCostItemSums[supplierName]) {
                supplierBookingCostItemSums[supplierName] = { totalAmount: 0, totalPaid: 0, totalPending: 0 };
                supplierTransactions[supplierName] = [];
            }

            // Adjust pending amount for cancelled bookings
            const adjustedPendingAmount = item.costItem.booking.bookingStatus === "CANCELLED" ? 0 : item.pendingAmount;
            
            supplierBookingCostItemSums[supplierName].totalAmount += item.amount;
            supplierBookingCostItemSums[supplierName].totalPaid += item.paidAmount;
            supplierBookingCostItemSums[supplierName].totalPending += adjustedPendingAmount; // Sum adjusted pending

            supplierTransactions[supplierName].push({
                type: "BookingCostItem",
                id: item.id, // Unique ID for this transaction item (costItemSupplier.id)
                data: {
                    costItemSupplierId: item.id, // Explicitly pass it for clarity in popup payload
                    supplier: item.supplier,
                    amount: item.amount,
                    paidAmount: item.paidAmount,
                    pendingAmount: adjustedPendingAmount, // This is the adjusted value for display
                    createdAt: item.createdAt,
                    // Pass the newly included fields from CostItemSupplier for popup history
                    paymentMethod: item.paymentMethod,
                    firstMethodAmount: item.firstMethodAmount,
                    secondMethodAmount: item.secondMethodAmount,
                    settlements: item.settlements,
                    paidByCreditNoteUsage: item.paidByCreditNoteUsage,
                    // Nested booking details
                    folderNo: item.costItem.booking.folderNo,
                    refNo: item.costItem.booking.refNo,
                    category: item.costItem.category, // Category from CostItem
                    bookingStatus: item.costItem.booking.bookingStatus,
                    bookingId: item.costItem.booking.id, // Parent Booking ID
                },
            });
        });

        // --- 2. Fetch all Supplier Credit Notes ---
        const allCreditNotes = await prisma.supplierCreditNote.findMany({
            select: { // Select necessary fields for initial display and popup details
                id: true,
                supplier: true,
                initialAmount: true,
                remainingAmount: true,
                status: true,
                createdAt: true,
                generatedFromCancellation: {
                    select: {
                        originalBooking: {
                            select: { refNo: true }
                        }
                    }
                },
                usageHistory: { // To show where the credit note was applied if clicked
                    select: {
                        id: true,
                        amountUsed: true,
                        usedAt: true,
                        usedOnCostItemSupplier: {
                            select: {
                                id: true,
                                costItem: {
                                    select: {
                                        booking: {
                                            select: { refNo: true, folderNo: true }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
        });

        // Aggregate credit notes by supplier and add to transactions
        const supplierCreditNoteSums = {};
        allCreditNotes.forEach(note => {
            const supplierName = note.supplier;
            if (!supplierCreditNoteSums[supplierName]) {
                supplierCreditNoteSums[supplierName] = { totalAvailableCredit: 0 };
                if (!supplierTransactions[supplierName]) supplierTransactions[supplierName] = []; // Ensure the array exists
            }
            supplierCreditNoteSums[supplierName].totalAvailableCredit += note.remainingAmount || 0;

            supplierTransactions[supplierName].push({
                type: "CreditNote",
                id: note.id, // Unique ID for this transaction item (creditNote.id)
                data: {
                    creditNoteId: note.id,
                    supplier: note.supplier,
                    initialAmount: note.initialAmount,
                    remainingAmount: note.remainingAmount,
                    status: note.status,
                    createdAt: note.createdAt,
                    generatedFromRefNo: note.generatedFromCancellation?.originalBooking?.refNo || "N/A",
                    usageHistory: note.usageHistory.map(usage => ({ // Format usage history for popup
                        id: usage.id,
                        amountUsed: usage.amountUsed,
                        usedAt: usage.usedAt,
                        usedOnCostItemSupplierId: usage.usedOnCostItemSupplier?.id,
                        usedOnRefNo: usage.usedOnCostItemSupplier?.costItem?.booking?.refNo || 'N/A',
                        usedOnFolderNo: usage.usedOnCostItemSupplier?.costItem?.booking?.folderNo || 'N/A',
                    })),
                },
            });
        });

        // --- 3. Fetch all individual pending SupplierPayable records for display ---
        const allIndividualPendingPayables = await prisma.supplierPayable.findMany({
            where: { status: "PENDING" },
            select: {
                id: true,
                supplier: true,
                totalAmount: true,
                paidAmount: true,
                pendingAmount: true,
                reason: true,
                createdAt: true,
                createdFromCancellation: {
                    select: {
                        originalBooking: {
                            select: { folderNo: true, refNo: true },
                        },
                    },
                },
            },
        });

        // Aggregate pending payables by supplier and add to payables list
        const supplierPayableSums = {};
        const supplierPayables = {}; // This will hold individual payable items
        allIndividualPendingPayables.forEach(payable => {
            const supplierName = payable.supplier;
            if (!supplierPayableSums[supplierName]) {
                supplierPayableSums[supplierName] = { totalPendingPayables: 0 };
                supplierPayables[supplierName] = [];
            }
            supplierPayableSums[supplierName].totalPendingPayables += payable.pendingAmount || 0;

            supplierPayables[supplierName].push({
                id: payable.id,
                total: payable.totalAmount,
                paid: payable.paidAmount,
                pending: payable.pendingAmount,
                reason: payable.reason,
                createdAt: payable.createdAt,
                originatingFolderNo: payable.createdFromCancellation?.originalBooking?.folderNo || "N/A",
                originatingRefNo: payable.createdFromCancellation?.originalBooking?.refNo || "N/A",
            });
        });


        // --- 4. Construct the final supplierSummary structure ---
        const finalSupplierSummary = {};
        
        // FIX: Use nullish coalescing operator to ensure Object.values always gets an object
        // Correctly reference the Prisma enum for 'Suppliers'
        const allEnumSuppliers = Object.values(prisma.Suppliers || {}); 
        
        const allUniqueSuppliers = new Set([
            ...allEnumSuppliers, 
            ...Object.keys(supplierBookingCostItemSums),
            ...Object.keys(supplierCreditNoteSums),
            ...Object.keys(supplierPayableSums),
        ]);


        let totalOverallPending = 0;
        let totalOverallCredit = 0;

        allUniqueSuppliers.forEach(supplierName => {
            finalSupplierSummary[supplierName] = {
                totalAmount: supplierBookingCostItemSums[supplierName]?.totalAmount || 0,
                totalPaid: supplierBookingCostItemSums[supplierName]?.totalPaid || 0,
                // Total Pending = (adjusted pending from booking cost items) + (pending from payables)
                totalPending: (supplierBookingCostItemSums[supplierName]?.totalPending || 0) + (supplierPayableSums[supplierName]?.totalPendingPayables || 0),
                totalAvailableCredit: supplierCreditNoteSums[supplierName]?.totalAvailableCredit || 0,
                transactions: supplierTransactions[supplierName] ? 
                    supplierTransactions[supplierName].sort((a, b) => new Date(b.data.createdAt).getTime() - new Date(a.data.createdAt).getTime()) 
                    : [],
                payables: supplierPayables[supplierName] ? 
                    supplierPayables[supplierName].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) 
                    : [],
            };
            
            totalOverallPending += finalSupplierSummary[supplierName].totalPending;
            totalOverallCredit += finalSupplierSummary[supplierName].totalAvailableCredit;
        });

        return apiResponse.success(res, {
            summary: finalSupplierSummary,
            totalOverallPending,
            totalOverallCredit
        });

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
  const bookingId = parseInt(req.params.id);

  if (isNaN(bookingId)) {
    return apiResponse.error(res, 'Invalid pending booking ID', 400);
  }

  const updates = req.body;

  try {
    // --- 1. Initial Validation (Robustified) ---
    // Basic fields
    if (updates.numPax !== undefined) {
      const parsedNumPax = parseInt(updates.numPax);
      if (isNaN(parsedNumPax) || parsedNumPax < 1) {
        return apiResponse.error(res, 'numPax must be a positive integer', 400);
      }
    }

    // Enum Validations
    const validTeams = ['PH', 'TOURS', 'MARKETING', 'QC', 'IT']; // Added from schema
    if (updates.teamName && !validTeams.includes(updates.teamName)) {
      return apiResponse.error(res, `Invalid teamName. Must be one of: ${validTeams.join(', ')}`, 400);
    }

    const validBookingTypes = ['FRESH', 'DATE_CHANGE', 'CANCELLATION'];
    if (updates.bookingType && !validBookingTypes.includes(updates.bookingType)) {
      return apiResponse.error(res, `Invalid bookingType. Must be one of: ${validBookingTypes.join(', ')}`, 400);
    }

    const validPaymentMethods = ['FULL', 'INTERNAL', 'REFUND', 'HUMM', 'FULL_HUMM', 'INTERNAL_HUMM'];
    if (updates.paymentMethod && !validPaymentMethods.includes(updates.paymentMethod)) {
      return apiResponse.error(res, `Invalid paymentMethod. Must be one of: ${validPaymentMethods.join(', ')}`, 400);
    }

    // Cost Items Validation if provided
    const validSuppliers = ['BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI'];
    const validSupplierPaymentMethods = [
      'BANK_TRANSFER', 'CREDIT', 'CREDIT_NOTES',
      'BANK_TRANSFER_AND_CREDIT', 'BANK_TRANSFER_AND_CREDIT_NOTES', 'CREDIT_AND_CREDIT_NOTES',
    ];
    // This validation block is now handled within the transaction below, combined with credit note logic

    // Instalments Validation if provided
    if (updates.instalments) {
      if (!Array.isArray(updates.instalments)) {
        return apiResponse.error(res, 'instalments must be an array', 400);
      }
      for (const inst of updates.instalments) {
        if (!inst.dueDate || isNaN(new Date(inst.dueDate).getTime()) || isNaN(parseFloat(inst.amount)) || parseFloat(inst.amount) <= 0 || !['PENDING', 'PAID', 'OVERDUE'].includes(inst.status || 'PENDING')) {
          return apiResponse.error(res, 'Each instalment must have a valid dueDate, positive amount, and valid status', 400);
        }
      }
    }

    // Passengers Validation if provided
    if (updates.passengers) {
      if (!Array.isArray(updates.passengers) || updates.passengers.length === 0) {
        return apiResponse.error(res, 'passengers must be a non-empty array', 400);
      }
      const validTitles = ['MR', 'MRS', 'MS', 'MASTER'];
      const validGenders = ['MALE', 'FEMALE', 'OTHER'];
      const validCategories = ['ADULT', 'CHILD', 'INFANT'];
      for (const pax of updates.passengers) {
        if (!pax.title || !validTitles.includes(pax.title)) return apiResponse.error(res, `Invalid or missing title for a passenger.`, 400);
        if (!pax.firstName || !pax.lastName) return apiResponse.error(res, `Missing first or last name for a passenger.`, 400);
        if (!pax.gender || !validGenders.includes(pax.gender)) return apiResponse.error(res, `Invalid or missing gender for a passenger.`, 400);
        if (!pax.category || !validCategories.includes(pax.category)) return apiResponse.error(res, `Invalid or missing category for a passenger.`, 400);
        if (pax.birthday && isNaN(new Date(pax.birthday).getTime())) return apiResponse.error(res, `Invalid birthday for a passenger.`, 400);
        if (pax.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pax.email)) return apiResponse.error(res, `Invalid email for a passenger.`, 400);
        if (pax.contactNo && !/^\+?\d{10,15}$/.test(pax.contactNo)) return apiResponse.error(res, `Invalid contact number for a passenger.`, 400);
      }
      if (updates.numPax !== undefined && parseInt(updates.numPax) < updates.passengers.length) {
        return apiResponse.error(res, 'numPax cannot be less than the number of passengers provided', 400);
      }
    }


    const updatedPendingBooking = await prisma.$transaction(async (tx) => {
      // 2. Get the record's current state with all relations for audit and credit note handling
      const oldBooking = await tx.pendingBooking.findUnique({
        where: { id: bookingId },
        include: {
          initialPayments: true,
          costItems: {
            include: {
              suppliers: {
                include: {
                  paidByCreditNoteUsage: true // Crucial for credit note reversal
                }
              }
            }
          },
          instalments: true,
          passengers: true,
        }
      });

      if (!oldBooking) {
        throw new Error('Pending booking not found');
      }

      // Store old record for audit logging
      const oldRecordForAudit = { ...oldBooking };

      // --- 3. Handle Credit Note Reversal for old CostItemSuppliers if 'costItems' are updated ---
      if (Array.isArray(updates.costItems)) { // If costItems are being replaced
        for (const oldCostItem of oldBooking.costItems) {
          for (const oldSupplier of oldCostItem.suppliers) {
            for (const usage of oldSupplier.paidByCreditNoteUsage) {
              const creditNoteToRefund = await tx.supplierCreditNote.findUnique({ where: { id: usage.creditNoteId } });
              if (creditNoteToRefund) {
                const newRemainingAmount = creditNoteToRefund.remainingAmount + usage.amountUsed;
                await tx.supplierCreditNote.update({
                  where: { id: creditNoteToRefund.id },
                  data: {
                    remainingAmount: newRemainingAmount,
                    status: newRemainingAmount === creditNoteToRefund.initialAmount ? 'AVAILABLE' : 'PARTIALLY_USED',
                  },
                });
                // Delete the usage record as the old supplier is being replaced
                await tx.creditNoteUsage.delete({ where: { id: usage.id } });
              }
            }
          }
        }
      }

      // --- 4. Financial Recalculation (Comprehensive) ---
      const currentRevenue = oldBooking.revenue || 0;
      const currentProdCost = oldBooking.prodCost || 0;
      const currentTransFee = oldBooking.transFee || 0;
      const currentSurcharge = oldBooking.surcharge || 0;
      
      const newRevenue = updates.revenue !== undefined ? parseFloat(updates.revenue) : currentRevenue;
      if (isNaN(newRevenue)) throw new Error('Invalid revenue amount.');

      const newTransFee = updates.transFee !== undefined ? parseFloat(updates.transFee) : currentTransFee;
      if (isNaN(newTransFee)) throw new Error('Invalid transaction fee amount.');

      const newSurcharge = updates.surcharge !== undefined ? parseFloat(updates.surcharge) : currentSurcharge;
      if (isNaN(newSurcharge)) throw new Error('Invalid surcharge amount.');

      // Calculate new prodCost if costItems are updated, otherwise use existing
      let newProdCost = currentProdCost;
      if (Array.isArray(updates.costItems)) {
        newProdCost = updates.costItems.reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
        if (isNaN(newProdCost)) throw new Error('Invalid production cost amount from cost items.');
      } else if (updates.prodCost !== undefined) { // If prodCost is updated directly without costItems array
        newProdCost = parseFloat(updates.prodCost);
        if (isNaN(newProdCost)) throw new Error('Invalid production cost amount.');
      }

      // Calculate new received if initialPayments are updated, otherwise use existing
      let newCalculatedReceived = oldBooking.initialPayments.reduce((sum, p) => sum + p.amount, 0); // Start with existing
      let latestPaymentDate = oldBooking.lastPaymentDate;

      if (Array.isArray(updates.initialPayments)) {
          newCalculatedReceived = updates.initialPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
          if (isNaN(newCalculatedReceived)) throw new Error('Invalid received amount from initial payments.');
          
          // Determine the latest payment date from the new initial payments
          const dates = updates.initialPayments.map(p => new Date(p.paymentDate || p.receivedDate));
          if (dates.length > 0) {
              latestPaymentDate = new Date(Math.max(...dates));
          } else {
              latestPaymentDate = null; // No initial payments, so no last payment date
          }
      }

      const newProfit = newRevenue - newProdCost - newTransFee - newSurcharge;
      const newBalance = newRevenue - newCalculatedReceived;

      // 5. Construct the data object for the update, applying changes only if provided
      const dataForUpdate = {};

      if (updates.refNo !== undefined) dataForUpdate.refNo = updates.refNo;
      if (updates.paxName !== undefined) dataForUpdate.paxName = updates.paxName;
      if (updates.agentName !== undefined) dataForUpdate.agentName = updates.agentName;
      if (updates.teamName !== undefined) dataForUpdate.teamName = updates.teamName;
      if (updates.pnr !== undefined) dataForUpdate.pnr = updates.pnr;
      if (updates.airline !== undefined) dataForUpdate.airline = updates.airline;
      if (updates.fromTo !== undefined) dataForUpdate.fromTo = updates.fromTo;
      if (updates.bookingType !== undefined) dataForUpdate.bookingType = updates.bookingType;
      if (updates.pcDate !== undefined) dataForUpdate.pcDate = new Date(updates.pcDate);
      if (updates.issuedDate !== undefined) dataForUpdate.issuedDate = updates.issuedDate ? new Date(updates.issuedDate) : null;
      if (updates.paymentMethod !== undefined) dataForUpdate.paymentMethod = updates.paymentMethod;
      if (updates.travelDate !== undefined) dataForUpdate.travelDate = new Date(updates.travelDate);
      if (updates.invoiced !== undefined) dataForUpdate.invoiced = updates.invoiced;
      if (updates.description !== undefined) dataForUpdate.description = updates.description;
      if (updates.numPax !== undefined) dataForUpdate.numPax = parseInt(updates.numPax);
      
      // Apply calculated financials
      dataForUpdate.revenue = newRevenue;
      dataForUpdate.prodCost = newProdCost;
      dataForUpdate.transFee = newTransFee;
      dataForUpdate.surcharge = newSurcharge;
      dataForUpdate.profit = newProfit;
      dataForUpdate.balance = newBalance;
      dataForUpdate.lastPaymentDate = latestPaymentDate;


      // 6. Handle Nested Relations (deleteMany then create)
      if (Array.isArray(updates.initialPayments)) {
        dataForUpdate.initialPayments = {
          deleteMany: {},
          create: updates.initialPayments.map(p => ({
            amount: parseFloat(p.amount),
            transactionMethod: p.transactionMethod,
            paymentDate: new Date(p.receivedDate || p.paymentDate),
          })),
        };
      }

      if (Array.isArray(updates.costItems)) {
        // Validate new credit note usages if present
        const creditNoteUsageMap = new Map();
        const allCreditNoteIds = new Set();
        for (const [itemIdx, item] of updates.costItems.entries()) {
            if (!item.category || isNaN(parseFloat(item.amount)) || parseFloat(item.amount) <= 0) {
                throw new Error('Each cost item must have a category and a positive amount');
            }
            if (!Array.isArray(item.suppliers) || item.suppliers.length === 0) {
                throw new Error('Each cost item must have at least one supplier allocation');
            }
            const supplierTotal = item.suppliers.reduce((sum, s) => sum + (parseFloat(s.amount) || 0), 0);
            if (Math.abs(parseFloat(item.amount) - supplierTotal) > 0.01) {
                throw new Error('Supplier amounts must sum to the cost item amount');
            }

            for (const [supplierIdx, s] of item.suppliers.entries()) {
                if (!s.supplier || !validSuppliers.includes(s.supplier) || isNaN(parseFloat(s.amount)) || parseFloat(s.amount) <= 0 || !validSupplierPaymentMethods.includes(s.paymentMethod)) {
                    throw new Error(`Invalid supplier data for ${s.supplier}: must have valid supplier, positive amount, and valid paymentMethod`);
                }

                if (s.paymentMethod.includes('CREDIT_NOTES')) {
                    const amountToCoverByNotes = (s.paymentMethod === 'CREDIT_NOTES')
                    ? (parseFloat(s.firstMethodAmount) || 0)
                    : (parseFloat(s.secondMethodAmount) || 0);
                    
                    let totalAppliedFromNotes = 0;
                    (s.selectedCreditNotes || []).forEach(usedNote => {
                        const parsedAmountToUse = parseFloat(usedNote.amountToUse || 0);
                        if (isNaN(parsedAmountToUse) || parsedAmountToUse <= 0) {
                            throw new Error(`Invalid credit note usage amount for Credit Note ID ${usedNote.id}.`);
                        }
                        totalAppliedFromNotes += parsedAmountToUse;
                        allCreditNoteIds.add(usedNote.id);

                        if (!creditNoteUsageMap.has(usedNote.id)) {
                            creditNoteUsageMap.set(usedNote.id, []);
                        }
                        creditNoteUsageMap.get(usedNote.id).push({
                            amountToUse: parsedAmountToUse,
                            supplier: s.supplier,
                            itemIndex: itemIdx,
                            supplierIndex: supplierIdx
                        });
                    });
                    if (Math.abs(totalAppliedFromNotes - amountToCoverByNotes) > 0.01) {
                        throw new Error(`For supplier ${s.supplier}, the applied credit notes total (£${totalAppliedFromNotes.toFixed(2)}) does not match the required amount (£${amountToCoverByNotes.toFixed(2)}).`);
                    }
                }
            }
        }
        // Fetch all unique credit notes in one go for validation
        const existingCreditNotes = await tx.supplierCreditNote.findMany({
            where: { id: { in: Array.from(allCreditNoteIds) } },
        });
        const creditNoteLookup = new Map(existingCreditNotes.map(cn => [cn.id, cn]));

        // Final validation of new credit notes against fetched data
        for (const [cnId, usages] of creditNoteUsageMap.entries()) {
            const creditNote = creditNoteLookup.get(cnId);
            if (!creditNote) throw new Error(`Credit Note with ID ${cnId} not found.`);
            let totalUsedForThisCN = 0;
            for (const usage of usages) {
                if (creditNote.supplier !== usage.supplier) {
                    throw new Error(`Credit Note ID ${cnId} does not belong to supplier ${usage.supplier}.`);
                }
                totalUsedForThisCN += usage.amountToUse;
            }
            // Check remaining amount against the _current_ remaining amount (after any reversals)
            if (creditNote.remainingAmount < totalUsedForThisCN) {
                throw new Error(`Credit Note ID ${cnId} has insufficient funds. Remaining: £${creditNote.remainingAmount.toFixed(2)}, Attempted to use: £${totalUsedForThisCN.toFixed(2)}.`);
            }
        }

        dataForUpdate.costItems = {
          deleteMany: {},
          create: updates.costItems.map(item => ({
            category: item.category,
            amount: parseFloat(item.amount),
            suppliers: {
              create: (item.suppliers || []).map(s => ({
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
        };
      }

      if (Array.isArray(updates.instalments)) {
        dataForUpdate.instalments = {
          deleteMany: {},
          create: updates.instalments.map(inst => ({
            dueDate: new Date(inst.dueDate),
            amount: parseFloat(inst.amount),
            status: inst.status || 'PENDING',
          })),
        };
      }

      if (Array.isArray(updates.passengers)) {
        dataForUpdate.passengers = {
          deleteMany: {},
          create: updates.passengers.map(pax => ({
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
        };
      }

      // 7. Perform the update
      const finalPendingBooking = await tx.pendingBooking.update({
        where: { id: bookingId },
        data: dataForUpdate,
        include: {
          initialPayments: true,
          costItems: { include: { suppliers: true } },
          instalments: true,
          passengers: true,
        },
      });

      // 8. Apply Credit Note Usages for the newly created suppliers
      if (Array.isArray(updates.costItems)) {
          for (const [itemIndex, item] of updates.costItems.entries()) {
            const createdCostItem = finalPendingBooking.costItems.find(ci => ci.category === item.category && Math.abs(ci.amount - parseFloat(item.amount)) < 0.01);
            if (!createdCostItem) continue; // Should not happen if deleteMany/create worked
            
            for (const [supplierIndex, s] of (item.suppliers || []).entries()) {
              if (s.paymentMethod.includes('CREDIT_NOTES')) {
                const createdCostItemSupplier = createdCostItem.suppliers.find(sup => sup.supplier === s.supplier && Math.abs(sup.amount - parseFloat(s.amount)) < 0.01);
                if (!createdCostItemSupplier) continue;

                for (const usedNote of (s.selectedCreditNotes || [])) {
                  const amountToUse = parseFloat(usedNote.amountToUse);
                  await tx.supplierCreditNote.update({
                    where: { id: usedNote.id },
                    data: {
                      remainingAmount: { decrement: amountToUse },
                      status: {
                          // Determine new status based on remainingAmount after decrement
                          // This requires a separate fetch or logic here that ensures final amount
                          // For simplicity, we assume Prisma handles it correctly with decrement
                          // or would need to fetch after decrement for precise status update.
                          // A safer approach for status might be to re-evaluate it after all usages are applied.
                      },
                    },
                  });

                  // Re-fetch the credit note to set the accurate status
                  const updatedCreditNote = await tx.supplierCreditNote.findUnique({where: {id: usedNote.id}});
                  await tx.supplierCreditNote.update({
                      where: {id: usedNote.id},
                      data: {
                          status: updatedCreditNote.remainingAmount < 0.01 ? 'USED' : 'PARTIALLY_USED'
                      }
                  });


                  await tx.creditNoteUsage.create({
                    data: {
                      amountUsed: amountToUse,
                      creditNoteId: usedNote.id,
                      usedOnCostItemSupplierId: createdCostItemSupplier.id,
                    }
                  });
                }
              }
            }
          }
      }

      // 9. Audit Log changes
      await compareAndLogChanges(tx, {
        userId,
        modelName: 'PendingBooking',
        recordId: finalPendingBooking.id,
        oldRecord: oldRecordForAudit,
        newRecord: finalPendingBooking,
        updates: updates,
      });

      return finalPendingBooking;
    }, {
        timeout: 20000 // Increased transaction timeout to 20 seconds due to complex nested updates and credit note handling
    }); // End of prisma.$transaction

    return apiResponse.success(res, updatedPendingBooking, 200);

  } catch (error) {
    console.error('Error updating pending booking:', error);
    if (error.message.includes("not found")) return apiResponse.error(res, error.message, 404);
    if (error.message.includes('Invalid')) return apiResponse.error(res, error.message, 400);
    if (error.message.includes('missing')) return apiResponse.error(res, error.message, 400);
    if (error.message.includes('must')) return apiResponse.error(res, error.message, 400);
    if (error.message.includes('exceeds')) return apiResponse.error(res, error.message, 400);
    if (error.code === 'P2002') return apiResponse.error(res, 'Pending booking with this unique identifier already exists.', 409);
    return apiResponse.error(res, `Failed to update pending booking: ${error.message}`, 500);
  }
};

const recordSettlementPayment = async (req, res) => {
  const { id: userId } = req.user;
  const bookingId = parseInt(req.params.bookingId); // Corrected from req.params.id to req.params.bookingId
  const { amount, transactionMethod, paymentDate } = req.body;

  try {
    // 1. Validation
    if (isNaN(bookingId)) {
      return apiResponse.error(res, 'Invalid Booking ID', 400);
    }
    const paymentAmount = parseFloat(amount);
    if (isNaN(paymentAmount) || paymentAmount <= 0) {
      return apiResponse.error(res, 'Payment amount must be a positive number', 400);
    }
    if (!transactionMethod || !paymentDate) {
        return apiResponse.error(res, 'Transaction method and payment date are required.', 400);
    }
    if (isNaN(new Date(paymentDate).getTime())) {
        return apiResponse.error(res, 'Invalid payment date', 400);
    }

    const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT', 'BANK_TRANSFER']; // Ensure this list is complete
    if (!validTransactionMethods.includes(transactionMethod)) {
      return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
    }


    const result = await prisma.$transaction(async (tx) => {
      // 2. Fetch the Booking with ALL necessary relations for comprehensive recalculation
      const booking = await tx.booking.findUnique({
        where: { id: bookingId },
        include: {
          initialPayments: true,
          instalments: { include: { payments: true } }, // Include payments to all instalments
          customerPayables: { include: { settlements: true } }, // Include customer payables for full received calculation
        },
      });

      if (!booking) {
        throw new Error('Booking not found');
      }

      const currentBalance = parseFloat(booking.balance || 0); // Use parsed balance from DB
      if (paymentAmount > currentBalance + 0.01) { // Add tolerance for floating-point issues
          throw new Error(`Payment (£${paymentAmount.toFixed(2)}) exceeds pending balance (£${currentBalance.toFixed(2)})`);
      }

      // 3. Find or Create the Special "SETTLEMENT" Instalment
      let settlementInstalment = booking.instalments.find(inst => inst.status === 'SETTLEMENT');

      if (!settlementInstalment) {
        settlementInstalment = await tx.instalment.create({
          data: {
            bookingId: booking.id,
            dueDate: new Date(paymentDate), // Due date is the settlement date
            amount: paymentAmount, // Initial amount is the payment amount, it will effectively be "paid"
            status: 'SETTLEMENT',
          },
        });
      } else {
          // If settlement instalment already exists, update its amount to reflect total settled
          // This ensures its 'amount' field represents the sum of all payments made to it
          const currentSettlementAmount = settlementInstalment.amount;
          await tx.instalment.update({
              where: { id: settlementInstalment.id },
              data: {
                  amount: currentSettlementAmount + paymentAmount,
                  dueDate: new Date(paymentDate), // Update due date to latest settlement date
              }
          });
          // Update the in-memory object for later calculations if needed
          settlementInstalment.amount += paymentAmount;
      }

      // 4. Record the Actual Payment against the settlement instalment
      const newInstalmentPayment = await tx.instalmentPayment.create({
        data: {
          instalmentId: settlementInstalment.id,
          amount: paymentAmount,
          transactionMethod,
          paymentDate: new Date(paymentDate),
        },
      });
      
      // 5. Recalculate Booking's Total Received and Balance from scratch (Comprehensive)
      
      // Sum all initial payments
      const totalInitialPayments = (booking.initialPayments || []).reduce((sum, p) => sum + p.amount, 0);

      // Sum all payments made to all instalments (including the 'SETTLEMENT' one)
      // Re-fetch instalments with payments to ensure the very latest payment is included
      const allInstalmentsWithLatestPayments = await tx.instalment.findMany({
          where: { bookingId: booking.id },
          include: { payments: true }
      });
      const totalInstalmentPayments = (allInstalmentsWithLatestPayments || []).reduce((instSum, inst) => 
          instSum + (inst.payments || []).reduce((pSum, p) => pSum + p.amount, 0), 0
      );

      // Sum all customer payable settlements (for cancellation debts, if any)
      const totalCustomerPayableSettlements = (booking.customerPayables || []).reduce((sum, payable) => 
          sum + (payable.settlements || []).reduce((sSum, s) => sSum + s.amount, 0), 0);
      
      const newTotalReceived = totalInitialPayments + totalInstalmentPayments + totalCustomerPayableSettlements;
      const newBalance = (booking.revenue || 0) - newTotalReceived;

      // Store old balance for audit log
      const oldBookingBalance = booking.balance;

      // 6. Update the main Booking's balance and lastPaymentDate
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          balance: newBalance,
          lastPaymentDate: new Date(paymentDate), // Update last payment date
        },
      });

      // 7. Create Audit Log for the Booking
      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: booking.id,
        action: ActionType.SETTLEMENT_PAYMENT,
        changes: [{
          fieldName: 'balance', 
          oldValue: oldBookingBalance !== undefined ? oldBookingBalance.toFixed(2) : 'N/A',
          newValue: newBalance.toFixed(2)
        }]
      });

      // 8. Return a useful payload for frontend state update
      return {
          bookingUpdate: {
              id: updatedBooking.id,
              balance: updatedBooking.balance,
              received: newTotalReceived.toFixed(2), // Frontend expects this for its state update
          }
      };
    }, {
        timeout: 10000 // Increase transaction timeout to 10 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, result);

  } catch (error) {
    console.error('Error recording settlement payment:', error);
    if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
    if (error.message.includes('exceeds pending balance')) return apiResponse.error(res, error.message, 400);
    if (error.message.includes('Invalid')) return apiResponse.error(res, error.message, 400); // Catch explicit validation errors
    if (error.name === 'PrismaClientValidationError') return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
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

  try {
    // 1. Validate and parse input amounts
    const parsedSupplierCancellationFee = parseFloat(supplierCancellationFee);
    const parsedAdminFee = parseFloat(adminFee);

    if (isNaN(parsedSupplierCancellationFee) || parsedSupplierCancellationFee < 0) {
      return apiResponse.error(res, 'Supplier Cancellation Fee must be a non-negative number.', 400);
    }
    if (isNaN(parsedAdminFee) || parsedAdminFee < 0) {
      return apiResponse.error(res, 'Admin Fee must be a non-negative number.', 400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 2. Fetch the trigger booking and its chain
      const triggerBooking = await tx.booking.findUnique({ where: { id: parseInt(triggerBookingId) } });
      if (!triggerBooking) throw new Error('Booking not found.');

      const baseFolderNo = triggerBooking.folderNo.toString().split('.')[0];

      const chainBookings = await tx.booking.findMany({
        where: { OR: [{ folderNo: baseFolderNo }, { folderNo: { startsWith: `${baseFolderNo}.` } }] },
        include: {
          initialPayments: true,
          instalments: { include: { payments: true } },
          costItems: { include: { suppliers: true } }, // Include cost items to find supplier for credit/payable
        },
      });

      if (chainBookings.some(b => b.bookingStatus === 'CANCELLED')) {
        throw new Error('This booking chain has already been cancelled.');
      }
      const rootBookingInChain = chainBookings.find(b => b.folderNo === baseFolderNo);
      if (!rootBookingInChain) throw new Error('Could not find root booking in chain.');

      // 3. Calculate financial figures for the cancellation event
      const totalOwedToSupplierBeforeCancellation = chainBookings.reduce((sum, booking) => {
        // Sum prodCost for all *active* bookings in the chain
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

      const customerTotalCancellationFee = parsedSupplierCancellationFee + parsedAdminFee;
      
      const supplierDifference = totalOwedToSupplierBeforeCancellation - parsedSupplierCancellationFee;
      const customerDifference = totalChainReceivedFromCustomer - customerTotalCancellationFee;
      
      const refundToPassenger = customerDifference > 0 ? customerDifference : 0;
      const payableByCustomer = customerDifference < 0 ? Math.abs(customerDifference) : 0;
      
      const creditNoteAmount = supplierDifference > 0 ? supplierDifference : 0;
      const profitOrLoss = (totalChainReceivedFromCustomer - totalOwedToSupplierBeforeCancellation) - refundToPassenger + payableByCustomer;

      // 4. Create the Cancellation record
      const newCancellationRecord = await tx.cancellation.create({
        data: {
          originalBookingId: rootBookingInChain.id,
          folderNo: `${baseFolderNo}.C`, // Unique folder number for the cancellation record
          originalRevenue: rootBookingInChain.revenue || 0,
          originalProdCost: rootBookingInChain.prodCost || 0,
          supplierCancellationFee: parsedSupplierCancellationFee,
          refundToPassenger: refundToPassenger,
          adminFee: parsedAdminFee,
          creditNoteAmount: creditNoteAmount,
          refundStatus: refundToPassenger > 0 ? 'PENDING' : 'N/A',
          profitOrLoss: profitOrLoss,
          description: `Cancellation for booking chain ${baseFolderNo}. Triggered by Booking ID ${triggerBookingId}.`,
        },
      });
      
      // 5. Handle Supplier-side Financial Outcomes (Credit Note or Payable)
      // Determine a supplier for the credit note/payable (assuming one primary supplier)
      const primarySupplierInfo = rootBookingInChain.costItems[0]?.suppliers[0]?.supplier;

      if (supplierDifference > 0) { // We have a credit with the supplier
        if (primarySupplierInfo) {
            await tx.supplierCreditNote.create({
                data: {
                    supplier: primarySupplierInfo,
                    initialAmount: creditNoteAmount,
                    remainingAmount: creditNoteAmount,
                    status: 'AVAILABLE',
                    generatedFromCancellationId: newCancellationRecord.id,
                }
            });
        } else {
            console.warn(`No primary supplier found for booking ${rootBookingInChain.id}. Cannot create SupplierCreditNote.`);
        }
      } else if (supplierDifference < 0) { // We owe the supplier money
        if (primarySupplierInfo) {
            const amountOwedToSupplier = Math.abs(supplierDifference);
            await tx.supplierPayable.create({
                data: {
                    supplier: primarySupplierInfo,
                    totalAmount: amountOwedToSupplier,
                    pendingAmount: amountOwedToSupplier,
                    reason: `Cancellation fee shortfall for booking chain ${baseFolderNo}`,
                    status: 'PENDING',
                    createdFromCancellationId: newCancellationRecord.id,
                }
            });
        } else {
            console.warn(`No primary supplier found for booking ${rootBookingInChain.id}. Cannot create SupplierPayable.`);
        }
      }
      
      // 6. Handle Customer-side Financial Outcomes (Customer Payable)
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

      // 7. Update Booking Status and Financials for all bookings in the chain
      for (const bookingInChain of chainBookings) {
          const oldBookingStatus = bookingInChain.bookingStatus;
          const oldBookingProfit = bookingInChain.profit;
          const oldBookingBalance = bookingInChain.balance;

          // For simplicity and consistency, apply the cancellation's profitOrLoss to the root booking's profit
          // And update its balance based on customer refund/payable outcome.
          let updatedBookingBalance = 0;
          if (payableByCustomer > 0) {
              updatedBookingBalance = payableByCustomer;
          } else if (refundToPassenger > 0) {
              updatedBookingBalance = -refundToPassenger;
          }

          await tx.booking.update({
              where: { id: bookingInChain.id },
              data: {
                  bookingStatus: 'CANCELLED',
                  // Only update profit/balance for the root booking to reflect the chain's outcome
                  // Other bookings in the chain also become CANCELLED but their individual financials
                  // might not be re-evaluated in the same way.
                  profit: bookingInChain.id === rootBookingInChain.id ? profitOrLoss : bookingInChain.profit,
                  balance: bookingInChain.id === rootBookingInChain.id ? updatedBookingBalance : bookingInChain.balance,
              }
          });

          // Audit Log for Booking status and financial changes
          await createAuditLog(tx, {
            userId,
            modelName: 'Booking',
            recordId: bookingInChain.id,
            action: ActionType.VOID_BOOKING, // Using VOID_BOOKING or CREATE_CANCELLATION
            changes: [
              {
                fieldName: 'bookingStatus',
                oldValue: oldBookingStatus,
                newValue: 'CANCELLED',
              },
              ...(bookingInChain.id === rootBookingInChain.id ? [
                {
                  fieldName: 'profit',
                  oldValue: oldBookingProfit !== undefined ? oldBookingProfit.toFixed(2) : 'N/A',
                  newValue: profitOrLoss.toFixed(2),
                },
                {
                  fieldName: 'balance',
                  oldValue: oldBookingBalance !== undefined ? oldBookingBalance.toFixed(2) : 'N/A',
                  newValue: updatedBookingBalance.toFixed(2),
                }
              ] : [])
            ]
          });
      }

      // 8. Create Audit Log for the Cancellation Record
      await createAuditLog(tx, {
        userId,
        modelName: 'Cancellation',
        recordId: newCancellationRecord.id,
        action: ActionType.CREATE_CANCELLATION,
        // You might add details about refundToPassenger, payableByCustomer here
      });

      return newCancellationRecord;
    }, {
        timeout: 15000 // Increased transaction timeout to 15 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, result, 201);
  } catch (error) {
    console.error("Error creating cancellation:", error);
    if (error.message.includes('not found') || error.message.includes('already been cancelled')) {
      return apiResponse.error(res, error.message, 404);
    }
    if (error.message.includes('non-negative number')) {
        return apiResponse.error(res, error.message, 400);
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


const createDateChangeBooking = async (req, res) => {
  const { id: userId } = req.user;
  const originalBookingId = parseInt(req.params.id);
  const data = req.body; // 'data' now contains snake_case keys from the frontend

  try {
    // --- 1. Initial Input Validation (Pre-transaction) ---
    if (isNaN(originalBookingId)) {
      return apiResponse.error(res, 'Invalid original booking ID', 400);
    }

    // FIX: Update requiredFields to use snake_case to match frontend payload
    const requiredFields = [
      'ref_no', 'pax_name', 'agent_name', 'team_name', 'pnr', 'airline', 'from_to',
      'paymentMethod', 'pcDate', 'travelDate', 'revenue', 'numPax'
    ];
    
    const missingFields = requiredFields.filter(field => !data[field] && data[field] !== 0);
    if (missingFields.length > 0) {
      return apiResponse.error(res, `Missing required fields for new booking: ${missingFields.join(', ')}`, 400);
    }

    // Validate numeric fields for the new booking (using snake_case where appropriate)
    const parsedRevenue = parseFloat(data.revenue || 0);
    if (isNaN(parsedRevenue) || parsedRevenue < 0) return apiResponse.error(res, 'Revenue must be a non-negative number.', 400);
    const parsedProdCost = parseFloat(data.prodCost || 0);
    if (isNaN(parsedProdCost) || parsedProdCost < 0) return apiResponse.error(res, 'Production Cost must be a non-negative number.', 400);
    const parsedTransFee = parseFloat(data.transFee || 0); // Assuming transFee is camelCase from frontend
    if (isNaN(parsedTransFee) || parsedTransFee < 0) return apiResponse.error(res, 'Transaction Fee must be a non-negative number.', 400);
    const parsedSurcharge = parseFloat(data.surcharge || 0);
    if (isNaN(parsedSurcharge) || parsedSurcharge < 0) return apiResponse.error(res, 'Surcharge must be a non-negative number.', 400);
    const parsedNumPax = parseInt(data.numPax);
    if (isNaN(parsedNumPax) || parsedNumPax <= 0) return apiResponse.error(res, 'Number of passengers must be a positive integer.', 400);

    // Date validations
    if (isNaN(new Date(data.pcDate).getTime())) return apiResponse.error(res, 'Invalid PC Date.', 400);
    if (isNaN(new Date(data.travelDate).getTime())) return apiResponse.error(res, 'Invalid Travel Date.', 400);
    if (data.issuedDate && isNaN(new Date(data.issuedDate).getTime())) return apiResponse.error(res, 'Invalid Issued Date.', 400);
    if (data.lastPaymentDate && isNaN(new Date(data.lastPaymentDate).getTime())) return apiResponse.error(res, 'Invalid Last Payment Date.', 400);

    // Nested validations (similar to createBooking) - concise for brevity here
    if (data.initialPayments && !Array.isArray(data.initialPayments)) return apiResponse.error(res, 'initialPayments must be an array.', 400);
    if (data.prodCostBreakdown && !Array.isArray(data.prodCostBreakdown)) return apiResponse.error(res, 'prodCostBreakdown must be an array.', 400);
    if (data.instalments && !Array.isArray(data.instalments)) return apiResponse.error(res, 'instalments must be an array.', 400);
    if (data.passengers && !Array.isArray(data.passengers)) return apiResponse.error(res, 'passengers must be an array.', 400);


    const newBooking = await prisma.$transaction(async (tx) => {
      // 2. Fetch original booking and check for cancellation
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

      // 3. Determine new folder number and the previous booking in the chain
      const allChainBookings = await tx.booking.findMany({
        where: { OR: [{ folderNo: baseFolderNo }, { folderNo: { startsWith: `${baseFolderNo}.` } }] },
        orderBy: { folderNo: 'asc' }, // Order to ensure correct last booking identification
      });

      let nextSubIndex = 0;
      let previousBookingInChain = originalBooking; // Default to original if no follow-ups

      if (allChainBookings.length > 0) {
        // Find the booking with the highest numeric sub-index
        const lastBookingInChain = allChainBookings.reduce((latest, current) => {
            const currentSubIndex = current.folderNo.includes('.') ? parseInt(current.folderNo.split('.')[1]) : 0;
            const latestSubIndex = latest.folderNo.includes('.') ? parseInt(latest.folderNo.split('.')[1]) : 0;
            return currentSubIndex > latestSubIndex ? current : latest;
        }, allChainBookings[0]); // Start reduction with the first booking

        previousBookingInChain = lastBookingInChain;
        nextSubIndex = lastBookingInChain.folderNo.includes('.') ? parseInt(lastBookingInChain.folderNo.split('.')[1]) : 0;
      }
      
      const newFolderNo = `${baseFolderNo}.${nextSubIndex + 1}`;
      
      // 4. Update the previous booking in the chain to 'COMPLETED'
      const oldBookingStatus = previousBookingInChain.bookingStatus;
      await tx.booking.update({ where: { id: previousBookingInChain.id }, data: { bookingStatus: 'COMPLETED' } });
      
      // Audit log for the updated previous booking
      await createAuditLog(tx, {
          userId,
          modelName: 'Booking',
          recordId: previousBookingInChain.id,
          action: ActionType.DATE_CHANGE, // Signifies its role in a date change event
          changes: [{
            fieldName: 'bookingStatus',
            oldValue: oldBookingStatus,
            newValue: 'COMPLETED'
          }]
      });

      // 5. Calculate financial values for the new booking
      const newBookingProdCost = (data.prodCostBreakdown || []).reduce((sum, item) => sum + parseFloat(item.amount || 0), 0);
      const newBookingReceived = (data.initialPayments || []).reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

      const newBookingProfit = parsedRevenue - newBookingProdCost - parsedTransFee - parsedSurcharge;
      const newBookingBalance = parsedRevenue - newBookingReceived;
      
      // Determine lastPaymentDate from initialPayments for the new booking
      const sortedInitialPayments = [...(data.initialPayments || [])].sort((a, b) => new Date(a.receivedDate || a.paymentDate).getTime() - new Date(b.receivedDate || b.paymentDate).getTime());
      const latestPaymentDate = sortedInitialPayments.length > 0 
                                ? new Date(sortedInitialPayments[sortedInitialPayments.length - 1].receivedDate || sortedInitialPayments[sortedInitialPayments.length - 1].paymentDate) 
                                : null;


      // 6. Create the new Date Change Booking record
      const newBookingRecord = await tx.booking.create({
        data: {
          originalBooking: { connect: { id: originalBooking.id } },
          folderNo: newFolderNo,
          bookingStatus: 'CONFIRMED', // New date change booking is confirmed
          bookingType: 'DATE_CHANGE',
          refNo: data.ref_no,          // FIX: Use snake_case
          paxName: data.pax_name,      // FIX: Use snake_case
          agentName: data.agent_name,  // FIX: Use snake_case
          teamName: data.team_name,    // FIX: Use snake_case
          pnr: data.pnr,
          airline: data.airline,
          fromTo: data.from_to,        // FIX: Use snake_case
          pcDate: new Date(data.pcDate),
          issuedDate: data.issuedDate ? new Date(data.issuedDate) : null,
          paymentMethod: data.paymentMethod,
          lastPaymentDate: latestPaymentDate,
          travelDate: new Date(data.travelDate),
          
          revenue: parsedRevenue,
          prodCost: newBookingProdCost,
          transFee: parsedTransFee,
          surcharge: parsedSurcharge,
          balance: newBookingBalance,
          profit: newBookingProfit,
          
          invoiced: data.invoiced || null,
          description: data.description || null,
          numPax: parsedNumPax,
          
          initialPayments: {
            create: (data.initialPayments || []).map(p => ({
              amount: parseFloat(p.amount),
              transactionMethod: p.transactionMethod,
              paymentDate: new Date(p.receivedDate || p.paymentDate),
            })),
          },
          passengers: {
            create: (data.passengers || []).map(pax => ({
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
                create: (item.suppliers || []).map(s => ({
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

      // Audit log for the new booking creation
      await createAuditLog(tx, {
        userId,
        modelName: 'Booking',
        recordId: newBookingRecord.id,
        action: ActionType.CREATE, // Use CREATE or CREATE_DATE_CHANGE if you have that
        // Potentially add changes for the new booking's core fields
      });

      // 7. Fetch and return the complete new booking record
      return tx.booking.findUnique({
        where: { id: newBookingRecord.id },
        include: { costItems: { include: { suppliers: true } }, instalments: true, passengers: true, initialPayments: true }
      });
    }, {
        timeout: 15000 // Increased transaction timeout to 15 seconds
    }); // End of prisma.$transaction

    return apiResponse.success(res, newBooking, 201);
  } catch (error) {
    console.error('Error creating date change booking:', error);
    if (error.message.includes('not found') || error.message.includes('cancelled')) {
        return apiResponse.error(res, error.message, 404);
    }
    // Added specific check for 'Missing required fields' to provide the correct 400 status
    if (error.message.includes('required') || error.message.includes('Invalid') || error.message.includes('must be')) {
        return apiResponse.error(res, error.message, 400);
    }
    if (error.code === 'P2002') { // Unique constraint violation (e.g., refNo or folderNo if not unique chain)
        return apiResponse.error(res, 'A booking with a similar unique identifier already exists.', 409);
    }
    return apiResponse.error(res, `Failed to create date change booking: ${error.message}`, 500);
  }
};

const createSupplierPayableSettlement = async (req, res) => {
    const { id: userId } = req.user;
    const { payableId, amount, transactionMethod, settlementDate } = req.body;

    try {
        const paymentAmount = parseFloat(amount);

        // 1. Validation
        if (!payableId) {
            return apiResponse.error(res, 'Missing payableId', 400);
        }
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return apiResponse.error(res, 'Amount must be a positive number', 400);
        }
        if (!transactionMethod || !settlementDate) {
            return apiResponse.error(res, 'Missing transactionMethod or settlementDate', 400);
        }
        if (isNaN(new Date(settlementDate).getTime())) {
            return apiResponse.error(res, 'Invalid settlement date', 400);
        }
        const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT', 'BANK_TRANSFER']; // Added BANK_TRANSFER from schema
        if (!validTransactionMethods.includes(transactionMethod)) {
          return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            // 2. Fetch the SupplierPayable and its full chain to the Booking for comprehensive recalculation and logging
            const payable = await tx.supplierPayable.findUnique({
                where: { id: parseInt(payableId) },
                include: {
                    createdFromCancellation: {
                        include: {
                            originalBooking: {
                                include: {
                                    initialPayments: true,
                                    instalments: { include: { payments: true } },
                                    customerPayables: { include: { settlements: true } },
                                    costItems: { include: { suppliers: { include: { settlements: true } } } }, // Deep include for all supplier settlements
                                }
                            }
                        }
                    },
                    settlements: true // Include existing settlements for this payable
                }
            });

            if (!payable) {
                throw new Error('Supplier Payable record not found.');
            }
            if (!payable.createdFromCancellation?.originalBooking) {
                throw new Error('Could not find the original booking related to this payable.');
            }
            const currentBooking = payable.createdFromCancellation.originalBooking;

            const pendingAmount = parseFloat(payable.pendingAmount) || 0;
            if (paymentAmount > pendingAmount + 0.01) { // Add tolerance for floating-point issues
                throw new Error(`Settlement amount (£${paymentAmount.toFixed(2)}) exceeds pending amount (£${pendingAmount.toFixed(2)})`);
            }

            // 3. Create the new settlement history record
            const newPayableSettlement = await tx.supplierPayableSettlement.create({
                data: {
                    supplierPayableId: parseInt(payableId),
                    amount: paymentAmount,
                    transactionMethod: transactionMethod,
                    settlementDate: new Date(settlementDate),
                },
            });

            // 4. Update the parent SupplierPayable record's amounts and status
            const newPaidAmountForPayable = (parseFloat(payable.paidAmount) || 0) + paymentAmount;
            const newPendingAmountForPayable = pendingAmount - paymentAmount;
            
            const updatedPayableRecord = await tx.supplierPayable.update({
                where: { id: parseInt(payableId) },
                data: {
                    paidAmount: newPaidAmountForPayable,
                    pendingAmount: newPendingAmountForPayable,
                    status: newPendingAmountForPayable < 0.01 ? 'PAID' : 'PENDING',
                },
                include: { settlements: true } // Include settlements for return object
            });

            // 5. Recalculate Booking's comprehensive financial state
            // --- Sum of all payments received from customer ---
            const sumOfInitialPayments = (currentBooking.initialPayments || []).reduce((sum, p) => sum + p.amount, 0);
            const sumOfInstalmentPayments = (currentBooking.instalments || []).reduce((sum, inst) => 
                sum + (inst.payments || []).reduce((pSum, p) => pSum + p.amount, 0), 0);
            const sumOfCustomerPayableSettlements = (currentBooking.customerPayables || []).reduce((sum, customerPayable) => 
                sum + (customerPayable.settlements || []).reduce((sSum, s) => sSum + s.amount, 0), 0);
            
            const totalReceivedFromCustomer = sumOfInitialPayments + sumOfInstalmentPayments + sumOfCustomerPayableSettlements;

            // --- Sum of all payments made to ALL suppliers for ALL cost items and ALL supplier payables ---
            // Re-fetch supplier payables to include the latest settlement
            const allSupplierPayablesForBooking = await tx.supplierPayable.findMany({
                where: { createdFromCancellation: { originalBookingId: currentBooking.id } },
                include: { settlements: true }
            });

            const totalPaidViaSupplierPayables = (allSupplierPayablesForBooking || []).reduce((pSum, payable) => 
                pSum + (payable.settlements || []).reduce((sSum, s) => sSum + s.amount, 0), 0);

            const totalPaidViaCostItemSuppliers = (currentBooking.costItems || []).reduce((ciSum, costItem) => 
                ciSum + (costItem.suppliers || []).reduce((sSum, supplier) => 
                    sSum + (supplier.settlements || []).reduce((setSum, settlement) => setSum + settlement.amount, 0), 0), 0);
            
            const totalPaidToSuppliers = totalPaidViaCostItemSuppliers + totalPaidViaSupplierPayables;

            // Calculate derived fields (profit, balance) based on the latest figures
            const newProfit = (currentBooking.revenue || 0) - totalPaidToSuppliers - (currentBooking.transFee || 0) - (currentBooking.surcharge || 0);
            const newBalance = (currentBooking.revenue || 0) - totalReceivedFromCustomer;
            
            // Store old booking balance and profit for audit log
            const oldBookingBalance = currentBooking.balance;
            const oldBookingProfit = currentBooking.profit;

            // 6. Update the main Booking record with new financials
            const updatedBookingRecord = await tx.booking.update({
                where: { id: currentBooking.id },
                data: {
                    balance: newBalance,
                    profit: newProfit,
                    lastPaymentDate: new Date(settlementDate), // Consider if this should be last customer or last overall payment
                }
            });

            // 7. Create Audit Logs
            await createAuditLog(tx, {
                userId,
                modelName: 'SupplierPayable',
                recordId: payable.id,
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [{
                    fieldName: 'payableStatus',
                    oldValue: payable.status,
                    newValue: updatedPayableRecord.status
                },
                {
                    fieldName: 'supplierPayableSettled',
                    oldValue: `Pending: ${pendingAmount.toFixed(2)}`,
                    newValue: `Paid: ${paymentAmount.toFixed(2)} (New Pending: ${newPendingAmountForPayable.toFixed(2)})`
                }]
            });

            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: currentBooking.id,
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [
                    {
                        fieldName: 'profit',
                        oldValue: oldBookingProfit !== undefined ? oldBookingProfit.toFixed(2) : 'N/A',
                        newValue: newProfit.toFixed(2)
                    },
                    {
                        fieldName: 'balance',
                        oldValue: oldBookingBalance !== undefined ? oldBookingBalance.toFixed(2) : 'N/A',
                        newValue: newBalance.toFixed(2)
                    }
                ]
            });

            return { updatedPayable: updatedPayableRecord, updatedBooking: updatedBookingRecord };
        }, {
            timeout: 10000 // Increase transaction timeout to 10 seconds
        }); // End of prisma.$transaction

        return apiResponse.success(res, result, 201);

    } catch (error) {
        console.error('Error creating supplier payable settlement:', error);
        if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
        if (error.message.includes('exceeds pending amount')) return apiResponse.error(res, error.message, 400);
        if (error.message.includes('Invalid')) return apiResponse.error(res, error.message, 400); // Catch explicit validation errors
        if (error.name === 'PrismaClientValidationError') return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
        return apiResponse.error(res, `Failed to create payable settlement: ${error.message}`, 500);
    }
};


const settleCustomerPayable = async (req, res) => {
    const { id: userId } = req.user;
    const payableId = parseInt(req.params.id);
    const { amount, transactionMethod, paymentDate } = req.body;

    try {
        const paymentAmount = parseFloat(amount);

        // 1. Validation
        if (isNaN(payableId)) {
            return apiResponse.error(res, 'Invalid payable ID', 400);
        }
        if (isNaN(paymentAmount) || paymentAmount <= 0) {
            return apiResponse.error(res, 'Amount must be a positive number.', 400);
        }
        if (!transactionMethod || !paymentDate) {
            return apiResponse.error(res, 'Missing transactionMethod or paymentDate.', 400);
        }
        if (isNaN(new Date(paymentDate).getTime())) {
            return apiResponse.error(res, 'Invalid payment date.', 400);
        }
        const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT_NOTES', 'CREDIT', 'BANK_TRANSFER']; // Ensure this list is complete
        if (!validTransactionMethods.includes(transactionMethod)) {
          return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            // 2. Fetch the CustomerPayable and its associated Booking with ALL necessary relations
            const payable = await tx.customerPayable.findUnique({
                where: { id: payableId },
                include: {
                    booking: {
                        include: {
                            initialPayments: true,
                            instalments: { include: { payments: true } },
                            customerPayables: { include: { settlements: true } }, // Include all payable settlements for accurate total received
                        }
                    }
                }
            });

            if (!payable) {
                throw new Error('Payable record not found.');
            }
            if (!payable.booking) {
                throw new Error('Associated booking not found.');
            }
            const currentBooking = payable.booking;

            const pendingAmount = parseFloat(payable.pendingAmount) || 0;
            if (paymentAmount > pendingAmount + 0.01) { // Add tolerance for floating-point issues
                throw new Error(`Payment amount (£${paymentAmount.toFixed(2)}) exceeds pending balance (£${pendingAmount.toFixed(2)}).`);
            }

            // 3. Create the new settlement history record
            const newCustomerPayableSettlement = await tx.customerPayableSettlement.create({
                data: {
                    customerPayableId: payableId,
                    amount: paymentAmount,
                    transactionMethod,
                    paymentDate: new Date(paymentDate),
                },
            });

            // 4. Update the parent CustomerPayable record's amounts and status
            const newPaidAmountForPayable = (parseFloat(payable.paidAmount) || 0) + paymentAmount;
            const newPendingAmountForPayable = pendingAmount - paymentAmount;
            
            const updatedPayableRecord = await tx.customerPayable.update({
                where: { id: payableId },
                data: {
                    paidAmount: newPaidAmountForPayable,
                    pendingAmount: newPendingAmountForPayable,
                    status: newPendingAmountForPayable < 0.01 ? 'PAID' : 'PENDING',
                },
                include: { settlements: true } // Include settlements for return object
            });

            // 5. Recalculate Booking's comprehensive Total Received and Balance from scratch
            // --- Sum of all payments received from customer ---
            const totalInitialPayments = (currentBooking.initialPayments || []).reduce((sum, p) => sum + p.amount, 0);
            const totalInstalmentPayments = (currentBooking.instalments || []).reduce((sum, inst) => 
                sum + (inst.payments || []).reduce((pSum, p) => pSum + p.amount, 0), 0);
            
            // Re-fetch customer payables settlements to include the one just made
            const allCustomerPayableSettlements = await tx.customerPayableSettlement.findMany({
                where: { customerPayable: { bookingId: currentBooking.id } }
            });
            const totalCustomerPayableSettlements = allCustomerPayableSettlements.reduce((sum, s) => sum + s.amount, 0);
            
            const newTotalReceived = totalInitialPayments + totalInstalmentPayments + totalCustomerPayableSettlements;
            const newBalance = (currentBooking.revenue || 0) - newTotalReceived;

            // Store old balance for audit log
            const oldBookingBalance = currentBooking.balance;

            // 6. Update the main Booking record with new balance and last payment date
            const updatedBookingRecord = await tx.booking.update({
                where: { id: currentBooking.id },
                data: {
                    balance: newBalance,
                    lastPaymentDate: new Date(paymentDate), // Update last payment date
                }
            });

            // 7. Create Audit Logs
            await createAuditLog(tx, {
                userId,
                modelName: 'CustomerPayable',
                recordId: payable.id,
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [{
                    fieldName: 'payableStatus',
                    oldValue: payable.status,
                    newValue: updatedPayableRecord.status
                },
                {
                    fieldName: 'customerPayableSettled',
                    oldValue: `Pending: ${pendingAmount.toFixed(2)}`,
                    newValue: `Paid: ${paymentAmount.toFixed(2)} (New Pending: ${newPendingAmountForPayable.toFixed(2)})`
                }]
            });

            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: currentBooking.id,
                action: ActionType.SETTLEMENT_PAYMENT,
                changes: [{
                    fieldName: 'balance',
                    oldValue: oldBookingBalance !== undefined ? oldBookingBalance.toFixed(2) : 'N/A',
                    newValue: newBalance.toFixed(2)
                }]
            });

            // 8. Return a useful payload for frontend state update
            return { updatedPayable: updatedPayableRecord, bookingUpdate: { id: updatedBookingRecord.id, balance: updatedBookingRecord.balance, received: newTotalReceived.toFixed(2) } };
        }, {
            timeout: 10000 // Increase transaction timeout to 10 seconds
        }); // End of prisma.$transaction

        return apiResponse.success(res, result, 201);

    } catch (error) {
        console.error("Error settling customer payable:", error);
        if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
        if (error.message.includes('exceeds pending balance')) return apiResponse.error(res, error.message, 400);
        if (error.message.includes('Invalid')) return apiResponse.error(res, error.message, 400); // Catch explicit validation errors
        if (error.name === 'PrismaClientValidationError') return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
        return apiResponse.error(res, `Failed to settle payable: ${error.message}`, 500);
    }
};

const recordPassengerRefund = async (req, res) => {
    const { id: userId } = req.user;
    const cancellationId = parseInt(req.params.id);
    const { amount, transactionMethod, refundDate } = req.body;

    try {
        const parsedAmount = parseFloat(amount);

        // 1. Validation
        if (isNaN(cancellationId)) {
            return apiResponse.error(res, 'Invalid Cancellation ID', 400);
        }
        if (isNaN(parsedAmount) || parsedAmount <= 0) {
            return apiResponse.error(res, 'Refund amount must be a positive number', 400);
        }
        if (!transactionMethod || !refundDate) {
            return apiResponse.error(res, 'Missing transactionMethod or refundDate', 400);
        }
        if (isNaN(new Date(refundDate).getTime())) {
            return apiResponse.error(res, 'Invalid refund date', 400);
        }
        const validTransactionMethods = ['LOYDS', 'STRIPE', 'WISE', 'HUMM', 'CREDIT', 'BANK_TRANSFER']; // Removed CREDIT_NOTES as not typically used for customer refunds
        if (!validTransactionMethods.includes(transactionMethod)) {
          return apiResponse.error(res, `Invalid transactionMethod. Must be one of: ${validTransactionMethods.join(', ')}`, 400);
        }

        const result = await prisma.$transaction(async (tx) => {
            // 2. Fetch the cancellation and its original booking with all related financial transactions
            const cancellation = await tx.cancellation.findUnique({
                where: { id: cancellationId },
                include: {
                    originalBooking: {
                        include: {
                            initialPayments: true,
                            instalments: { include: { payments: true } },
                            customerPayables: { include: { settlements: true } },
                            cancellation: { // Include cancellation itself to get all refund payments
                                include: {
                                    refundPayment: true
                                }
                            }
                        }
                    }
                }
            });

            if (!cancellation) {
                throw new Error('Cancellation record not found.');
            }
            if (!cancellation.originalBooking) {
                throw new Error('Original booking for this cancellation not found.');
            }
            if (cancellation.refundStatus === 'PAID') {
                throw new Error('This refund has already been paid.');
            }
            // Basic check: ensure the payment amount doesn't exceed the refundToPassenger amount
            if (parsedAmount > (cancellation.refundToPassenger || 0) + 0.01) { // Added (cancellation.refundToPassenger || 0) for safety
                throw new Error(`Refund amount (£${parsedAmount.toFixed(2)}) exceeds the amount owed to passenger (£${(cancellation.refundToPassenger || 0).toFixed(2)}).`);
            }

            const originalBooking = cancellation.originalBooking;

            // 3. Create the PassengerRefundPayment record
            const refundPayment = await tx.passengerRefundPayment.create({
                data: {
                    cancellationId: cancellationId,
                    amount: parsedAmount,
                    transactionMethod,
                    refundDate: new Date(refundDate),
                },
            });

            // 4. Update the Cancellation status to 'PAID'
            await tx.cancellation.update({
                where: { id: cancellationId },
                data: { refundStatus: 'PAID' },
            });

            // 5. Recalculate the Original Booking's Total Received and Balance (Comprehensive)

            // Sum all initial payments received
            const totalInitialPayments = (originalBooking.initialPayments || []).reduce((sum, p) => sum + p.amount, 0);

            // Sum all payments made to all instalments
            const totalInstalmentPayments = (originalBooking.instalments || []).reduce((sum, inst) => 
                sum + (inst.payments || []).reduce((pSum, p) => pSum + p.amount, 0), 0);

            // Sum all customer payable settlements (money received for cancellation debts)
            const totalCustomerPayableSettlements = (originalBooking.customerPayables || []).reduce((sum, payable) => 
                sum + (payable.settlements || []).reduce((sSum, s) => sSum + s.amount, 0), 0);
            
            // Sum all passenger refund payments (money paid OUT to customer)
            // Need to re-fetch cancellation and its refunds to include the one just made
            const allPassengerRefundsForBooking = await tx.passengerRefundPayment.findMany({
                where: { cancellation: { originalBookingId: originalBooking.id } }
            });
            const totalPassengerRefundsPaid = (allPassengerRefundsForBooking || []).reduce((sum, rp) => sum + rp.amount, 0);


            // newTotalReceived is the net amount received from the customer
            const newTotalReceived = totalInitialPayments + totalInstalmentPayments + totalCustomerPayableSettlements - totalPassengerRefundsPaid;
            const newBalance = (originalBooking.revenue || 0) - newTotalReceived;

            // Store old balance for audit log
            const oldBookingBalance = originalBooking.balance;

            // 6. Update the main Booking record with new balance and last payment date
            const updatedBookingRecord = await tx.booking.update({
                where: { id: originalBooking.id },
                data: {
                    balance: newBalance,
                    lastPaymentDate: new Date(refundDate), // Update last payment date (as money moved)
                }
            });

            // 7. Create Audit Logs
            await createAuditLog(tx, {
                userId,
                modelName: 'Cancellation',
                recordId: cancellation.id,
                action: ActionType.UPDATE, // Action on the cancellation record
                changes: [{
                    fieldName: 'refundStatus',
                    oldValue: cancellation.refundStatus,
                    newValue: 'PAID'
                },
                {
                    fieldName: 'passengerRefundPayment',
                    oldValue: `Owed: ${(cancellation.refundToPassenger || 0).toFixed(2)}`, // <-- FIX APPLIED HERE
                    newValue: `Paid: ${parsedAmount.toFixed(2)} via ${transactionMethod}`
                }]
            });

            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: originalBooking.id,
                action: ActionType.REFUND_PAYMENT, // Specific action for booking
                changes: [{
                    fieldName: 'balance',
                    oldValue: typeof oldBookingBalance === 'number' ? oldBookingBalance.toFixed(2) : 'N/A', // <-- FIX APPLIED HERE
                    newValue: newBalance.toFixed(2)
                }]
            });

            // 8. Return a useful payload for frontend state update
            return { refundPayment: refundPayment, bookingUpdate: { id: updatedBookingRecord.id, balance: updatedBookingRecord.balance, received: newTotalReceived.toFixed(2) } };
        }, {
            timeout: 10000 // Increase transaction timeout to 10 seconds
        }); // End of prisma.$transaction

        return apiResponse.success(res, result, 201);
    } catch (error) {
        console.error("Error recording passenger refund:", error);
        if (error.message.includes('not found') || error.message.includes('already been paid') || error.message.includes('exceeds the amount owed')) {
            return apiResponse.error(res, error.message, 400);
        }
        if (error.message.includes('Invalid')) return apiResponse.error(res, error.message, 400); // Catch explicit validation errors
        if (error.name === 'PrismaClientValidationError') return apiResponse.error(res, `Invalid data provided: ${error.message}`, 400);
        return apiResponse.error(res, `Failed to record refund: ${error.message}`, 500);
    }
};


const voidBooking = async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const { reason } = req.body;
    const { id: userId } = req.user;

    // 1. Validation
    if (isNaN(bookingId)) {
        return apiResponse.error(res, 'Invalid booking ID', 400);
    }
    if (!reason || typeof reason !== 'string' || reason.trim() === '') {
        return apiResponse.error(res, 'A reason (string) is required to void a booking.', 400);
    }

    try {
        const updatedBooking = await prisma.$transaction(async (tx) => {
            const bookingToVoid = await tx.booking.findUnique({ where: { id: bookingId } });

            if (!bookingToVoid) {
                throw new Error('Booking not found');
            }
            if (bookingToVoid.bookingStatus === 'VOID') {
                throw new Error('Booking is already voided');
            }
            if (bookingToVoid.bookingStatus === 'CANCELLED') {
                // Prevent voiding a cancelled booking, as cancellation has its own audit trail and financial implications
                throw new Error('Cannot void a cancelled booking. Consider "unvoiding" it first if intent is to modify, or use cancellation reversal if applicable.');
            }

            // Store old status and financial values for audit
            const oldBookingStatus = bookingToVoid.bookingStatus;
            const oldVoidReason = bookingToVoid.voidReason; // Will be null usually
            const oldVoidedAt = bookingToVoid.voidedAt;
            const oldVoidedById = bookingToVoid.voidedById;


            const voidedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    bookingStatus: 'VOID',
                    statusBeforeVoid: oldBookingStatus, // Store the original status
                    voidReason: reason.trim(), // Trim whitespace
                    voidedAt: new Date(),
                    voidedById: userId,
                },
            });

            // 2. Audit Log
            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: voidedBooking.id,
                action: ActionType.VOID_BOOKING,
                changes: [
                    { fieldName: 'bookingStatus', oldValue: oldBookingStatus, newValue: 'VOID' },
                    { fieldName: 'statusBeforeVoid', oldValue: oldBookingStatus, newValue: oldBookingStatus }, // Log that it was saved
                    { fieldName: 'voidReason', oldValue: oldVoidReason, newValue: reason.trim() },
                    { fieldName: 'voidedAt', oldValue: oldVoidedAt?.toISOString() || null, newValue: voidedBooking.voidedAt.toISOString() },
                    { fieldName: 'voidedById', oldValue: oldVoidedById, newValue: userId },
                ],
            });

            // Financial impact: When voiding, the booking is essentially "inactive" for new financial flows.
            // The existing balance and profit are kept as is for historical reference.
            // Any reporting or dashboards would typically filter out or explicitly handle 'VOID' bookings.

            return voidedBooking;
        }, {
            timeout: 10000 // Increase transaction timeout to 10 seconds
        });

        return apiResponse.success(res, updatedBooking, 200, "Booking voided successfully.");
    } catch (error) {
        console.error("Error voiding booking:", error);
        if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
        if (error.message.includes('already voided') || error.message.includes('Cannot void a cancelled booking')) return apiResponse.error(res, error.message, 409); // Conflict for already voided/cancelled
        return apiResponse.error(res, `Failed to void booking: ${error.message}`, 500);
    }
};

const unvoidBooking = async (req, res) => {
    const bookingId = parseInt(req.params.id);
    const { id: userId } = req.user;

    // 1. Validation
    if (isNaN(bookingId)) {
        return apiResponse.error(res, 'Invalid booking ID', 400);
    }

    try {
        const updatedBooking = await prisma.$transaction(async (tx) => {
            const bookingToUnvoid = await tx.booking.findUnique({ where: { id: bookingId } });

            if (!bookingToUnvoid) {
                throw new Error('Booking not found');
            }
            if (bookingToUnvoid.bookingStatus !== 'VOID') {
                throw new Error('Booking is not voided');
            }
            if (!bookingToUnvoid.statusBeforeVoid) {
                throw new Error('Cannot unvoid: original status is unknown. Data integrity error.');
            }

            // Store old status and void-related fields for audit
            const oldBookingStatus = bookingToUnvoid.bookingStatus; // 'VOID'
            const oldStatusBeforeVoid = bookingToUnvoid.statusBeforeVoid;
            const oldVoidReason = bookingToUnvoid.voidReason;
            const oldVoidedAt = bookingToUnvoid.voidedAt;
            const oldVoidedById = bookingToUnvoid.voidedById;

            const unvoidedBooking = await tx.booking.update({
                where: { id: bookingId },
                data: {
                    bookingStatus: bookingToUnvoid.statusBeforeVoid, // Restore original status
                    statusBeforeVoid: null, // Clear void-related fields
                    voidReason: null,
                    voidedAt: null,
                    voidedById: null,
                },
            });

            // 2. Audit Log
            await createAuditLog(tx, {
                userId,
                modelName: 'Booking',
                recordId: unvoidedBooking.id,
                action: ActionType.UNVOID_BOOKING,
                changes: [
                    { fieldName: 'bookingStatus', oldValue: oldBookingStatus, newValue: unvoidedBooking.bookingStatus },
                    { fieldName: 'statusBeforeVoid', oldValue: oldStatusBeforeVoid, newValue: null },
                    { fieldName: 'voidReason', oldValue: oldVoidReason, newValue: null },
                    { fieldName: 'voidedAt', oldValue: oldVoidedAt?.toISOString() || null, newValue: null },
                    { fieldName: 'voidedById', oldValue: oldVoidedById, newValue: null },
                ],
            });

            // Financial impact: Restoring status doesn't change core financials.
            // The booking's original balance and profit are simply now active again.

            return unvoidedBooking;
        }, {
            timeout: 10000 // Increase transaction timeout to 10 seconds
        });

        return apiResponse.success(res, updatedBooking, 200, "Booking has been restored.");
    } catch (error) {
        console.error("Error unvoiding booking:", error);
        if (error.message.includes('not found')) return apiResponse.error(res, error.message, 404);
        if (error.message.includes('not voided') || error.message.includes('original status is unknown')) return apiResponse.error(res, error.message, 409); // Conflict for not voided
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