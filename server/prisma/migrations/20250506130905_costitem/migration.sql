-- CreateTable
CREATE TABLE "cost_items" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cost_items_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
