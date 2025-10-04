const { fetchAndProcessDepositData } = require('../services/reportService');
const { createDepositReportPdf } = require('../services/pdfReportGenerator');

const generateCustomerDepositReport = async (req, res) => {
    try {
        const filters = req.body; // { status, startDate, endDate, searchTerm }

        // 1. Fetch and process the data using the service
        const bookings = await fetchAndProcessDepositData(filters);

        // 2. Calculate the KPIs for the executive summary
        const summary = {
            totalBookings: bookings.length,
            totalRevenue: bookings.reduce((sum, b) => sum + (b.revenue || 0), 0),
            totalDepositsReceived: bookings.reduce((sum, b) => sum + b.totalPaid, 0),
            totalOutstandingBalance: bookings.reduce((sum, b) => (b.trueBalance > 0 ? sum + b.trueBalance : sum), 0),
            totalRefundDue: bookings.reduce((sum, b) => (b.reportStatus === 'Refund Pending' ? sum + (b.cancellation?.refundToPassenger || 0) : sum), 0),
            totalCustomerDebt: bookings.reduce((sum, b) => (b.reportStatus === 'Customer Owes' ? sum + (b.cancellation?.createdCustomerPayable?.pendingAmount || 0) : sum), 0),
        };

        // 3. Set headers for PDF response
        const filename = `Customer-Deposit-Report-${new Date().toISOString().split('T')[0]}.pdf`;
        res.setHeader('Content-disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-type', 'application/pdf');

        // 4. Generate the PDF and stream it to the response
        createDepositReportPdf(
            { bookings, summary },
            filters,
            (chunk) => res.write(chunk), // Stream chunk by chunk
            () => res.end()               // End the response when PDF is done
        );

    } catch (error) {
        console.error('Error generating customer deposit report:', error);
        res.status(500).json({ success: false, error: 'Failed to generate PDF report.' });
    }
};

module.exports = {
    generateCustomerDepositReport,
};