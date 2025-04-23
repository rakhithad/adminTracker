/*
  Warnings:

  - Added the required column `airline` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `from_to` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pnr` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "bookings_ref_no_key";

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "airline" TEXT NOT NULL,
ADD COLUMN     "from_to" TEXT NOT NULL,
ADD COLUMN     "pnr" TEXT NOT NULL,
ALTER COLUMN "team_name" DROP NOT NULL;
