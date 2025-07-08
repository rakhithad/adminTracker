/*
  Warnings:

  - You are about to drop the column `original_booking_id` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `refunded_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the `credit_notes` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bookings" DROP CONSTRAINT "bookings_original_booking_id_fkey";

-- DropForeignKey
ALTER TABLE "credit_notes" DROP CONSTRAINT "credit_notes_generated_by_booking_id_fkey";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "original_booking_id",
DROP COLUMN "refunded_amount";

-- DropTable
DROP TABLE "credit_notes";

-- CreateTable
CREATE TABLE "cancellations" (
    "id" SERIAL NOT NULL,
    "original_booking_id" INTEGER NOT NULL,
    "original_revenue" DOUBLE PRECISION NOT NULL,
    "original_prod_cost" DOUBLE PRECISION NOT NULL,
    "supplier_cancellation_fee" DOUBLE PRECISION NOT NULL,
    "refund_to_passenger" DOUBLE PRECISION NOT NULL,
    "credit_note_amount" DOUBLE PRECISION,
    "profit_or_loss" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cancellations_original_booking_id_key" ON "cancellations"("original_booking_id");

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_original_booking_id_fkey" FOREIGN KEY ("original_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
