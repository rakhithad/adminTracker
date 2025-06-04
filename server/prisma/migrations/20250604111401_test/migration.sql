-- CreateEnum
CREATE TYPE "Teams" AS ENUM ('PH', 'TOURS');

-- CreateEnum
CREATE TYPE "Suppliers" AS ENUM ('BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'MANAGER', 'AGENT');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('FRESH', 'DATE_CHANGE', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PaxType" AS ENUM ('FRESH', 'REFERRAL', 'REPEAT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FULL', 'INTERNAL', 'REFUND', 'HUMM', 'FULL_HUMM', 'INTERNAL_HUMM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "pax_name" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "team_name" "Teams",
    "pnr" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "from_to" TEXT NOT NULL,
    "booking_type" "BookingType" NOT NULL,
    "booking_status" "BookingStatus",
    "pc_date" TIMESTAMP(3) NOT NULL,
    "issued_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod" NOT NULL,
    "last_payment_date" TIMESTAMP(3),
    "travel_date" TIMESTAMP(3),
    "supplier" "Suppliers",
    "revenue" DOUBLE PRECISION,
    "prod_cost" DOUBLE PRECISION,
    "trans_fee" DOUBLE PRECISION,
    "surcharge" DOUBLE PRECISION,
    "received" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "invoice" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_bookings" (
    "id" SERIAL NOT NULL,
    "ref_no" TEXT NOT NULL,
    "pax_name" TEXT NOT NULL,
    "agent_name" TEXT NOT NULL,
    "team_name" "Teams",
    "pnr" TEXT NOT NULL,
    "airline" TEXT NOT NULL,
    "from_to" TEXT NOT NULL,
    "booking_type" "BookingType" NOT NULL,
    "booking_status" "BookingStatus",
    "pc_date" TIMESTAMP(3) NOT NULL,
    "issued_date" TIMESTAMP(3),
    "payment_method" "PaymentMethod" NOT NULL,
    "last_payment_date" TIMESTAMP(3),
    "travel_date" TIMESTAMP(3),
    "supplier" "Suppliers",
    "revenue" DOUBLE PRECISION,
    "prod_cost" DOUBLE PRECISION,
    "trans_fee" DOUBLE PRECISION,
    "surcharge" DOUBLE PRECISION,
    "received" DOUBLE PRECISION,
    "balance" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "invoice" TEXT,
    "status" "PendingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "email" TEXT,
    "title" VARCHAR(10),
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "contact_no" TEXT,
    "role" "Role" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_items" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_cost_items" (
    "id" SERIAL NOT NULL,
    "pendingBookingId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "pending_cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_cost_items" ADD CONSTRAINT "pending_cost_items_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
