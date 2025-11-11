const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

// --- Brand Colors ---
const COLORS = {
    primaryBlue: '#2D3E50',
    secondaryBlue: '#0A738A',
    successGreen: '#10B981',
    errorRed: '#E05B5B',
    textDark: '#374151',
    textLight: '#6B7280',
    headerBg: '#2D3E50',
    headerText: '#FFFFFF',
    rowEven: '#F9FAFB',
    rowOdd: '#FFFFFF',
    lineColor: '#E5E7EB',
};

// --- Helper Functions ---
const formatCurrency = (amount) => `£${(amount || 0).toFixed(2)}`;

const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('en-GB', {
        day: '2-digit', month: 'short', year: 'numeric'
    });
};

// --- PDF Sections ---

function generateHeader(doc, filters) {
    const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
    if (fs.existsSync(logoPath)) {
        doc.image(logoPath, 50, 45, { width: 100 });
    }

    doc.fillColor(COLORS.primaryBlue)
       .fontSize(20)
       .font('Helvetica-Bold')
       .text('Transaction Report', 50, 110);

    doc.fillColor(COLORS.textDark).fontSize(9).font('Helvetica');
    const boxX = 350;
    const boxY = 45;
    
    doc.font('Helvetica-Bold').text('Date Range:', boxX, boxY);
    doc.font('Helvetica').text(
        (filters.startDate && filters.endDate) ? `${formatDate(filters.startDate)} - ${formatDate(filters.endDate)}` : 'All Time', 
        boxX + 90, boxY
    );
    
    doc.font('Helvetica-Bold').text('Transaction Type:', boxX, boxY + 15);
    doc.font('Helvetica').text(filters.type || 'All', boxX + 90, boxY + 15);

    doc.font('Helvetica-Bold').text('Generated On:', boxX, boxY + 30);
    doc.font('Helvetica').text(formatDate(new Date()), boxX + 90, boxY + 30);

    doc.moveDown(4);
}

function generateSummary(doc, totals) {
    doc.y = 150; // Fixed start position for summary
    
    const summaryItems = [
        { title: 'Total Incoming', value: formatCurrency(totals.incoming), color: COLORS.successGreen },
        { title: 'Total Outgoing', value: formatCurrency(totals.outgoing), color: COLORS.errorRed },
        { title: 'Net Balance', value: formatCurrency(totals.netBalance), color: totals.netBalance >= 0 ? COLORS.primaryBlue : COLORS.errorRed }
    ];

    const cardWidth = 150;
    const cardSpacing = 20;
    let currentX = 50;

    summaryItems.forEach(item => {
        doc.rect(currentX, doc.y, cardWidth, 60).fillAndStroke(COLORS.rowEven, COLORS.lineColor);
        doc.fillColor(COLORS.textLight).font('Helvetica-Bold').fontSize(9)
           .text(item.title, currentX + 15, doc.y + 15);
        doc.fillColor(item.color).font('Helvetica-Bold').fontSize(14)
           .text(item.value, currentX + 15, doc.y + 35);
        currentX += cardWidth + cardSpacing;
    });

    doc.y = 220; // Set a fixed Y after summary
}

// Reusable function to draw the table header
function drawTableHeader(doc, y) {
    const headers = ['Date', 'Type', 'Category', 'Ref #', 'Method', 'Details', 'Amount'];
    const columnWidths = [60, 55, 70, 75, 60, 110, 65]; 
    const startX = 50;
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

    doc.rect(startX, y, tableWidth, 25).fill(COLORS.headerBg);
    doc.fillColor(COLORS.headerText).font('Helvetica-Bold').fontSize(9);
    
    let currentX = startX;
    headers.forEach((header, i) => {
        const align = header === 'Amount' ? 'right' : 'left';
        const pad = header === 'Amount' ? -10 : 5;
        doc.text(header, currentX + pad, y + 8, { width: columnWidths[i] - 10, align });
        currentX += columnWidths[i];
    });

    // Set doc.y to be right below the header
    doc.y = y + 25; 
}

