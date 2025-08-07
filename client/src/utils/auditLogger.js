// In utils/auditLogger.js

// Import the ActionType enum from the generated Prisma client using ES Module syntax
import { ActionType } from '@prisma/client';

/**
 * Creates audit log entries for a given action.
 * @param {object} tx - The Prisma transaction client.
 * @param {object} logData - The data for the log.
 * @param {number} logData.userId - The ID of the user performing the action.
 * @param {string} logData.modelName - The name of the model being changed (e.g., "PendingBooking").
 * @param {number} logData.recordId - The ID of the record being changed.
 * @param {string} logData.action - The type of action from the ActionType enum.
 * @param {Array<object>} [logData.changes] - Optional. An array of changes for UPDATE actions.
 * @param {string} changes[].fieldName - The name of the field that changed.
 * @param {any} changes[].oldValue - The original value of the field.
 * @param {any} changes[].newValue - The new value of the field.
 */
const createAuditLog = async (tx, { userId, modelName, recordId, action, changes = [] }) => {
  // For simple actions like CREATE, APPROVE, etc., where we don't log individual field changes.
  if (changes.length === 0) {
    await tx.auditLog.create({
      data: {
        modelName,
        recordId,
        userId,
        action,
      },
    });
    return;
  }

  // For UPDATE actions, create a log for each changed field.
  const logEntries = changes.map(change => ({
    modelName,
    recordId,
    userId,
    action,
    fieldName: change.fieldName,
    // Safely convert all values to strings for consistent storage.
    oldValue: String(change.oldValue ?? 'null'),
    newValue: String(change.newValue ?? 'null'),
  }));

  if (logEntries.length > 0) {
    await tx.auditLog.createMany({
      data: logEntries,
    });
  }
};

// Export using ES Module syntax
export { createAuditLog, ActionType };