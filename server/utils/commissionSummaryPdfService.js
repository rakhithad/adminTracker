// server/utils/commissionSummaryPdfService.js
const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

function createCommissionSummaryPdf(reportData, filters, callback, endCallback) {
    const doc = new PDFDocument({ margin: 40, layout: 'portrait', size: 'A4' });
    doc.on('data', callback);
    doc.on('end', endCallback);

    // --- Header ---
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, (doc.page.width - 120) / 2, 30, { width: 120 });
        doc.moveDown(3);
    }

    doc.moveDown(5);
    doc.fontSize(18).font('Helvetica-Bold').text('Commission Summary Report', { align: 'center' });
    doc.moveDown(1);

    // --- Filters ---
    doc.fontSize(10).font('Helvetica');
    if (filters.agent) doc.text(`Agent: ${filters.agent}`, { align: 'center' });
    if (filters.month) doc.text(`Commission Period: ${new Date(filters.month).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`, { align: 'center' });
    doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB')}`, { align: 'center' });
    doc.moveDown(2);

    // --- Summary Box ---
    const totalCommissionPaid = reportData.reduce((sum, item) => sum + item.totalInvoiced, 0);
    const totalProfitLoss = reportData.reduce((sum, item) => sum + (item.finalProfit || 0), 0);
    
    doc.font('Helvetica-Bold').fontSize(12).text('Summary');
    doc.rect(doc.x, doc.y, doc.page.width - 80, 40).stroke();
    doc.fontSize(10).text(`Total Commission Paid This Period:  £${totalCommissionPaid.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.text(`Total Profit/Loss From These Items:  £${totalProfitLoss.toFixed(2)}`, doc.x + 10, doc.y + 5);
    doc.moveDown(4);

    // --- Details Table ---
    doc.font('Helvetica-Bold').fontSize(12).text('Payment Details');
    
    const tableTop = doc.y + 10;
    const tableHeaders = ['Folder #', 'Type', 'Profit/Loss', 'Comm. Amt.', 'Paid', 'Remaining'];
    const columnWidths = [80, 80, 80, 80, 80, 80];
    let currentX = 40;

    // Draw Headers
    doc.fontSize(8);
    tableHeaders.forEach((header, i) => {
        doc.text(header, currentX, tableTop, { width: columnWidths[i], align: 'left' });
        currentX += columnWidths[i];
    });
    doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).stroke();
    
    // Draw Rows
    doc.font('Helvetica');
    reportData.forEach(item => {
        const remaining = (item.commissionAmount || 0) - item.totalInvoiced;
        const rowData = [
            item.folderNo,
            item.recordType === 'booking' ? 'Booking' : 'Cancellation', // Simplified for the report
            `£${(item.finalProfit || 0).toFixed(2)}`,
            `£${(item.commissionAmount || 0).toFixed(2)}`,
            `£${item.totalInvoiced.toFixed(2)}`,
            `£${remaining.toFixed(2)}`,
        ];
        
        let rowY = doc.y + 5;
        currentX = 40;
        
        rowData.forEach((cell, i) => {
            doc.text(cell, currentX, rowY, { width: columnWidths[i], align: 'left' });
            currentX += columnWidths[i];
        });
        doc.moveTo(40, doc.y + 15).lineTo(doc.page.width - 40, doc.y + 15).stroke();
    });

    doc.end();
}

module.exports = { createCommissionSummaryPdf };