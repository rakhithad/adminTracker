-- CreateEnum
CREATE TYPE "InstalmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "instalments" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InstalmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instalments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_instalments" (
    "id" SERIAL NOT NULL,
    "pendingBookingId" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" "InstalmentStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_instalments_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_instalments" ADD CONSTRAINT "pending_instalments_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
