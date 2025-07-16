-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "original_booking_id" INTEGER;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_original_booking_id_fkey" FOREIGN KEY ("original_booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
