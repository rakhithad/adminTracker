// In controllers/auditLogController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

const getAuditHistory = async (req, res) => {
  try {
    const { modelName, recordId } = req.query;
    const parsedRecordId = parseInt(recordId, 10);

    if (!modelName || isNaN(parsedRecordId)) {
      return apiResponse.error(res, 'modelName and a valid recordId are required.', 400);
    }

    let whereClause = {
      modelName: modelName,
      recordId: parsedRecordId,
    };

    // ====================================================================
    // == THIS IS THE NEW LOGIC TO GET THE COMBINED HISTORY              ==
    // ====================================================================
    // If we're looking for a main booking's history, we also need to find
    // the history of the pending booking it originated from.
    if (modelName === 'Booking') {
      // 1. Find the booking to get its reference number.
      const booking = await prisma.booking.findUnique({
        where: { id: parsedRecordId },
        select: { refNo: true },
      });

      if (booking) {
        // 2. Find the original pending booking using the shared reference number.
        const pendingBooking = await prisma.pendingBooking.findFirst({
          where: { refNo: booking.refNo },
          select: { id: true },
        });
        
        if (pendingBooking) {
          // 3. Create a new "OR" query to get logs from BOTH records.
          whereClause = {
            OR: [
              { modelName: 'Booking', recordId: parsedRecordId },
              { modelName: 'PendingBooking', recordId: pendingBooking.id },
            ],
          };
        }
      }
    }

    // This query now uses either the simple whereClause or the complex "OR" one.
    const history = await prisma.auditLog.findMany({
      where: whereClause,
      include: {
        user: {
          select: { firstName: true, lastName: true },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return apiResponse.success(res, history);

  } catch (error) {
    console.error('Error fetching audit history:', error);
    return apiResponse.error(res, `Failed to fetch audit history: ${error.message}`, 500);
  }
};

module.exports = {
  getAuditHistory,
};