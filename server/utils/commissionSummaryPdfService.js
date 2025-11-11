const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// --- Helper Functions ---

function getDisplayType(record) {
    if (record.recordType === 'cancellation') return 'Cancellation';
    if (record.bookingStatus === 'CANCELLED') return 'Original (Cancelled)';
    if (record.folderNo.toString().includes('.')) return 'Date Change';
    return 'Booking';
};

function formatCurrency(amount) {
    const value = amount || 0;
    return `£${value.toFixed(2)}`;
}

function formatMonth(dateInput) {
    if (!dateInput) return 'N/A';
    try {
        const date = new Date(dateInput);
        if (isNaN(date.getTime())) return 'N/A';
        return date.toISOString().slice(0, 7); // Returns "YYYY-MM"
    } catch (e) {
        return 'N/A';
    }
}

function formatDate(date) {
    return date.toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
}

// --- Brand Colors ---
const COLORS = {
    primaryBlue: '#2D3E50',
    secondaryBlue: '#0A738A',
    textDark: '#374151',
    textLight: '#6B7280',
    headerBg: '#2D3E50',
    headerText: '#FFFFFF',
    rowEven: '#F9FAFB',
    rowOdd: '#FFFFFF',
    lineColor: '#E5E7EB',
};

// --- PDF Generation ---

// ***** 1. UPDATED HEADER FUNCTION *****
function generateHeader(doc, filters) {
    // Load logo
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 100, 5, { width: 120 });
    }

    // Report Details Box
    doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica');
    const boxX = 350;
    const boxY = 80; // This is fine, it's on the right
    
    doc.font('Helvetica-Bold').text('Agent:', boxX, boxY + 5);
    doc.font('Helvetica').text(filters.agent || 'All Agents', boxX + 90, boxY + 5);
    
    doc.font('Helvetica-Bold').text('Commission Period:', boxX, boxY + 20);
    doc.font('Helvetica').text(
        filters.month 
        ? new Date(`${filters.month}-02`).toLocaleString('en-GB', { month: 'long', year: 'numeric' }) 
        : 'All Time', 
        boxX + 90, boxY + 20
    );

    doc.font('Helvetica-Bold').text('Generated On:', boxX, boxY + 35);
    doc.font('Helvetica').text(formatDate(new Date()), boxX + 90, boxY + 35);

    // Title (Moved down to Y=120)
    doc.fillColor(COLORS.primaryBlue)
       .fontSize(22)
       .font('Helvetica-Bold')
       .text('Commission Summary', 50, 120); // MOVED DOWN

    // Set Y position for the next section
    doc.y = 150; // MOVED DOWN
}

// ***** 2. UPDATED SUMMARY FUNCTION (Ensures Horizontal Layout) *****
function generateSummary(doc, reportData) {
    const startY = doc.y; // This will be 150 from the header
    
    const summary = reportData.reduce((acc, item) => {
        const comm = item.commissionAmount || 0;
        const paid = item.totalInvoiced || 0;
        acc.totalCommission += comm;
        acc.totalPaid += paid;
        acc.totalProfit += (item.finalProfit || 0);
        return acc;
    }, { totalCommission: 0, totalPaid: 0, totalProfit: 0 });

    const totalRemaining = summary.totalCommission - summary.totalPaid;

    const summaryItems = [
        { title: 'Total Profit', value: formatCurrency(summary.totalProfit) },
        { title: 'Total Commission', value: formatCurrency(summary.totalCommission) },
        { title: 'Total Paid Out', value: formatCurrency(summary.totalPaid) },
        { title: 'Total Remaining', value: formatCurrency(totalRemaining), color: COLORS.secondaryBlue },
    ];

    const cardWidth = 120;
    const cardSpacing = 15;
    let currentX = 50; // Start X position

    for (const item of summaryItems) {
        // This loop draws all cards at the *same* `startY`
        doc.rect(currentX, startY, cardWidth, 60).fillAndStroke(COLORS.rowEven, COLORS.lineColor);
        
        doc.fillColor(COLORS.textLight).font('Helvetica-Bold').fontSize(9)
           .text(item.title, currentX + 10, startY + 10, { width: cardWidth - 20 });
           
        doc.fillColor(item.color || COLORS.primaryBlue).font('Helvetica-Bold').fontSize(14)
           .text(item.value, currentX + 10, startY + 30, { width: cardWidth - 20 });
           
        currentX += cardWidth + cardSpacing; // Move X for the next card
    }
    
    // Move doc.y down *after* all cards are drawn
    doc.y = startY + 60 + 20; // 60 for card height, 20 for spacing
}
// ***** END OF UPDATED SUMMARY *****

