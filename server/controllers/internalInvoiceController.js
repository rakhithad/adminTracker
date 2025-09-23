// server/controllers/internalInvoiceController.js
const { PrismaClient, ActionType } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');
const { createAuditLog } = require('../utils/auditLogger');
const { createCommissionPaymentPdf } = require('../utils/commissionPdfService');

// Get data for the main report table
const getInternalInvoicingReport = async (req, res) => {
    try {
        const bookings = await prisma.booking.findMany({
            // We fetch all bookings, including cancelled ones
            include: {
                internalInvoices: true,
                cancellation: true, // Crucially, include the cancellation data
            },
            orderBy: { pcDate: 'desc' },
        });

        // Transform the data into a unified structure for the frontend
        const reportData = bookings.map(booking => {
            // Case 1: The booking is cancelled and has a cancellation record
            if (booking.cancellation) {
                return {
                    // Spread the original booking data
                    ...booking,
                    // Overwrite profit with the final profit or loss from the cancellation
                    profit: booking.cancellation.profitOrLoss,
                    // Cancellations have no commission concept in this report
                    commissionAmount: null,
                    totalInvoiced: 0,
                    // Ensure internalInvoices is an empty array to prevent frontend errors
                    internalInvoices: [], 
                };
            } 
            // Case 2: It's a regular, active booking
            else {
                const totalInvoiced = booking.internalInvoices.reduce((sum, invoice) => sum + invoice.amount, 0);
                return {
                    ...booking,
                    totalInvoiced,
                };
            }
        });

        return apiResponse.success(res, reportData);
    } catch (error) {
        console.error("Error fetching internal invoicing report:", error);
        return apiResponse.error(res, "Failed to fetch report: " + error.message, 500);
    }
};

