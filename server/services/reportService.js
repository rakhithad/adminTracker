const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Fetches and processes booking data for the customer deposit report.
 * This function replicates the logic from the frontend's ActionCell to determine a definitive status.
 * @param {object} filters - The filter criteria.
 * @param {string} filters.status - 'all', 'ongoing', 'completed', 'cancelled'.
 * @param {string} filters.startDate - ISO date string.
 * @param {string} filters.endDate - ISO date string.
 * @param {string} filters.searchTerm - The user's search term.
 * @returns {Promise<Array>} A promise that resolves to an array of processed booking objects.
 */
const fetchAndProcessDepositData = async (filters) => {
  const { status, startDate, endDate, searchTerm } = filters;

  // --- 1. Build the base WHERE clause for Prisma ---
  const whereClause = {
    pcDate: {
      gte: startDate ? new Date(startDate) : undefined,
      lte: endDate ? new Date(endDate) : undefined,
    },
  };

  if (searchTerm) {
    whereClause.OR = [
      { folderNo: { contains: searchTerm, mode: 'insensitive' } },
      { refNo: { contains: searchTerm, mode: 'insensitive' } },
      { paxName: { contains: searchTerm, mode: 'insensitive' } },
      { agentName: { contains: searchTerm, mode: 'insensitive' } },
    ];
  }

  // --- 2. Add status-specific filtering logic ---
  // This is more complex than a simple `where` clause because status depends on calculated values.
  // We fetch a broader set and filter in the next step.
  if (status === 'ongoing') {
    whereClause.bookingStatus = { not: 'CANCELLED' };
    whereClause.balance = { gt: 0 };
  } else if (status === 'completed') {
    whereClause.bookingStatus = { not: 'CANCELLED' };
    whereClause.balance = { lte: 0 };
  } else if (status === 'cancelled') {
    whereClause.bookingStatus = 'CANCELLED';
  }

  // --- 3. Fetch all relevant data in a single comprehensive query ---
  const bookings = await prisma.booking.findMany({
    where: whereClause,
    include: {
      initialPayments: true,
      instalments: {
        include: {
          payments: true,
        },
      },
      cancellation: {
        include: {
          createdCustomerPayable: true,
          refundPayment: true,
        },
      },
    },
    orderBy: {
      pcDate: 'desc',
    },
  });

  // --- 4. Process (Hydrate) each booking to create report-ready objects ---
  const processedBookings = bookings.map((booking) => {
    // Calculate total paid from all sources
    const sumOfInitialPayments = booking.initialPayments.reduce((sum, p) => sum + p.amount, 0);
    const sumOfInstalmentPayments = booking.instalments.reduce(
      (instSum, inst) => instSum + inst.payments.reduce((pSum, p) => pSum + p.amount, 0),
      0
    );
    // Note: CustomerPayableSettlements are part of the cancellation flow and don't affect pre-cancellation balance.
    const totalPaid = sumOfInitialPayments + sumOfInstalmentPayments;
    const trueBalance = (booking.revenue || 0) - totalPaid;

    // Determine the definitive report status (replicating ActionCell logic)
    let reportStatus = 'Completed';
    if (booking.bookingStatus === 'CANCELLED') {
      const cancellation = booking.cancellation;
      if (cancellation?.createdCustomerPayable?.pendingAmount > 0) {
        reportStatus = 'Customer Owes';
      } else if (cancellation?.refundStatus === 'PENDING') {
        reportStatus = 'Refund Pending';
      } else if (cancellation?.refundStatus === 'PAID') {
        reportStatus = 'Refund Paid';
      } else {
        reportStatus = 'Cancelled & Settled';
      }
    } else if (trueBalance > 0) {
      const hasPendingInstalments = booking.instalments.some((inst) => ['PENDING', 'OVERDUE'].includes(inst.status));
      if (hasPendingInstalments) {
        reportStatus = 'Instalment Due';
      } else {
        reportStatus = 'Final Settlement Due';
      }
    } else if (trueBalance < 0) {
      reportStatus = 'Overpaid';
    }

    return {
      ...booking,
      totalPaid,
      trueBalance,
      reportStatus,
    };
  });

  return processedBookings;
};

module.exports = {
  fetchAndProcessDepositData,
};