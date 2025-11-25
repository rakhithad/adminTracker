-- AlterTable
ALTER TABLE "cancellations" ADD COLUMN     "accounting_month" TIMESTAMP(3),
ADD COLUMN     "commission_amount" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "internal_invoices" ADD COLUMN     "cancellation_id" INTEGER,
ALTER COLUMN "booking_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "internal_invoices" ADD CONSTRAINT "internal_invoices_cancellation_id_fkey" FOREIGN KEY ("cancellation_id") REFERENCES "cancellations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