function generateTable(doc, transactions) {
    const rowHeight = 30;
    const startX = 50;
    const headers = ['Date', 'Type', 'Category', 'Ref #', 'Method', 'Details', 'Amount'];
    const columnWidths = [60, 55, 70, 75, 60, 110, 65]; 
    const tableWidth = columnWidths.reduce((a, b) => a + b, 0);

    // Draw the header for the *first page*
    drawTableHeader(doc, doc.y);

    doc.font('Helvetica').fontSize(8);

    transactions.forEach((t, i) => {
        // --- *** THIS IS THE PAGINATION FIX *** ---
        // Get the current Y. If adding a row will overflow, add a new page.
        // The 'pageAdded' event (registered later) will auto-draw the header.
        const rowY = doc.y;
        if (rowY + rowHeight > doc.page.height - doc.page.margins.bottom) {
            doc.addPage();
            // The 'pageAdded' event handler will draw the header for us.
            // We just need to get the new 'doc.y' value.
        }
        
        // Get the Y for the row *after* the (potential) page break
        const currentY = doc.y;
        // --- *** END OF FIX *** ---

        // Draw row background
        const rowColor = (i % 2 === 0) ? COLORS.rowOdd : COLORS.rowEven;
        doc.rect(startX, currentY, tableWidth, rowHeight).fill(rowColor);

        const rowData = [
            formatDate(t.date),
            t.type,
            t.category,
            t.bookingRefNo || t.folderNo || 'N/A',
            (t.transactionMethod || 'N/A').replace('_', ' '),
            t.details || '-',
            formatCurrency(t.amount)
        ];

        let currentX = startX;
        doc.fillColor(COLORS.textDark);
        
        rowData.forEach((cell, j) => {
            let align = (headers[j] === 'Amount') ? 'right' : 'left';
            let pad = (headers[j] === 'Amount') ? -10 : 5;
            let cellColor = COLORS.textDark;

            if (headers[j] === 'Amount') {
                doc.font('Helvetica-Bold');
                cellColor = (t.type === 'Incoming') ? COLORS.successGreen : COLORS.errorRed;
            } else if (headers[j] === 'Type') {
                doc.font('Helvetica-Bold');
            } else {
                doc.font('Helvetica');
            }
            
            doc.fillColor(cellColor).text(cell, currentX + pad, currentY + 10, { 
                width: columnWidths[j] - 10, 
                align,
                lineBreak: false,
                ellipsis: true
            });
            currentX += columnWidths[j];
        });

        // Manually set doc.y to be *after* the row we just drew
        doc.y = currentY + rowHeight;
    });
}

// --- Main Export ---
function createTransactionReportPdf(transactions, totals, filters, callback, endCallback) {
    const doc = new PDFDocument({ 
        margin: 50, 
        layout: 'portrait', 
        size: 'A4',
        // --- FIX: This buffers pages so we can add footers later ---
        bufferPages: true 
    });
    
    doc.on('data', callback);
    doc.on('end', endCallback);
    
    // --- NEW: Event handler for pagination ---
    // This will run for pages 2, 3, 4...
    doc.on('pageAdded', () => {
        // We set doc.y to the top margin, then draw the header
        drawTableHeader(doc, doc.page.margins.top);
    });
    
    // --- Draw Page 1 ---
    generateHeader(doc, filters);
    generateSummary(doc, totals);
    
    // --- Draw the table (this will automatically add pages and trigger the event) ---
    generateTable(doc, transactions); 

    // --- NEW: Footer Generation ---
    // Now that the doc is built, we can get the total page count
    const range = doc.bufferedPageRange();
    const totalPages = range.count;

    for (let i = 0; i < totalPages; i++) {
        // Switch to the correct page
        doc.switchToPage(i + range.start);
        
        // Add the footer
        doc.fontSize(8).fillColor(COLORS.textLight).text(
            `Page ${i + 1} of ${totalPages}`, 
            50, // doc.page.margins.left
            doc.page.height - 50, // doc.page.margins.bottom
            { align: 'center', width: doc.page.width - 100 }
        );
    }
    
    // Flush all buffered pages to the stream
    doc.flushPages();
    doc.end();
}

module.exports = { createTransactionReportPdf };