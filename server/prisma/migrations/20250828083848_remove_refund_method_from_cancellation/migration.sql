/*
  Warnings:

  - You are about to drop the column `refund_transaction_method` on the `cancellations` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "cancellations" DROP COLUMN "refund_transaction_method";