function generateTable(doc, reportData, filters) {
    let tableTop = doc.y; // Start table from current Y
    const rowHeight = 30;
    const headerHeight = 25;
    
    const isAllAgents = !filters.agent;
    const headers = [
        'Folder #', 'Type',
        ...(isAllAgents ? ['Agent'] : []),
        'Acct. Month', 'Profit/Loss', 'Comm. Amt', 'Paid', 'Remaining'
    ];
    
    const columnWidths = isAllAgents
        ? [55, 70, 90, 50, 65, 65, 60, 60] // 8 columns
        : [65, 90, 60, 80, 80, 80, 60];    // 7 columns
        
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);
    const startX = 50;

    // --- Draw Header ---
    doc.rect(startX, tableTop, tableWidth, headerHeight).fill(COLORS.headerBg);
    doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(9);
    
    let currentX = startX;
    headers.forEach((header, i) => {
        doc.text(header, currentX + 5, tableTop + 8, { width: columnWidths[i] - 10, align: 'left' });
        currentX += columnWidths[i];
    });

    tableTop += headerHeight;

    // --- Draw Rows ---
    doc.font('Helvetica').fontSize(8);
    let rowY = tableTop; // Use a separate Y for rows

    reportData.forEach((item, i) => {
        const y = rowY;

        // Add new page if needed
        if (y > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            tableTop = doc.page.margins.top; // Reset tableTop for new page
            // Redraw header on new page
            doc.rect(startX, tableTop, tableWidth, headerHeight).fill(COLORS.headerBg);
            doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(9);
            let headerX = startX;
            headers.forEach((header, i) => {
                doc.text(header, headerX + 5, tableTop + 8, { width: columnWidths[i] - 10, align: 'left' });
                headerX += columnWidths[i];
            });
            tableTop += headerHeight;
            rowY = tableTop; // Reset rowY
            y = rowY; // Set y for the current row
        }

        const rowColor = (i % 2 === 0) ? COLORS.rowOdd : COLORS.rowEven;
        doc.rect(startX, y, tableWidth, rowHeight).fill(rowColor);

        const displayType = getDisplayType(item);
        const agent = item.agentName || 'N/A';
        const acctMonth = formatMonth(item.accountingMonth);
        const profit = formatCurrency(item.finalProfit);
        const commAmt = formatCurrency(item.commissionAmount);
        const paid = formatCurrency(item.totalInvoiced);
        const remaining = formatCurrency((item.commissionAmount || 0) - item.totalInvoiced);

        const rowData = [
            item.folderNo, displayType,
            ...(isAllAgents ? [agent] : []),
            acctMonth, profit, commAmt, paid, remaining
        ];

        currentX = startX;
        doc.fillColor(COLORS.textDark);
        rowData.forEach((cell, j) => {
            if (headers[j] === 'Profit/Loss' && (item.finalProfit || 0) < 0) {
                doc.fillColor('#E05B5B'); // Red
            } else if (headers[j] === 'Remaining' && ((item.commissionAmount || 0) - item.totalInvoiced) > 0) {
                 doc.fillColor('#F08A4B'); // Orange
            }
            
            doc.text(cell, currentX + 5, y + 11, { width: columnWidths[j] - 10, align: 'left' });
            doc.fillColor(COLORS.textDark); // Reset color
            currentX += columnWidths[j];
        });
        
        rowY += rowHeight; // Increment rowY for the next row
    });

    // Set doc.y to the final row position for the footer
    doc.y = rowY;
}

function generateFooter(doc) {
    const pageCount = doc.bufferedPageRange().count;
    for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc.fontSize(8).fillColor(COLORS.textLight)
           .text(`Page ${i + 1} of ${pageCount}`,
            doc.page.margins.left,
            doc.page.height - doc.page.margins.bottom + 10,
            { align: 'center' }
        );
    }
}


function createCommissionSummaryPdf(reportData, filters, callback, endCallback) {
    const doc = new PDFDocument({ 
        margin: 50, 
        layout: 'portrait', 
        size: 'A4',
        bufferPages: true // Important for footer page numbers
    });
    
    doc.on('data', callback);
    doc.on('end', endCallback);

    generateHeader(doc, filters);
    generateSummary(doc, reportData);
    generateTable(doc, reportData, filters);
    generateFooter(doc);

    doc.end();
}
module.exports = { createCommissionSummaryPdf };