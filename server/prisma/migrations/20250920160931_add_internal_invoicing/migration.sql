-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ActionType" ADD VALUE 'CREATE_INTERNAL_INVOICE';
ALTER TYPE "ActionType" ADD VALUE 'UPDATE_INTERNAL_INVOICE';
ALTER TYPE "ActionType" ADD VALUE 'UPDATE_ACCOUNTING_MONTH';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "accounting_month" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "internal_invoices" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "invoice_date" TIMESTAMP(3) NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_invoices_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
