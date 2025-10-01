// server/utils/transactionReportPdfService.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function createTransactionReportPdf(transactions, totals, filters, callback, endCallback) {
    const doc = new PDFDocument({ margin: 40, layout: 'portrait', size: 'A4' });
    doc.on('data', callback);
    doc.on('end', endCallback);

    // --- Header ---
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, (doc.page.width - 120) / 2, 30, { width: 120 }).moveDown(3);
    }

    doc.fontSize(18).font('Helvetica-Bold').text('Transaction Report', { align: 'center' }).moveDown(1);

    // --- Filters ---
    doc.fontSize(10).font('Helvetica');
    const formatDate = (d) => new Date(d).toLocaleDateString('en-GB');
    if (filters.startDate && filters.endDate) doc.text(`Date Range: ${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}`, { align: 'center' });
    if (filters.type && filters.type !== 'All') doc.text(`Type: ${filters.type}`, { align: 'center' });
    doc.text(`Generated On: ${formatDate(new Date())}`, { align: 'center' }).moveDown(2);

    // --- Summary Box ---
    doc.font('Helvetica-Bold').fontSize(12).text('Summary for Filtered Period');
    doc.rect(doc.x, doc.y, doc.page.width - 80, 55).stroke();
    doc.fontSize(10);
    doc.fillColor('green').text(`Total Incoming:  £${totals.incoming.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.fillColor('red').text(`Total Outgoing:   £${totals.outgoing.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.fillColor('black').font('Helvetica-Bold').text(`Net Balance:       £${totals.netBalance.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.moveDown(4);

    // --- Details Table ---
    doc.font('Helvetica-Bold').fontSize(12).text('Filtered Transactions');
    
    const tableTop = doc.y + 10;
    const tableHeaders = ['Date', 'Type', 'Category', 'Booking Ref', 'Details', 'Amount'];
    const columnWidths = [60, 60, 100, 80, 130, 60];
    let currentX = 40;

    doc.fontSize(8);
    tableHeaders.forEach((header, i) => {
        doc.text(header, currentX, tableTop, { width: columnWidths[i], align: 'left' });
        currentX += columnWidths[i];
    });
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    
    doc.font('Helvetica');
    transactions.forEach(t => {
        const rowData = [
            formatDate(t.date), t.type, t.category, t.bookingRefNo || 'N/A', t.details, `£${t.amount.toFixed(2)}`
        ];
        
        let rowY = doc.y + 5;
        currentX = 40;
        
        if (t.type === 'Incoming') doc.fillColor('green');
        else doc.fillColor('red');
        
        rowData.forEach((cell, i) => {
            doc.text(cell, currentX, rowY, { width: columnWidths[i], align: i === 5 ? 'right' : 'left' });
            currentX += columnWidths[i];
        });
        doc.fillColor('black');
        doc.moveTo(40, doc.y + 15).lineTo(doc.page.width - 40, doc.y + 15).stroke();
    });

    doc.end();
}

module.exports = { createTransactionReportPdf };