const PDFDocument = require('pdfkit');

// Helper function to format dates consistently
function formatDate(dateStr) {
    if (!dateStr) return 'N/A';
    try {
        // Handle both Date objects and ISO strings
        const date = typeof dateStr === 'string' ? new Date(dateStr) : dateStr;
        return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch (e) {
        console.error("Error formatting date:", dateStr, e);
        return 'Invalid Date';
    }
}

// Helper to draw horizontal lines
function horizontalLine(doc, y) {
    doc.strokeColor("#aaaaaa")
       .lineWidth(1)
       .moveTo(50, y)
       .lineTo(550, y)
       .stroke();
}

function createInvoicePdf(booking, totalReceived, callback, endCallback) {
    const doc = new PDFDocument({ margin: 50 });

    doc.on('data', callback);
    doc.on('end', endCallback);

    // --- Constants for Layout ---
    const pageTop = 50;
    const contentStartY = pageTop + 80; // Start content below header
    const leftMargin = 50;
    const rightMargin = 550;
    const column1X = leftMargin;
    const column2X = 350; // Start of right column
    const columnWidth = 250;
    const lineSpacing = 15;
    const sectionSpacing = 25;

    // --- 1. Header ---
    doc.image('public/Logo.png', leftMargin, pageTop, { width: 100 });
    doc.fontSize(16).font('Helvetica-Bold').text('11TH SREET TRAVEL', 200, pageTop + 15, { align: 'center' });
    doc.fontSize(9).font('Helvetica').text('29 Charlestown Way, HULL HU9 1PJ, United Kingdom', 200, pageTop + 35, { align: 'center' });
    doc.fontSize(9).text('Phone: [Your Phone] | Email: [Your Email] | Web: [Your Website]', 200, pageTop + 50, { align: 'center' });
    horizontalLine(doc, contentStartY - 10);

    // --- 2. Invoice Info & Billing Info ---
    let currentY = contentStartY;
    doc.fontSize(18).font('Helvetica-Bold').text('INVOICE', leftMargin, currentY, { width: rightMargin - leftMargin, align: 'center'});
    currentY += 40;

    // Left Column: Invoice Details
    doc.fontSize(10).font('Helvetica-Bold');
    doc.text('Invoice #:', column1X, currentY);
    doc.text('Issue Date:', column1X, currentY + lineSpacing);
    doc.text('Booking Ref:', column1X, currentY + 2 * lineSpacing);
    doc.text('PNR:', column1X, currentY + 3 * lineSpacing);
    doc.text('PC Date:', column1X, currentY + 4 * lineSpacing);
    // doc.text('Issued Date:', column1X, currentY + 5 * lineSpacing); // Uncomment if you want to show Issued Date

    doc.font('Helvetica');
    doc.text(booking.invoiced || 'N/A', column1X + 80, currentY);
    doc.text(formatDate(new Date()), column1X + 80, currentY + lineSpacing);
    doc.text(booking.refNo || 'N/A', column1X + 80, currentY + 2 * lineSpacing);
    doc.text(booking.pnr || 'N/A', column1X + 80, currentY + 3 * lineSpacing);
    doc.text(formatDate(booking.pcDate), column1X + 80, currentY + 4 * lineSpacing);
    // doc.text(formatDate(booking.issuedDate), column1X + 80, currentY + 5 * lineSpacing);

    // Right Column: Bill To
    const leadPassenger = booking.passengers?.[0] || {};
    const passengerName = `${leadPassenger.title || ''} ${leadPassenger.firstName || ''} ${leadPassenger.middleName || ''} ${leadPassenger.lastName || ''}`.replace(/\s+/g, ' ').trim();

    doc.font('Helvetica-Bold');
    doc.text('BILL TO:', column2X, currentY);
    doc.font('Helvetica');
    doc.text(passengerName || 'N/A', column2X, currentY + lineSpacing);
    doc.text(leadPassenger.email || 'N/A', column2X, currentY + 2 * lineSpacing);
    doc.text(leadPassenger.contactNo || 'N/A', column2X, currentY + 3 * lineSpacing);
    // Add address here if available in your Passenger model
    // doc.text(leadPassenger.addressLine1 || '', column2X, currentY + 4 * lineSpacing);
    // doc.text(leadPassenger.city || '', column2X, currentY + 5 * lineSpacing);

    currentY += 6 * lineSpacing + sectionSpacing; // Move down past this section
    horizontalLine(doc, currentY - (sectionSpacing / 2));

    // --- 3. Booking Details ---
    doc.fontSize(12).font('Helvetica-Bold').text('Booking Summary', leftMargin, currentY);
    currentY += lineSpacing * 1.5;

    doc.fontSize(10).font('Helvetica');
    doc.text(`Airline: ${booking.airline || 'N/A'}`, column1X, currentY);
    doc.text(`Agent: ${booking.agentName || 'N/A'} (${booking.teamName || 'N/A'})`, column2X, currentY);
    currentY += lineSpacing;
    doc.text(`Route: ${booking.fromTo || 'N/A'}`, column1X, currentY);
    doc.text(`Passengers: ${booking.numPax || 'N/A'}`, column2X, currentY);
    currentY += lineSpacing;
    doc.text(`Travel Date: ${formatDate(booking.travelDate)}`, column1X, currentY);
    currentY += lineSpacing + sectionSpacing;
    horizontalLine(doc, currentY - (sectionSpacing / 2));

    // --- (Optional) Passenger Details Table ---
    if (booking.passengers && booking.passengers.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').text('Passenger Details', leftMargin, currentY);
        currentY += lineSpacing * 1.5;
        const passengerTableTop = currentY;
        const nameX = leftMargin + 5;
        const categoryX = 350;
        const dobX = 450;

        doc.fontSize(9).font('Helvetica-Bold');
        doc.text('Name', nameX, currentY);
        doc.text('Category', categoryX, currentY);
        doc.text('Date of Birth', dobX, currentY);
        currentY += lineSpacing * 0.8;
        horizontalLine(doc, currentY);
        currentY += lineSpacing * 0.5;

        doc.fontSize(9).font('Helvetica');
        booking.passengers.forEach(pax => {
            const fullName = `${pax.title || ''} ${pax.firstName || ''} ${pax.middleName || ''} ${pax.lastName || ''}`.replace(/\s+/g, ' ').trim();
            doc.text(fullName, nameX, currentY, { width: categoryX - nameX - 10 });
            doc.text(pax.category || 'N/A', categoryX, currentY);
            doc.text(formatDate(pax.birthday), dobX, currentY);
            currentY += lineSpacing * 1.5; // Adjust spacing for multiple passengers
        });
        currentY += sectionSpacing; // Space after passenger list
        horizontalLine(doc, currentY - (sectionSpacing / 2));
    }


    // --- 4. Financial Summary ---
    doc.fontSize(12).font('Helvetica-Bold').text('Payment Summary', leftMargin, currentY);
    currentY += lineSpacing * 1.5;
    const summaryLabelX = leftMargin + 10;
    const summaryValueX = rightMargin - 100; // Align amounts to the right

    doc.fontSize(11).font('Helvetica');
    if (typeof booking.revenue === 'number') {
        doc.text('Total Package Cost', summaryLabelX, currentY);
        doc.text(`£${booking.revenue.toFixed(2)}`, summaryValueX, currentY, { width: 100, align: 'right' });
        currentY += lineSpacing;
    }
    // Add Surcharge/Fees if applicable and positive
    if (typeof booking.surcharge === 'number' && booking.surcharge > 0) {
        doc.text('Surcharges', summaryLabelX, currentY);
        doc.text(`£${booking.surcharge.toFixed(2)}`, summaryValueX, currentY, { width: 100, align: 'right' });
        currentY += lineSpacing;
    }
     if (typeof booking.transFee === 'number' && booking.transFee > 0) {
        doc.text('Transaction Fee', summaryLabelX, currentY);
        doc.text(`£${booking.transFee.toFixed(2)}`, summaryValueX, currentY, { width: 100, align: 'right' });
        currentY += lineSpacing;
    }

    doc.text('Amount Paid', summaryLabelX, currentY);
    doc.text(`- £${(totalReceived || 0).toFixed(2)}`, summaryValueX, currentY, { width: 100, align: 'right' });
    currentY += lineSpacing * 0.5; // Space before line

    // Line before balance
    doc.moveTo(summaryValueX - 10, currentY).lineTo(rightMargin, currentY).stroke();
    currentY += lineSpacing * 0.8;

    // Final Balance
    doc.fontSize(12).font('Helvetica-Bold');
    if (typeof booking.balance === 'number' && booking.balance > 0.01) { // Use a small tolerance
        doc.fillColor('red').text('Balance Due', summaryLabelX, currentY);
        doc.text(`£${booking.balance.toFixed(2)}`, summaryValueX, currentY, { width: 100, align: 'right' });
        doc.fillColor('black');
    } else if (typeof booking.balance === 'number' && booking.balance < -0.01) {
        doc.fillColor('green').text('Credit Balance', summaryLabelX, currentY);
        doc.text(`-£${Math.abs(booking.balance).toFixed(2)}`, summaryValueX, currentY, { width: 100, align: 'right' });
        doc.fillColor('black');
    } else {
        doc.fillColor('green').text('Balance Due', summaryLabelX, currentY);
        doc.text('PAID IN FULL', summaryValueX, currentY, { width: 100, align: 'right' });
        doc.fillColor('black');
    }
    currentY += lineSpacing + sectionSpacing;
    horizontalLine(doc, currentY - (sectionSpacing / 2));


    // --- 5. Payment History ---
    doc.fontSize(12).font('Helvetica-Bold').text('Payment History', leftMargin, currentY);
    currentY += lineSpacing * 1.5;
    const paymentTableTop = currentY;
    const dateX = leftMargin + 5;
    const methodX = 150;
    const amountX = rightMargin - 100;

    doc.fontSize(9).font('Helvetica-Bold');
    doc.text('Date', dateX, currentY);
    doc.text('Method', methodX, currentY);
    doc.text('Amount', amountX, currentY, { width: 100, align: 'right' });
    currentY += lineSpacing * 0.8;
    horizontalLine(doc, currentY);
    currentY += lineSpacing * 0.5;

    doc.fontSize(9).font('Helvetica');
    const allPayments = [
        ...(booking.initialPayments || []).map(p => ({ date: p.paymentDate, method: p.transactionMethod, amount: p.amount })),
        ...(booking.instalments || []).flatMap(inst => (inst.payments || []).map(p => ({ date: p.paymentDate, method: p.transactionMethod, amount: p.amount })))
    ].sort((a,b) => new Date(a.date) - new Date(b.date));

    if (allPayments.length > 0) {
        allPayments.forEach(p => {
            doc.text(formatDate(p.date), dateX, currentY);
            doc.text((p.method || 'N/A').replace('_', ' '), methodX, currentY);
            doc.text(`£${(p.amount || 0).toFixed(2)}`, amountX, currentY, { width: 100, align: 'right' });
            currentY += lineSpacing;
        });
    } else {
        doc.text('No payments recorded.', dateX, currentY);
        currentY += lineSpacing;
    }


    // --- 6. Footer ---
    const pageBottom = doc.page.height - 50;
    horizontalLine(doc, pageBottom - 20);
    doc.fontSize(9).font('Helvetica').text('Thank you for choosing 11th Sreet Travel!', leftMargin, pageBottom - 10, { align: 'center', width: rightMargin - leftMargin });
    // Add Terms/Bank details if needed
    // doc.text('Bank Details: ...', leftMargin, pageBottom + 5);
    
    doc.end();
}

module.exports = {
  createInvoicePdf,
};