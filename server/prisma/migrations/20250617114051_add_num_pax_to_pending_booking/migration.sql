/*
  Warnings:

  - You are about to drop the column `supplier` on the `bookings` table. All the data in the column will be lost.
  - Added the required column `num_pax` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `num_pax` to the `pending_bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "supplier",
ADD COLUMN     "num_pax" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "pending_bookings" ADD COLUMN     "num_pax" INTEGER NOT NULL;
