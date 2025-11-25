// server/utils/commissionPdfService.js
const PDFDocument = require('pdfkit');

function createCommissionPaymentPdf(booking, invoice, totalInvoiced, callback, endCallback) {
    const doc = new PDFDocument({ margin: 50 });
    doc.on('data', callback);
    doc.on('end', endCallback);

    doc.image('public/Logo.png', 50, 45, { width: 100 });

    // --- Header ---
    doc.fontSize(18).text('Internal Commission Payment Receipt', { align: 'center' });
    doc.fontSize(10).text(`Payment Recorded: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
    doc.moveDown(7);
    

    // --- Booking Info ---
    doc.fontSize(12).font('Helvetica-Bold').text('Booking Details');
    doc.font('Helvetica').text(`Folder No: ${booking.folderNo}`);
    doc.text(`Agent: ${booking.agentName}`);
    doc.text(`Accounting Month for this Payment: ${new Date(invoice.invoiceDate).toLocaleString('en-GB', { month: 'long', year: 'numeric' })}`);
    doc.moveDown(2);

    // --- Financial Summary ---
    const summaryTop = doc.y;
    const labelX = 60;
    const valueX = 450;
    
    doc.fontSize(12).font('Helvetica-Bold').text('Commission Summary');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown();

    if (typeof booking.commissionAmount === 'number') {
        doc.font('Helvetica').fontSize(11).text('Total Commission Allotted', labelX, doc.y);
        doc.text(`£${booking.commissionAmount.toFixed(2)}`, valueX, doc.y - 1, { width: 100, align: 'right' });
        doc.moveDown(0.5);
    }
    
    doc.font('Helvetica-Bold').fontSize(11).text('This Payment Amount', labelX, doc.y);
    doc.text(`£${invoice.amount.toFixed(2)}`, valueX, doc.y - 1, { width: 100, align: 'right' });
    doc.moveDown(0.5);

    doc.font('Helvetica').fontSize(11).text('Total Paid to Date (incl. this)', labelX, doc.y);
    doc.text(`- £${totalInvoiced.toFixed(2)}`, valueX, doc.y - 1, { width: 100, align: 'right' });
    doc.moveDown(1);
    
    doc.moveTo(valueX - 10, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);

    const remaining = (booking.commissionAmount || 0) - totalInvoiced;
    doc.font('Helvetica-Bold').fontSize(12);
    doc.fillColor(remaining > 0 ? 'red' : 'green');
    doc.text('Remaining Commission Balance', labelX, doc.y);
    doc.text(`£${remaining.toFixed(2)}`, valueX, doc.y - 1, { width: 100, align: 'right' });
    doc.fillColor('black');
    
    doc.moveDown();
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();

 

    doc.end();
}

module.exports = { createCommissionPaymentPdf };