// Create a new internal invoice record for a booking
const createInternalInvoice = async (req, res) => {
    const { bookingId, amount, invoiceDate, commissionAmount } = req.body;
    const { id: userId } = req.user;

    try {
        // --- Database Transaction ---
        const { newInvoice, updatedBooking } = await prisma.$transaction(async (tx) => {
            let bookingToUpdate = await tx.booking.findUnique({ where: { id: parseInt(bookingId) } });

            // If commissionAmount is passed, this is the first invoice. Update the booking.
            if (commissionAmount !== undefined && commissionAmount !== null) {
                bookingToUpdate = await tx.booking.update({
                    where: { id: parseInt(bookingId) },
                    data: { commissionAmount: parseFloat(commissionAmount) },
                });
                // Audit this initial setting action
                await createAuditLog(tx, {
                    userId, modelName: 'Booking', recordId: bookingToUpdate.id, action: ActionType.UPDATE_COMMISSION_AMOUNT,
                    fieldName: 'commissionAmount', oldValue: null, newValue: commissionAmount
                });
            }
            
            const createdInvoice = await tx.internalInvoice.create({
                data: {
                    bookingId: parseInt(bookingId), amount: parseFloat(amount),
                    invoiceDate: new Date(invoiceDate), createdById: userId,
                },
            });
            await createAuditLog(tx, {
                userId, modelName: 'InternalInvoice', recordId: createdInvoice.id,
                action: ActionType.CREATE_INTERNAL_INVOICE, newValue: `Created invoice of £${amount}`
            });
            return { newInvoice: createdInvoice, updatedBooking: bookingToUpdate };
        });

        // --- PDF Generation ---
        // After transaction, fetch the final state to get an accurate total
        const finalBookingState = await prisma.booking.findUnique({
            where: { id: parseInt(bookingId) },
            include: { internalInvoices: true }
        });
        const totalInvoiced = finalBookingState.internalInvoices.reduce((sum, inv) => sum + inv.amount, 0);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=commission-receipt-${finalBookingState.folderNo}-${newInvoice.id}.pdf`);

        createCommissionPaymentPdf(
            finalBookingState,
            newInvoice,
            totalInvoiced,
            (chunk) => res.write(chunk),
            () => res.end()
        );
    } catch (error) {
        console.error("Error creating internal invoice:", error);
        // Can't send JSON here as headers are already set for PDF, so just end the response.
        if (!res.headersSent) {
            return apiResponse.error(res, "Failed to create invoice: " + error.message, 500);
        }
    }
};

// Update an existing internal invoice record
const updateInternalInvoice = async (req, res) => {
    const { invoiceId } = req.params;
    const { amount, invoiceDate } = req.body;
    const { id: userId } = req.user;

    try {
        const updatedInvoice = await prisma.$transaction(async (tx) => {
            const originalInvoice = await tx.internalInvoice.findUnique({ where: { id: parseInt(invoiceId) } });
            if (!originalInvoice) throw new Error("Invoice not found");

            const changes = [];
            if (amount && parseFloat(amount) !== originalInvoice.amount) changes.push({ fieldName: 'amount', oldValue: originalInvoice.amount, newValue: amount });
            if (invoiceDate && new Date(invoiceDate).toISOString() !== originalInvoice.invoiceDate.toISOString()) changes.push({ fieldName: 'invoiceDate', oldValue: originalInvoice.invoiceDate, newValue: invoiceDate });

            const invoice = await tx.internalInvoice.update({
                where: { id: parseInt(invoiceId) },
                data: {
                    amount: parseFloat(amount),
                    invoiceDate: new Date(invoiceDate),
                },
            });

            // Create audit log for each change
            for (const change of changes) {
                await createAuditLog(tx, {
                    userId,
                    modelName: 'InternalInvoice',
                    recordId: invoice.id,
                    action: ActionType.UPDATE_INTERNAL_INVOICE,
                    ...change
                });
            }
            return invoice;
        });
        return apiResponse.success(res, updatedInvoice, 200, "Internal invoice updated.");
    } catch (error) {
        console.error("Error updating internal invoice:", error);
        return apiResponse.error(res, "Failed to update invoice: " + error.message, 500);
    }
};

// Get the full invoice history for one specific booking
const getInvoiceHistoryForBooking = async (req, res) => {
    const { bookingId } = req.params;
    try {
        const history = await prisma.internalInvoice.findMany({
            where: { bookingId: parseInt(bookingId) },
            include: { createdBy: { select: { firstName: true, lastName: true } } },
            orderBy: { invoiceDate: 'desc' },
        });
        return apiResponse.success(res, history);
    } catch (error) {
        console.error("Error fetching invoice history:", error);
        return apiResponse.error(res, "Failed to fetch history: " + error.message, 500);
    }
};


const downloadInvoicePdf = async (req, res) => {
    const { invoiceId } = req.params;

    try {
        const targetInvoice = await prisma.internalInvoice.findUnique({
            where: { id: parseInt(invoiceId) },
        });

        if (!targetInvoice) {
            return apiResponse.error(res, "Invoice record not found", 404);
        }

        const booking = await prisma.booking.findUnique({
            where: { id: targetInvoice.bookingId },
            include: { internalInvoices: { orderBy: { createdAt: 'asc' } } } // Order is important
        });

        // Calculate the "totalInvoiced" state AS IT WAS when this invoice was created
        let totalInvoicedAtTheTime = 0;
        for (const inv of booking.internalInvoices) {
            totalInvoicedAtTheTime += inv.amount;
            if (inv.id === targetInvoice.id) {
                break; // Stop summing once we reach the target invoice
            }
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=commission-receipt-${booking.folderNo}-${targetInvoice.id}.pdf`);

        createCommissionPaymentPdf(
            booking,
            targetInvoice,
            totalInvoicedAtTheTime,
            (chunk) => res.write(chunk),
            () => res.end()
        );

    } catch (error) {
        console.error("Error downloading invoice PDF:", error);
        if (!res.headersSent) {
            return apiResponse.error(res, "Failed to download PDF: " + error.message, 500);
        }
    }
};




module.exports = {
    getInternalInvoicingReport,
    createInternalInvoice,
    updateInternalInvoice,
    getInvoiceHistoryForBooking,
    downloadInvoicePdf,
};