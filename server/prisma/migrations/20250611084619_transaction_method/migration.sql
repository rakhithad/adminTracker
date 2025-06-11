/*
  Warnings:

  - You are about to drop the column `country` on the `passengers` table. All the data in the column will be lost.
  - You are about to drop the column `country` on the `pending_passengers` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "received_date" TIMESTAMP(3),
ADD COLUMN     "transaction_method" TEXT;

-- AlterTable
ALTER TABLE "passengers" DROP COLUMN "country",
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "nationality" TEXT;

-- AlterTable
ALTER TABLE "pending_bookings" ADD COLUMN     "description" TEXT,
ADD COLUMN     "received_date" TIMESTAMP(3),
ADD COLUMN     "transaction_method" TEXT;

-- AlterTable
ALTER TABLE "pending_passengers" DROP COLUMN "country",
ADD COLUMN     "birthday" TIMESTAMP(3),
ADD COLUMN     "nationality" TEXT;
