const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const generateNextInvoiceNumber = async (tx) => {
  const today = new Date();
  const year = today.getFullYear();
  const month = (today.getMonth() + 1).toString().padStart(2, '0');
  const day = today.getDate().toString().padStart(2, '0');
  
  const prefix = `${year}-${month}-${day}-external`;

  // Find the counter for today's date prefix
  let counter = await tx.invoiceCounter.findUnique({
    where: { prefix },
  });

  let nextNumber;

  if (counter) {
    // If it exists, increment the number
    nextNumber = counter.lastNumber + 1;
    await tx.invoiceCounter.update({
      where: { prefix },
      data: { lastNumber: nextNumber },
    });
  } else {
    // If it's the first invoice of the day, create a new counter
    nextNumber = 1;
    await tx.invoiceCounter.create({
      data: { prefix, lastNumber: nextNumber },
    });
  }

  // Format the number with leading zeros (e.g., 001, 015)
  const formattedNumber = nextNumber.toString().padStart(3, '0');

  return `${prefix}-${formattedNumber}`;
};

module.exports = {
  generateNextInvoiceNumber,
};
