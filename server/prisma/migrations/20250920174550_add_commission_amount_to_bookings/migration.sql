-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'UPDATE_COMMISSION_AMOUNT';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "commission_amount" DOUBLE PRECISION;
