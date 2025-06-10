-- AlterTable
ALTER TABLE "cost_item_suppliers" ADD COLUMN     "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
ADD COLUMN     "paymentMethod" TEXT NOT NULL DEFAULT 'full',
ADD COLUMN     "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0;
