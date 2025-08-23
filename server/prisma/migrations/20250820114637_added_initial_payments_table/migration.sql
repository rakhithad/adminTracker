/*
  Warnings:

  - You are about to drop the column `received` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `received_date` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_method` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `received` on the `pending_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `received_date` on the `pending_bookings` table. All the data in the column will be lost.
  - You are about to drop the column `transaction_method` on the `pending_bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "received",
DROP COLUMN "received_date",
DROP COLUMN "transaction_method";

-- AlterTable
ALTER TABLE "pending_bookings" DROP COLUMN "received",
DROP COLUMN "received_date",
DROP COLUMN "transaction_method";

-- CreateTable
CREATE TABLE "initial_payments" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "pendingBookingId" INTEGER,
    "bookingId" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "initial_payments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "initial_payments" ADD CONSTRAINT "initial_payments_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "initial_payments" ADD CONSTRAINT "initial_payments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
