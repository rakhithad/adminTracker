// In controllers/auditLogController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const apiResponse = require('../utils/apiResponse');

const getAuditHistory = async (req, res) => {
  try {
    const { modelName, recordId } = req.query;

    if (!modelName || !recordId) {
      return apiResponse.error(res, 'modelName and recordId query parameters are required.', 400);
    }

    const history = await prisma.auditLog.findMany({
      where: {
        modelName: modelName,
        recordId: parseInt(recordId),
      },
      include: {
        user: {
          select: { firstName: true, lastName: true }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
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