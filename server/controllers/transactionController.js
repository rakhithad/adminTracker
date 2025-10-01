// server/controllers/transactionController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');
const { createTransactionReportPdf } = require('../utils/transactionReportPdfService');

// --- Gathers ALL data for the webpage display ---
const getTransactions = async (req, res) => {
    try {
        // --- This is your existing data-gathering logic ---
        const allInitialPayments = await prisma.initialPayment.findMany({ where: { bookingId: { not: null } }, include: { booking: { select: { refNo: true, paxName: true } } } });
        const instalmentPayments = await prisma.instalmentPayment.findMany({ include: { instalment: { select: { booking: { select: { refNo: true, paxName: true } } } } } });
        const creditNotesReceived = await prisma.supplierCreditNote.findMany({ select: { id: true, supplier: true, initialAmount: true, createdAt: true, generatedFromCancellation: { include: { originalBooking: { select: { refNo: true } } } } } });
        const adminFees = await prisma.cancellation.findMany({ where: { adminFee: { gt: 0 } }, include: { originalBooking: { select: { refNo: true } } } });
        const initialSupplierPayments = await prisma.costItemSupplier.findMany({ where: { paymentMethod: 'BANK_TRANSFER', costItemId: { not: null } }, include: { costItem: { include: { booking: { select: { refNo: true } } } } } });
        const supplierSettlements = await prisma.supplierPaymentSettlement.findMany({ where: { costItemSupplier: { costItemId: { not: null } } }, include: { costItemSupplier: { select: { supplier: true, costItem: { select: { booking: { select: { refNo: true } } } } } } } });
        const passengerRefunds = await prisma.passengerRefundPayment.findMany({ include: { cancellation: { include: { originalBooking: { select: { refNo: true, paxName: true } } } } } });

        const transactionsList = [];
        allInitialPayments.forEach(payment => { transactionsList.push({ id: `initialpay-${payment.id}`, type: 'Incoming', category: 'Initial Payment', date: payment.paymentDate, amount: payment.amount, bookingRefNo: payment.booking?.refNo || 'N/A', method: payment.transactionMethod, details: `From: ${payment.booking?.paxName || 'N/A'}` }); });
        instalmentPayments.forEach(payment => { transactionsList.push({ id: `inst-${payment.id}`, type: 'Incoming', category: 'Instalment', date: payment.paymentDate, amount: payment.amount, bookingRefNo: payment.instalment.booking.refNo, method: payment.transactionMethod, details: `From: ${payment.instalment.booking.paxName}` }); });
        creditNotesReceived.forEach(note => { transactionsList.push({ id: `cn-recv-${note.id}`, type: 'Incoming', category: 'Credit Note Received', date: note.createdAt, amount: note.initialAmount, bookingRefNo: note.generatedFromCancellation?.originalBooking?.refNo || 'N/A', method: 'Internal Credit', details: `From Supplier: ${note.supplier}` }); });
        adminFees.forEach(cancellation => { transactionsList.push({ id: `adminfee-${cancellation.id}`, type: 'Incoming', category: 'Admin Fee', date: cancellation.createdAt, amount: cancellation.adminFee, bookingRefNo: cancellation.originalBooking.refNo, method: 'Internal', details: `Cancellation Admin Fee` }); });
        initialSupplierPayments.forEach(payment => { transactionsList.push({ id: `supp-initial-${payment.id}`, type: 'Outgoing', category: 'Initial Supplier Pmt', date: payment.createdAt, amount: payment.amount, bookingRefNo: payment.costItem?.booking?.refNo || 'N/A', method: payment.transactionMethod, details: `To: ${payment.supplier}` }); });
        supplierSettlements.forEach(settlement => { transactionsList.push({ id: `supp-settle-${settlement.id}`, type: 'Outgoing', category: 'Supplier Settlement', date: settlement.settlementDate, amount: settlement.amount, bookingRefNo: settlement.costItemSupplier?.costItem?.booking?.refNo || 'N/A', method: settlement.transactionMethod, details: `To: ${settlement.costItemSupplier?.supplier || 'Unknown'}` }); });
        passengerRefunds.forEach(refund => { const c = refund.cancellation; transactionsList.push({ id: `refund-${refund.id}`, type: 'Outgoing', category: 'Passenger Refund', date: refund.refundDate, amount: refund.amount, bookingRefNo: c.originalBooking.refNo, method: refund.transactionMethod, details: `To: ${c.originalBooking.paxName}` }); });
        
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

// --- Gathers, FILTERS, and generates a PDF ---
const generateTransactionReportPdf = async (req, res) => {
    const { startDate, endDate, type } = req.body;

    try {
        // --- This section is a duplicate of the data-gathering logic from above ---
        const allInitialPayments = await prisma.initialPayment.findMany({ where: { bookingId: { not: null } }, include: { booking: { select: { refNo: true, paxName: true } } } });
        const instalmentPayments = await prisma.instalmentPayment.findMany({ include: { instalment: { select: { booking: { select: { refNo: true, paxName: true } } } } } });
        const creditNotesReceived = await prisma.supplierCreditNote.findMany({ select: { id: true, supplier: true, initialAmount: true, createdAt: true, generatedFromCancellation: { include: { originalBooking: { select: { refNo: true } } } } } });
        const adminFees = await prisma.cancellation.findMany({ where: { adminFee: { gt: 0 } }, include: { originalBooking: { select: { refNo: true } } } });
        const initialSupplierPayments = await prisma.costItemSupplier.findMany({ where: { paymentMethod: 'BANK_TRANSFER', costItemId: { not: null } }, include: { costItem: { include: { booking: { select: { refNo: true } } } } } });
        const supplierSettlements = await prisma.supplierPaymentSettlement.findMany({ where: { costItemSupplier: { costItemId: { not: null } } }, include: { costItemSupplier: { select: { supplier: true, costItem: { select: { booking: { select: { refNo: true } } } } } } } });
        const passengerRefunds = await prisma.passengerRefundPayment.findMany({ include: { cancellation: { include: { originalBooking: { select: { refNo: true, paxName: true } } } } } });

        const transactionsList = [];
        allInitialPayments.forEach(payment => { transactionsList.push({ id: `initialpay-${payment.id}`, type: 'Incoming', category: 'Initial Payment', date: payment.paymentDate, amount: payment.amount, bookingRefNo: payment.booking?.refNo || 'N/A', method: payment.transactionMethod, details: `From: ${payment.booking?.paxName || 'N/A'}` }); });
        instalmentPayments.forEach(payment => { transactionsList.push({ id: `inst-${payment.id}`, type: 'Incoming', category: 'Instalment', date: payment.paymentDate, amount: payment.amount, bookingRefNo: payment.instalment.booking.refNo, method: payment.transactionMethod, details: `From: ${payment.instalment.booking.paxName}` }); });
        creditNotesReceived.forEach(note => { transactionsList.push({ id: `cn-recv-${note.id}`, type: 'Incoming', category: 'Credit Note Received', date: note.createdAt, amount: note.initialAmount, bookingRefNo: note.generatedFromCancellation?.originalBooking?.refNo || 'N/A', method: 'Internal Credit', details: `From Supplier: ${note.supplier}` }); });
        adminFees.forEach(cancellation => { transactionsList.push({ id: `adminfee-${cancellation.id}`, type: 'Incoming', category: 'Admin Fee', date: cancellation.createdAt, amount: cancellation.adminFee, bookingRefNo: cancellation.originalBooking.refNo, method: 'Internal', details: `Cancellation Admin Fee` }); });
        initialSupplierPayments.forEach(payment => { transactionsList.push({ id: `supp-initial-${payment.id}`, type: 'Outgoing', category: 'Initial Supplier Pmt', date: payment.createdAt, amount: payment.amount, bookingRefNo: payment.costItem?.booking?.refNo || 'N/A', method: payment.transactionMethod, details: `To: ${payment.supplier}` }); });
        supplierSettlements.forEach(settlement => { transactionsList.push({ id: `supp-settle-${settlement.id}`, type: 'Outgoing', category: 'Supplier Settlement', date: settlement.settlementDate, amount: settlement.amount, bookingRefNo: settlement.costItemSupplier?.costItem?.booking?.refNo || 'N/A', method: settlement.transactionMethod, details: `To: ${settlement.costItemSupplier?.supplier || 'Unknown'}` }); });
        passengerRefunds.forEach(refund => { const c = refund.cancellation; transactionsList.push({ id: `refund-${refund.id}`, type: 'Outgoing', category: 'Passenger Refund', date: refund.refundDate, amount: refund.amount, bookingRefNo: c.originalBooking.refNo, method: refund.transactionMethod, details: `To: ${c.originalBooking.paxName}` }); });
        
        let allTransactions = transactionsList.filter(t => t && t.id);

        // --- APPLY FILTERS ---
        if (startDate && endDate) {
            const start = new Date(startDate);
            const end = new Date(endDate);
            allTransactions = allTransactions.filter(t => { const d = new Date(t.date); return d >= start && d <= end; });
        }
        if (type && type !== 'All') {
            allTransactions = allTransactions.filter(t => t.type === type);
        }

        allTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));

        const totalIncoming = allTransactions.filter(t => t.type === 'Incoming').reduce((sum, t) => sum + (t.amount || 0), 0);
        const totalOutgoing = allTransactions.filter(t => t.type === 'Outgoing').reduce((sum, t) => sum + (t.amount || 0), 0);
        const netBalance = totalIncoming - totalOutgoing;
        
        const totals = { incoming: totalIncoming, outgoing: totalOutgoing, netBalance: netBalance };
        const filters = { startDate, endDate, type };

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=transaction-report.pdf');

        createTransactionReportPdf(allTransactions, totals, filters, (chunk) => res.write(chunk), () => res.end());

    } catch (error) {
        console.error("Error generating transaction PDF:", error);
        if (!res.headersSent) {
            return apiResponse.error(res, "Failed to generate PDF: " + error.message, 500);
        }
    }
};

module.exports = {
    getTransactions,
    generateTransactionReportPdf,
};