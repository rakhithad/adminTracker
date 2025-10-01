const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient(); // THIS LINE IS NOW CORRECTED
const apiResponse = require('../utils/apiResponse');
const { createSupplierStatementPdf, createAgedPayablesSummaryPdf } = require('../utils/supplierReportPdfService');

const generateSupplierReportPdf = async (req, res) => {
    const { supplier, startDate, endDate } = req.body;

    try {
        const supplierSummary = {};

        const ensureSupplier = (supplierName) => {
            if (!supplierSummary[supplierName]) {
                supplierSummary[supplierName] = {
                    totalAmount: 0, totalPaid: 0, totalPending: 0,
                    transactions: [], payables: [], processedTransactions: [],
                };
            }
        };

        const bookingsWithCostItems = await prisma.booking.findMany({
            select: { id: true, refNo: true, bookingStatus: true, folderNo: true, costItems: { select: { category: true, suppliers: { select: { id: true, supplier: true, amount: true, paidAmount: true, pendingAmount: true, createdAt: true, }, }, }, }, },
        });

        bookingsWithCostItems.forEach((booking) => {
            booking.costItems.forEach((item) => {
                item.suppliers.forEach((s) => {
                    ensureSupplier(s.supplier);
                    supplierSummary[s.supplier].transactions.push({
                        type: "Booking",
                        data: { ...s, folderNo: booking.folderNo, refNo: booking.refNo, category: item.category, bookingStatus: booking.bookingStatus, pendingAmount: booking.bookingStatus === "CANCELLED" ? 0 : s.pendingAmount, },
                    });
                });
            });
        });

        const allCreditNotes = await prisma.supplierCreditNote.findMany({
            include: { generatedFromCancellation: { include: { originalBooking: { select: { refNo: true } } } }, usageHistory: { include: { usedOnCostItemSupplier: { include: { costItem: { include: { booking: { select: { refNo: true } } } } } }, }, }, },
        });

        allCreditNotes.forEach((note) => {
            if (note.supplier) {
                ensureSupplier(note.supplier);
                const modifiedUsageHistory = note.usageHistory.map(usage => ({ ...usage, usedOnRefNo: usage.usedOnCostItemSupplier?.costItem?.booking?.refNo || "N/A", }));
                supplierSummary[note.supplier].transactions.push({ type: "CreditNote", data: { ...note, usageHistory: modifiedUsageHistory, generatedFromRefNo: note.generatedFromCancellation?.originalBooking?.refNo || "N/A", }, });
            }
        });

        const allPayables = await prisma.supplierPayable.findMany({
            include: { createdFromCancellation: { select: { originalBooking: { select: { folderNo: true } } } } },
        });

        allPayables.forEach((payable) => {
            if (payable.supplier) {
                ensureSupplier(payable.supplier);
                supplierSummary[payable.supplier].payables.push({ ...payable, originatingFolderNo: payable.createdFromCancellation?.originalBooking?.folderNo || "N/A", });
            }
        });

        for (const supplierName in supplierSummary) {
            const supplier = supplierSummary[supplierName];
            const bookingTotals = supplier.transactions.filter((t) => t.type === "Booking").reduce((acc, tx) => {
                acc.totalAmount += tx.data.amount || 0;
                acc.totalPaid += tx.data.paidAmount || 0;
                acc.totalPending += tx.data.pendingAmount || 0;
                return acc;
            }, { totalAmount: 0, totalPaid: 0, totalPending: 0 });

            const payablesPending = supplier.payables.reduce((sum, p) => sum + p.pendingAmount, 0);
            supplier.totalAmount = bookingTotals.totalAmount;
            supplier.totalPaid = bookingTotals.totalPaid;
            supplier.totalPending = bookingTotals.totalPending + payablesPending;

            const creditNoteMap = (supplier.transactions || []).filter(tx => tx.type === 'CreditNote').reduce((map, tx) => {
                if (tx.data.generatedFromRefNo && tx.data.generatedFromRefNo !== 'N/A') map[tx.data.generatedFromRefNo] = tx.data;
                return map;
            }, {});
            const processedBookings = (supplier.transactions || []).filter(tx => tx.type === 'Booking').map(tx => {
                const booking = tx.data;
                return {
                    uniqueId: `booking-${booking.id}`, type: 'Booking', folderNo: booking.folderNo, identifier: booking.refNo, category: booking.category,
                    total: booking.amount || 0, paid: booking.paidAmount || 0, pending: booking.pendingAmount || 0,
                    creditNote: creditNoteMap[booking.refNo] || null, date: booking.createdAt, status: booking.bookingStatus,
                    originalData: booking, linkedPayable: null
                };
            });
            const payablesWithFolder = (supplier.payables || []).map(p => ({ ...p, baseFolderNo: p.originatingFolderNo ? p.originatingFolderNo.toString().split('.')[0] : null }));
            const finalTransactions = processedBookings.map(booking => {
                const baseFolderNo = booking.folderNo.toString().split('.')[0];
                const linkedPayable = payablesWithFolder.find(p => p.baseFolderNo === baseFolderNo);
                return { ...booking, linkedPayable: linkedPayable || null };
            });
            finalTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
            supplier.processedTransactions = finalTransactions;
        }
        
        let finalData = supplierSummary;
        const filters = { startDate, endDate };

        if (supplier) {
            finalData = finalData[supplier] ? { [supplier]: finalData[supplier] } : {};
        }

        if (startDate || endDate) {
            const start = startDate ? new Date(startDate) : null;
            const end = endDate ? new Date(endDate) : null;
            if (end) end.setHours(23, 59, 59, 999);

            Object.keys(finalData).forEach(supplierName => {
                const supplierDetails = finalData[supplierName];
                supplierDetails.processedTransactions = supplierDetails.processedTransactions.filter(tx => {
                    const txDate = new Date(tx.date);
                    if (start && txDate < start) return false;
                    if (end && txDate > end) return false;
                    return true;
                });
            });
        }

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', 'attachment; filename=supplier-report.pdf');

        if (supplier && finalData[supplier]) {
            createSupplierStatementPdf(supplier, finalData[supplier], filters, (chunk) => res.write(chunk), () => res.end());
        } else {
            createAgedPayablesSummaryPdf(finalData, (chunk) => res.write(chunk), () => res.end());
        }

    } catch (error) {
        console.error("Error generating supplier report PDF:", error);
        if (!res.headersSent) {
            return apiResponse.error(res, `Failed to generate PDF: ${error.message}`, 500);
        }
    }
};

module.exports = { generateSupplierReportPdf };