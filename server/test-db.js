const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
  const booking = await prisma.booking.create({
    data: {
      refNo: "TEST-001",
      paxName: "John Doe",
      revenue: 1000.00
    }
  });
  console.log("Created booking:", booking);
}

test();