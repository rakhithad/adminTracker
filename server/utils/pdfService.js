const PDFDocument = require('pdfkit');

function createInvoicePdf(booking, totalReceived, callback, endCallback) {
  const doc = new PDFDocument({ margin: 50 });

  doc.on('data', callback);
  doc.on('end', endCallback);

  // --- Header ---
  doc.moveDown();
  doc.moveDown();
  doc.fontSize(20).text('11TH SREET TRAVEL', { align: 'center' });
  doc.fontSize(10).text('29 Charlestown Way, HULL HU9 1PJ, United Kingdom', { align: 'center' });
  doc.moveDown();

  // --- Invoice Info & Customer Info ---
  doc.fontSize(16).text('INVOICE', 50, 160, { align: 'center' });
  doc.fontSize(10);
  doc.text(`Invoice #: ${booking.invoiced}`);
  doc.text(`Issue Date: ${new Date().toLocaleDateString('en-GB')}`);
  doc.text(`Booking Ref: ${booking.refNo}`);
  doc.text(`PNR: ${booking.pnr}`);

  const customer = booking.passengers[0];
  doc.text(`${customer.firstName} ${customer.lastName}`, 400, 170);
  doc.text(customer.email || 'N/A', 400, 185);
  doc.text(customer.contactNo || 'N/A', 400, 200);
  doc.moveDown(2);
  
  // --- Flight Details ---
  const tableTop = 250;
  doc.font('Helvetica-Bold').text('Flight Details', 50, tableTop);
  doc.font('Helvetica');
  doc.text(`Airline: ${booking.airline}`, 50, tableTop + 20);
  doc.text(`Route: ${booking.fromTo}`, 50, tableTop + 35);
  doc.text(`Travel Date: ${new Date(booking.travelDate).toLocaleDateString('en-GB')}`, 50, tableTop + 50);
  doc.moveDown(4);

  // ===================================================================
  // --- NEW FINANCIAL SUMMARY SECTION ---
  // ===================================================================
  
  // Define positions for our two-column layout
  const summaryTop = doc.y;
  const labelX = 60;
  const valueX = 450;
  const lineHeight = 20;

  // Draw a line above the summary
  doc.moveTo(50, summaryTop - 5)
     .lineTo(550, summaryTop - 5)
     .stroke();

  let currentY = summaryTop + 10;

  // --- 1. Booking Revenue ---
  if (typeof booking.revenue === 'number') {
    doc.font('Helvetica').fontSize(11).text('Total Package Cost', labelX, currentY);
    doc.text(`£${booking.revenue.toFixed(2)}`, valueX, currentY, { width: 100, align: 'right' });
    currentY += lineHeight;
  }

  // --- 2. Total Received ---
  doc.font('Helvetica').fontSize(11).text('Amount Paid', labelX, currentY);
  doc.text(`- £${(totalReceived || 0).toFixed(2)}`, valueX, currentY, { width: 100, align: 'right' });
  currentY += lineHeight;

  doc.moveTo(valueX - 10, currentY + 2) 
     .lineTo(550, currentY + 2)    
     .stroke();

  // --- 3. Balance with Conditional Logic ---
  doc.moveDown(0.5); // Add a little extra space
  currentY += 8;

  doc.font('Helvetica-Bold').fontSize(12); // Make the final balance stand out

  if (typeof booking.balance === 'number' && booking.balance > 0) {
    // Case 1: There is a balance to be paid
    doc.fillColor('red'); // Use red color for amounts due
    doc.text('Balance Due', labelX, currentY);
    doc.text(`£${booking.balance.toFixed(2)}`, valueX, currentY, { width: 100, align: 'right' });
    doc.fillColor('black'); // IMPORTANT: Reset color back to black
  } else if (typeof booking.balance === 'number' && booking.balance < 0) {
    // Case 2 (Edge Case): Customer has overpaid (has credit)
    doc.fillColor('green');
    doc.text('Credit', labelX, currentY);
    doc.text(`-£${Math.abs(booking.balance).toFixed(2)}`, valueX, currentY, { width: 100, align: 'right' });
    doc.fillColor('black');
  } else {
    // Case 3: Balance is 0 or null
    doc.fillColor('green'); // Use green color for paid status
    doc.text('Balance', labelX, currentY);
    doc.text('PAID IN FULL', valueX, currentY, { width: 100, align: 'right' });
    doc.fillColor('black'); // IMPORTANT: Reset color back to black
  }

  // Draw a line below the summary
  doc.moveTo(50, currentY + 20)
     .lineTo(550, currentY + 20)
     .stroke();

  // ===================================================================
  // --- END OF FINANCIAL SUMMARY SECTION ---
  // ===================================================================

  doc.image('public/Logo.png', 50, 45, { width: 100 });
  // --- Footer ---
  doc.fontSize(10).text('Thank you for your business!', 50, 700, { align: 'center', width: 500 });
  
  doc.end();
}

module.exports = {
  createInvoicePdf,
};