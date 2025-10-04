const PDFDocument = require('pdfkit');

function createDepositReportPdf(data, filters, callback, endCallback) {
  const { bookings, summary } = data;
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

  doc.on('data', callback);
  doc.on('end', endCallback);

  // --- Header ---
  doc.image('public/Logo.png', 40, 25, { width: 80 });
  doc.fontSize(18).font('Helvetica-Bold').text('Customer Deposit Report', { align: 'center' });
  doc.fontSize(9).font('Helvetica').text(`Generated on: ${new Date().toLocaleString('en-GB')}`, { align: 'center' });
  doc.moveDown(0.5);

  const filterText = `Filters Applied | Status: ${filters.status.toUpperCase()} | Period: ${new Date(filters.startDate).toLocaleDateString('en-GB')} to ${new Date(filters.endDate).toLocaleDateString('en-GB')}`;
  doc.fontSize(8).text(filterText, { align: 'center' });
  doc.moveDown(2);


  // --- Executive Summary (KPIs) ---
  doc.fontSize(12).font('Helvetica-Bold').text('Executive Summary', { underline: true });
  doc.moveDown(0.5);

  const summaryY = doc.y;
  const col1X = 50;
  const col2X = 250;
  const col3X = 450;
  const col4X = 600;

  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Total Bookings Included:', col1X, summaryY);
  doc.text('Total Revenue:', col2X, summaryY);
  doc.text('Total Deposits Received:', col3X, summaryY);
  doc.text('Total Outstanding Balance:', col4X, summaryY);

  doc.font('Helvetica').fontSize(10);
  doc.text(summary.totalBookings, col1X, summaryY + 15);
  doc.text(`£${summary.totalRevenue.toFixed(2)}`, col2X, summaryY + 15);
  doc.text(`£${summary.totalDepositsReceived.toFixed(2)}`, col3X, summaryY + 15);
  doc.text(`£${summary.totalOutstandingBalance.toFixed(2)}`, col4X, summaryY + 15, {fillColor: 'red'});

  const summaryY2 = summaryY + 40;
  doc.font('Helvetica-Bold').fontSize(10);
  doc.text('Total Refund Due to Pax:', col1X, summaryY2);
  doc.text('Total Debt Owed by Pax:', col2X, summaryY2);
  
  doc.font('Helvetica').fontSize(10);
  doc.text(`£${summary.totalRefundDue.toFixed(2)}`, col1X, summaryY2 + 15, {fillColor: 'red'});
  doc.text(`£${summary.totalCustomerDebt.toFixed(2)}`, col2X, summaryY2 + 15, {fillColor: 'red'});

  doc.moveDown(4);


  // --- Detailed Table ---
  const tableTop = doc.y;
  const tableHeaders = ['Folder No', 'PC Date', 'Travel Date', 'Passenger', 'Agent', 'Revenue (£)', 'Paid (£)', 'Balance (£)', 'Status'];
  const columnWidths = [60, 60, 60, 110, 110, 70, 70, 70, 80];
  let currentX = 40;

  doc.font('Helvetica-Bold').fontSize(8);
  tableHeaders.forEach((header, i) => {
    doc.text(header, currentX, tableTop, { width: columnWidths[i], align: 'left' });
    currentX += columnWidths[i];
  });
  
  doc.moveTo(40, tableTop + 15).lineTo(790, tableTop + 15).stroke();

  let currentY = tableTop + 20;
  doc.font('Helvetica').fontSize(7);
  
  bookings.forEach(booking => {
    if (currentY > 500) { // New page if content overflows
      doc.addPage({ margin: 40, size: 'A4', layout: 'landscape' });
      currentY = 40;
    }

    const rowData = [
      booking.folderNo,
      new Date(booking.pcDate).toLocaleDateString('en-GB'),
      booking.travelDate ? new Date(booking.travelDate).toLocaleDateString('en-GB') : 'N/A',
      booking.paxName,
      booking.agentName,
      `£${(booking.revenue || 0).toFixed(2)}`,
      `£${booking.totalPaid.toFixed(2)}`,
      `£${booking.trueBalance.toFixed(2)}`,
      booking.reportStatus
    ];

    currentX = 40;
    rowData.forEach((cell, i) => {
      // Color code the balance
      const options = { width: columnWidths[i], align: 'left' };
      if (i === 7) { // Balance column
          options.fillColor = booking.trueBalance > 0 ? 'red' : 'green';
      }
      doc.text(cell, currentX, currentY, options);
      doc.fillColor('black'); // Reset color
      currentX += columnWidths[i];
    });
    
    currentY += 20; // Move to next row
    doc.moveTo(40, currentY - 5).lineTo(790, currentY - 5).strokeColor('#CCCCCC').stroke();
  });


  doc.end();
}

module.exports = {
  createDepositReportPdf,
};