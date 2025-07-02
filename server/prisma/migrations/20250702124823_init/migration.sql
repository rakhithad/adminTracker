-- CreateEnum
CREATE TYPE "InstalmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

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

-- CreateEnum
CREATE TYPE "Title" AS ENUM ('MR', 'MRS', 'MS', 'MASTER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PassengerCategory" AS ENUM ('ADULT', 'CHILD', 'INFANT');

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
    "revenue" DOUBLE PRECISION,
    "prod_cost" DOUBLE PRECISION,
    "trans_fee" DOUBLE PRECISION,
    "surcharge" DOUBLE PRECISION,
    "received" DOUBLE PRECISION,
    "transaction_method" TEXT,
    "received_date" TIMESTAMP(3),
    "balance" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "invoice" TEXT,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "num_pax" INTEGER NOT NULL,
    "initial_deposit" DOUBLE PRECISION,

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
    "revenue" DOUBLE PRECISION,
    "prod_cost" DOUBLE PRECISION,
    "trans_fee" DOUBLE PRECISION,
    "surcharge" DOUBLE PRECISION,
    "received" DOUBLE PRECISION,
    "transaction_method" TEXT,
    "received_date" TIMESTAMP(3),
    "balance" DOUBLE PRECISION,
    "profit" DOUBLE PRECISION,
    "invoice" TEXT,
    "description" TEXT,
    "status" "PendingStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "num_pax" INTEGER NOT NULL,

    CONSTRAINT "pending_bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instalments" (
    "id" SERIAL NOT NULL,
    "bookingId" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
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
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_instalments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "instalment_payments" (
    "id" SERIAL NOT NULL,
    "instalmentId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instalment_payments_pkey" PRIMARY KEY ("id")
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
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_cost_items" (
    "id" SERIAL NOT NULL,
    "pendingBookingId" INTEGER NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_cost_items_pkey" PRIMARY KEY ("id")
);

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
    "nationality" TEXT,
    "birthday" TIMESTAMP(3),
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
    "nationality" TEXT,
    "birthday" TIMESTAMP(3),
    "category" "PassengerCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_passengers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_item_suppliers" (
    "id" SERIAL NOT NULL,
    "costItemId" INTEGER,
    "pendingCostItemId" INTEGER,
    "supplier" "Suppliers" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "pendingAmount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "transactionMethod" TEXT,
    "firstMethodAmount" DOUBLE PRECISION,
    "secondMethodAmount" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cost_item_suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_settlements" (
    "id" SERIAL NOT NULL,
    "costItemSupplierId" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionMethod" TEXT NOT NULL,
    "settlementDate" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payment_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "instalments" ADD CONSTRAINT "instalments_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_instalments" ADD CONSTRAINT "pending_instalments_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instalment_payments" ADD CONSTRAINT "instalment_payments_instalmentId_fkey" FOREIGN KEY ("instalmentId") REFERENCES "instalments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_items" ADD CONSTRAINT "cost_items_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_cost_items" ADD CONSTRAINT "pending_cost_items_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passengers" ADD CONSTRAINT "passengers_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_passengers" ADD CONSTRAINT "pending_passengers_pendingBookingId_fkey" FOREIGN KEY ("pendingBookingId") REFERENCES "pending_bookings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_item_suppliers" ADD CONSTRAINT "cost_item_suppliers_costItemId_fkey" FOREIGN KEY ("costItemId") REFERENCES "cost_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_item_suppliers" ADD CONSTRAINT "cost_item_suppliers_pendingCostItemId_fkey" FOREIGN KEY ("pendingCostItemId") REFERENCES "pending_cost_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_settlements" ADD CONSTRAINT "supplier_payment_settlements_costItemSupplierId_fkey" FOREIGN KEY ("costItemSupplierId") REFERENCES "cost_item_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
