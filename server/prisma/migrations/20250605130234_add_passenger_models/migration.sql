-- CreateEnum
CREATE TYPE "Title" AS ENUM ('MR', 'MRS', 'MS', 'MASTER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PassengerCategory" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- CreateTable
CREATE TABLE "passengers" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "title" "Title" NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "email" TEXT,
    "contact_no" TEXT,
    "country" TEXT,
    "category" "PassengerCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_passengers" (
    "id" SERIAL NOT NULL,
    "pendingBookingId" INTEGER NOT NULL,
    "title" "Title" NOT NULL,
    "first_name" TEXT NOT NULL,
    "middle_name" TEXT,
    "last_name" TEXT NOT NULL,
    "gender" "Gender" NOT NULL,
    "email" TEXT,
    "contact_no" TEXT,
    "country" TEXT,
    "category" "PassengerCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_passengers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_passengers" ADD CONSTRAINT "pending_passengers_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
