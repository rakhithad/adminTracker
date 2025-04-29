/*
  Warnings:

  - Added the required column `booking_type` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `payment_method` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `pc_date` to the `bookings` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "booking_status" "BookingStatus",
ADD COLUMN     "booking_type" "BookingType" NOT NULL,
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "issued_date" TIMESTAMP(3),
ADD COLUMN     "last_payment_date" TIMESTAMP(3),
ADD COLUMN     "payment_method" "PaymentMethod" NOT NULL,
ADD COLUMN     "pc_date" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
