/*
  Warnings:

  - You are about to drop the column `transaction_method` on the `cost_item_suppliers` table. All the data in the column will be lost.
  - You are about to drop the column `supplier` on the `pending_bookings` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cost_item_suppliers" DROP COLUMN "transaction_method",
ADD COLUMN     "firstMethodAmount" DOUBLE PRECISION,
ADD COLUMN     "secondMethodAmount" DOUBLE PRECISION,
ADD COLUMN     "transactionMethod" TEXT;

-- AlterTable
ALTER TABLE "pending_bookings" DROP COLUMN "supplier";
