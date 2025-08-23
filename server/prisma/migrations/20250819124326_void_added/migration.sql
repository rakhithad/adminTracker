-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'UNVOID_BOOKING';

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'VOID';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "status_before_void" "BookingStatus",
ADD COLUMN     "void_reason" TEXT,
ADD COLUMN     "voided_at" TIMESTAMP(3),
ADD COLUMN     "voided_by_id" INTEGER;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
