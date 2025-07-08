-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_USED', 'USED');

-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'CANCELLED';

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "original_booking_id" INTEGER,
ADD COLUMN     "refunded_amount" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" SERIAL NOT NULL,
    "supplier" "Suppliers" NOT NULL,
    "initial_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'AVAILABLE',
    "generated_by_booking_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_generated_by_booking_id_key" ON "credit_notes"("generated_by_booking_id");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_original_booking_id_fkey" FOREIGN KEY ("original_booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_generated_by_booking_id_fkey" FOREIGN KEY ("generated_by_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
