// server/controllers/internalInvoiceController.js

const { PrismaClient, ActionType } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');
const { createAuditLog } = require('../utils/auditLogger');
const { createCommissionPaymentPdf } = require('../utils/commissionPdfService');
const { compareFolderNumbers } = require('../utils/sorting');
const { createCommissionSummaryPdf } = require('../utils/commissionSummaryPdfService');


const getInternalInvoicingReport = async (req, res) => {
    try {
        const allBookings = await prisma.booking.findMany({
            include: { internalInvoices: true },
        });
        const cancellations = await prisma.cancellation.findMany({
            include: {
                internalInvoices: true,
                originalBooking: { select: { agentName: true } },
            },
        });

        const transformedBookings = allBookings.map(b => ({
            id: b.id, recordType: 'booking', folderNo: b.folderNo, agentName: b.agentName,
            bookingStatus: b.bookingStatus, finalProfit: b.profit, commissionAmount: b.commissionAmount,
            accountingMonth: b.accountingMonth, totalInvoiced: b.internalInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        }));

        const transformedCancellations = cancellations.map(c => ({
            id: c.id, recordType: 'cancellation', folderNo: c.folderNo, agentName: c.originalBooking.agentName,
            bookingStatus: 'CANCELLATION_EVENT', finalProfit: c.adminFee, commissionAmount: c.commissionAmount,
            accountingMonth: c.accountingMonth, totalInvoiced: c.internalInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        }));

        const fullReport = [...transformedBookings, ...transformedCancellations];
        fullReport.sort((a, b) => compareFolderNumbers(a.folderNo, b.folderNo));

        return apiResponse.success(res, fullReport);
    } catch (error) {
        console.error("Error fetching unified internal invoicing report:", error);
        return apiResponse.error(res, "Failed to fetch report: " + error.message, 500);
    }
};

