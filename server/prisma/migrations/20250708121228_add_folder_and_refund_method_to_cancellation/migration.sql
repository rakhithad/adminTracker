/*
  Warnings:

  - A unique constraint covering the columns `[folder_no]` on the table `cancellations` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `folder_no` to the `cancellations` table without a default value. This is not possible if the table is not empty.
  - Added the required column `refund_transaction_method` to the `cancellations` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "cancellations" ADD COLUMN     "folder_no" INTEGER NOT NULL,
ADD COLUMN     "refund_transaction_method" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "cancellations_folder_no_key" ON "cancellations"("folder_no");
