// server/utils/supplierReportPdfService.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-GB') : 'N/A';

// --- Report 1: Detailed Supplier Statement ---
function createSupplierStatementPdf(supplierName, data, filters, callback, endCallback) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.on('data', callback);
    doc.on('end', endCallback);

    // Header

    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
        if (fs.existsSync(logoPath)) {
            doc.image(logoPath, (doc.page.width - 120) / 2, 30, { width: 120 });
            doc.moveDown(3);
        }

    doc.moveDown(5);
    doc.fontSize(18).font('Helvetica-Bold').text('Supplier Statement', { align: 'center' });
    doc.fontSize(12).font('Helvetica-Bold').text(supplierName, { align: 'center' });
    doc.moveDown(0.5);
    doc.fontSize(10).font('Helvetica');
    if (filters.startDate && filters.endDate) doc.text(`Period: ${formatDate(filters.startDate)} to ${formatDate(filters.endDate)}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    const bookingsPending = data.processedTransactions.reduce((sum, t) => sum + t.pending, 0);
    const payablesPending = data.payables.reduce((sum, p) => sum + p.pendingAmount, 0);
    
    doc.font('Helvetica-Bold').fontSize(12).text('Account Summary');
    doc.rect(doc.x, doc.y, doc.page.width - 80, 40).stroke();
    doc.fontSize(10);
    doc.text(`Pending from Bookings: £${bookingsPending.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.text(`Pending from Payables: £${payablesPending.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.font('Helvetica-Bold').text(`Total Outstanding Balance: £${data.totalPending.toFixed(2)}`, { align: 'right' });
    doc.moveDown(3);

    // Details Tables
    const drawTable = (title, headers, rows) => {
        doc.font('Helvetica-Bold').fontSize(12).text(title);
        const tableTop = doc.y + 10;
        const columnWidths = [60, 80, 80, 140, 60, 60, 60];
        let currentX = 40;
        doc.fontSize(8);
        headers.forEach((h, i) => { doc.text(h, currentX, tableTop, { width: columnWidths[i] }); currentX += columnWidths[i]; });
        doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
        doc.font('Helvetica');
        rows.forEach(row => {
            let rowY = doc.y + 5;
            currentX = 40;
            row.forEach((cell, i) => { doc.text(cell, currentX, rowY, { width: columnWidths[i] }); currentX += columnWidths[i]; });
            doc.moveTo(40, doc.y + 15).lineTo(doc.page.width - 40, doc.y + 15).stroke();
        });
        doc.moveDown(3);
    };

    drawTable('Booking-Related Costs',
        ['Date', 'Folder #', 'Ref #', 'Category', 'Total', 'Paid', 'Pending'],
        data.processedTransactions.map(t => [formatDate(t.date), t.folderNo, t.identifier, t.category, `£${t.total.toFixed(2)}`, `£${t.paid.toFixed(2)}`, `£${t.pending.toFixed(2)}`])
    );
    
    doc.end();
}

// --- Report 2: Aged Payables Summary for All Suppliers ---
function createAgedPayablesSummaryPdf(data, callback, endCallback) {
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.on('data', callback);
    doc.on('end', endCallback);

    doc.fontSize(18).font('Helvetica-Bold').text('Payables & Supplier Balances', { align: 'center' });
    doc.moveDown(2);

    const tableTop = doc.y + 10;
    const headers = ['Supplier', 'Pending (Bookings)', 'Pending (Payables)', 'Total Outstanding'];
    const columnWidths = [150, 130, 130, 120];
    let currentX = 40;
    doc.fontSize(10).font('Helvetica-Bold');
    headers.forEach((h, i) => { doc.text(h, currentX, tableTop, { width: columnWidths[i] }); currentX += columnWidths[i]; });
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();

    doc.font('Helvetica').fontSize(9);
    Object.entries(data).forEach(([supplierName, supplierData]) => {
        const bookingsPending = supplierData.processedTransactions.reduce((sum, t) => sum + t.pending, 0);
        const payablesPending = supplierData.payables.reduce((sum, p) => sum + p.pendingAmount, 0);
        const row = [supplierName, `£${bookingsPending.toFixed(2)}`, `£${payablesPending.toFixed(2)}`, `£${supplierData.totalPending.toFixed(2)}`];
        
        let rowY = doc.y + 5;
        currentX = 40;
        row.forEach((cell, i) => { doc.text(cell, currentX, rowY, { width: columnWidths[i], font: i === 3 ? 'Helvetica-Bold' : 'Helvetica' }); currentX += columnWidths[i]; });
        doc.moveTo(40, doc.y + 15).lineTo(doc.page.width - 40, doc.y + 15).stroke();
    });

    doc.end();
}

module.exports = { createSupplierStatementPdf, createAgedPayablesSummaryPdf };