const createInternalInvoice = async (req, res) => {
    const { recordId, recordType, amount, invoiceDate, commissionAmount, commissionMonth } = req.body;
    const { id: userId } = req.user;

    try {
        let newInvoice;

        await prisma.$transaction(async (tx) => {
            const paymentDate = new Date(invoiceDate);
            const commMonthDate = new Date(`${commissionMonth}-01`);

            if (recordType === 'booking') {
                let booking = await tx.booking.findUnique({ where: { id: parseInt(recordId) } });
                if (commissionAmount !== undefined && booking.commissionAmount === null) {
                    await tx.booking.update({
                        where: { id: parseInt(recordId) },
                        data: { commissionAmount: parseFloat(commissionAmount) },
                    });
                }
                newInvoice = await tx.internalInvoice.create({
                    data: {
                        amount: parseFloat(amount),
                        invoiceDate: paymentDate,
                        commissionMonth: commMonthDate,
                        createdById: userId,
                        bookingId: booking.id
                    }
                });
            } else if (recordType === 'cancellation') {
                let cancellation = await tx.cancellation.findUnique({ where: { id: parseInt(recordId) } });
                if (commissionAmount !== undefined && cancellation.commissionAmount === null) {
                    await tx.cancellation.update({
                        where: { id: parseInt(recordId) },
                        data: { commissionAmount: parseFloat(commissionAmount) },
                    });
                }
                newInvoice = await tx.internalInvoice.create({
                    data: {
                        amount: parseFloat(amount),
                        invoiceDate: paymentDate,
                        commissionMonth: commMonthDate,
                        createdById: userId,
                        cancellationId: cancellation.id
                    }
                });
            } else {
                throw new Error("Invalid record type specified.");
            }
        });

        // Re-fetch the parent record to get the most up-to-date data for the PDF
        let parentRecordForPdf;
        if (recordType === 'booking') {
            parentRecordForPdf = await prisma.booking.findUnique({
                where: { id: parseInt(recordId) }, include: { internalInvoices: true }
            });
        } else {
            parentRecordForPdf = await prisma.cancellation.findUnique({
                where: { id: parseInt(recordId) }, include: { internalInvoices: true }
            });
        }

        const totalInvoiced = parentRecordForPdf.internalInvoices.reduce((sum, inv) => sum + inv.amount, 0);

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=commission-receipt-${parentRecordForPdf.folderNo}-${newInvoice.id}.pdf`);

        createCommissionPaymentPdf(
            parentRecordForPdf,
            newInvoice,
            totalInvoiced,
            (chunk) => res.write(chunk),
            () => res.end()
        );

    } catch (error) {
        console.error("Error creating internal invoice:", error);
        if (!res.headersSent) {
            return apiResponse.error(res, "Failed to create invoice: " + error.message, 500);
        }
    }
};


// --- THIS IS THE MISSING FUNCTION ---
const updateInternalInvoice = async (req, res) => {
    const { invoiceId } = req.params;
    // NEW: Destructure commissionMonth
    const { amount, invoiceDate, commissionMonth } = req.body;
    const { id: userId } = req.user;

    if (isNaN(parseInt(invoiceId))) {
        return apiResponse.error(res, "Invalid Invoice ID provided.", 400);
    }

    try {
        const updatedInvoice = await prisma.$transaction(async (tx) => {
            const originalInvoice = await tx.internalInvoice.findUnique({ where: { id: parseInt(invoiceId) } });
            if (!originalInvoice) throw new Error("Invoice not found");

            const changes = [];
            const dataToUpdate = {};
            
            if (amount && parseFloat(amount) !== originalInvoice.amount) {
                changes.push({ fieldName: 'amount', oldValue: originalInvoice.amount, newValue: amount });
                dataToUpdate.amount = parseFloat(amount);
            }
            if (invoiceDate && new Date(invoiceDate).toISOString() !== originalInvoice.invoiceDate.toISOString()) {
                changes.push({ fieldName: 'invoiceDate', oldValue: originalInvoice.invoiceDate, newValue: invoiceDate });
                dataToUpdate.invoiceDate = new Date(invoiceDate);
            }
            // NEW: Check and add commissionMonth to the update
            if (commissionMonth) {
                const newCommMonthDate = new Date(`${commissionMonth}-01`);
                if (newCommMonthDate.toISOString() !== originalInvoice.commissionMonth.toISOString()) {
                    changes.push({ fieldName: 'commissionMonth', oldValue: originalInvoice.commissionMonth, newValue: newCommMonthDate });
                    dataToUpdate.commissionMonth = newCommMonthDate;
                }
            }

            if (Object.keys(dataToUpdate).length === 0) {
                return originalInvoice; // No changes were made
            }

            const invoice = await tx.internalInvoice.update({
                where: { id: parseInt(invoiceId) },
                data: dataToUpdate,
            });

            for (const change of changes) {
                await createAuditLog(tx, {
                    userId, modelName: 'InternalInvoice', recordId: invoice.id,
                    action: ActionType.UPDATE_INTERNAL_INVOICE, ...change
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

// --- END OF MISSING FUNCTION ---

const getInvoiceHistoryForBooking = async (req, res) => {
    const { recordId, recordType } = req.params;
    
    try {
        if (!recordId || !recordType) {
            return apiResponse.error(res, "Record ID and Type are required.", 400);
        }

        const whereClause = recordType === 'booking'
            ? { bookingId: parseInt(recordId) }
            : { cancellationId: parseInt(recordId) };

        const history = await prisma.internalInvoice.findMany({
            where: whereClause,
            include: { createdBy: { select: { firstName: true, lastName: true } } },
            orderBy: { invoiceDate: 'desc' },
        });
        return apiResponse.success(res, history);
    } catch (error) {
        console.error("Error fetching invoice history:", error);
        return apiResponse.error(res, "Failed to fetch history: " + error.message, 500);
    }
};

// --- CORRECTED FUNCTION ---
const downloadInvoicePdf = async (req, res) => {
    const { invoiceId } = req.params;

    try {
        if (isNaN(parseInt(invoiceId))) {
            return apiResponse.error(res, "Invalid Invoice ID provided.", 400);
        }

        const targetInvoice = await prisma.internalInvoice.findUnique({
            where: { id: parseInt(invoiceId) },
        });
        if (!targetInvoice) return apiResponse.error(res, "Invoice record not found", 404);

        let parentRecord;
        let totalInvoicedAtTheTime = 0;

        if (targetInvoice.bookingId) {
            parentRecord = await prisma.booking.findUnique({
                where: { id: targetInvoice.bookingId },
                include: { internalInvoices: { orderBy: { createdAt: 'asc' } } }
            });
        } else if (targetInvoice.cancellationId) {
            parentRecord = await prisma.cancellation.findUnique({
                where: { id: targetInvoice.cancellationId },
                include: { internalInvoices: { orderBy: { createdAt: 'asc' } } }
            });
        } else {
            return apiResponse.error(res, "Invoice is not linked to a valid record.", 404);
        }
        
        for (const inv of parentRecord.internalInvoices) {
            totalInvoicedAtTheTime += inv.amount;
            if (inv.id === targetInvoice.id) break;
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=commission-receipt-${parentRecord.folderNo}-${targetInvoice.id}.pdf`);

        createCommissionPaymentPdf(
            parentRecord, targetInvoice, totalInvoicedAtTheTime,
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

// --- CORRECTED FUNCTION ---
const updateAccountingMonth = async (req, res) => {
    const { recordId, recordType, accountingMonth } = req.body;
    const { id: userId } = req.user;

    if (!recordId || !recordType || !accountingMonth) {
        return apiResponse.error(res, "Missing required fields.", 400);
    }

    try {
        let updatedRecord;
        const newMonthDate = new Date(accountingMonth);

        if (recordType === 'booking') {
            updatedRecord = await prisma.booking.update({
                where: { id: parseInt(recordId) },
                data: { accountingMonth: newMonthDate },
            });
        } else if (recordType === 'cancellation') {
            updatedRecord = await prisma.cancellation.update({
                where: { id: parseInt(recordId) },
                data: { accountingMonth: newMonthDate },
            });
        } else {
            return apiResponse.error(res, "Invalid record type provided.", 400);
        }

        return apiResponse.success(res, updatedRecord, 200, "Accounting month updated.");
    } catch (error) {
        console.error("Error updating accounting month:", error);
        return apiResponse.error(res, "Failed to update month: " + error.message, 500);
    }
};


const generateCommissionSummaryPdf = async (req, res) => {
    const { agent, month } = req.body; // Filters from the frontend

    try {
        const whereBookings = { cancellation: null };
        const whereCancellations = {};

        if (agent) {
            whereBookings.agentName = agent;
            whereCancellations.originalBooking = { agentName: agent };
        }
        
        // --- KEY FIX: Add month filtering directly to the database query ---
        if (month) {
            const startDate = new Date(`${month}-01`);
            const nextMonth = new Date(startDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            
            // Add date range condition to both where clauses
            const dateCondition = {
                gte: startDate,
                lt: nextMonth,
            };
            whereBookings.accountingMonth = dateCondition;
            whereCancellations.accountingMonth = dateCondition;
        }
        
        // The queries now include the month filter if provided
        const allBookings = await prisma.booking.findMany({
            where: whereBookings,
            include: { internalInvoices: true },
        });

        const allCancellations = await prisma.cancellation.findMany({
            where: whereCancellations,
            include: { internalInvoices: true, originalBooking: { select: { agentName: true } } },
        });

        // The transformation logic remains the same
        const transformedBookings = allBookings.map(b => ({
            id: b.id, recordType: 'booking', folderNo: b.folderNo, agentName: b.agentName,
            bookingStatus: b.bookingStatus, finalProfit: b.profit, commissionAmount: b.commissionAmount,
            accountingMonth: b.accountingMonth, totalInvoiced: b.internalInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        }));
        const transformedCancellations = allCancellations.map(c => ({
            id: c.id, recordType: 'cancellation', folderNo: c.folderNo, agentName: c.originalBooking.agentName,
            bookingStatus: 'CANCELLATION_EVENT', finalProfit: c.adminFee, commissionAmount: c.commissionAmount,
            accountingMonth: c.accountingMonth, totalInvoiced: c.internalInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        }));
        
        let fullReport = [...transformedBookings, ...transformedCancellations];
        fullReport.sort((a, b) => compareFolderNumbers(a.folderNo, b.folderNo));

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=commission-summary.pdf');

        createCommissionSummaryPdf(
            fullReport,
            { agent, month },
            (chunk) => res.write(chunk),
            () => res.end()
        );
    } catch (error) {
        console.error("Error generating commission summary PDF:", error);
        if (!res.headersSent) {
            return apiResponse.error(res, "Failed to generate PDF: " + error.message, 500);
        }
    }
};


module.exports = {
    getInternalInvoicingReport,
    createInternalInvoice,
    updateInternalInvoice, 
    getInvoiceHistoryForBooking,
    downloadInvoicePdf,
    updateAccountingMonth,
    generateCommissionSummaryPdf
};