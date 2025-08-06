-- CreateEnum
CREATE TYPE "InstalmentStatus" AS ENUM ('PENDING', 'PAID', 'OVERDUE');

-- CreateEnum
CREATE TYPE "Teams" AS ENUM ('PH', 'TOURS', 'MARKETING', 'QC', 'IT');

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'CONSULTANT', 'MANAGEMENT', 'SUPER_MANAGER', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "Suppliers" AS ENUM ('BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI');

-- CreateEnum
CREATE TYPE "BookingType" AS ENUM ('FRESH', 'DATE_CHANGE', 'CANCELLATION');

-- CreateEnum
CREATE TYPE "PaxType" AS ENUM ('FRESH', 'REFERRAL', 'REPEAT');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('FULL', 'INTERNAL', 'REFUND', 'HUMM', 'FULL_HUMM', 'INTERNAL_HUMM');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PendingStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "Title" AS ENUM ('MR', 'MRS', 'MS', 'MASTER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "PassengerCategory" AS ENUM ('ADULT', 'CHILD', 'INFANT');

-- CreateEnum
CREATE TYPE "CreditNoteStatus" AS ENUM ('AVAILABLE', 'PARTIALLY_USED', 'USED');

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "folder_no" TEXT NOT NULL,
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
    "original_booking_id" INTEGER,

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
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "title" "Title",
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "contact_no" TEXT,
    "role" "Role" NOT NULL,
    "team" "Teams",
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

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

-- CreateTable
CREATE TABLE "cancellations" (
    "id" SERIAL NOT NULL,
    "original_booking_id" INTEGER NOT NULL,
    "folder_no" TEXT NOT NULL,
    "refund_transaction_method" TEXT NOT NULL,
    "original_revenue" DOUBLE PRECISION NOT NULL,
    "original_prod_cost" DOUBLE PRECISION NOT NULL,
    "supplier_cancellation_fee" DOUBLE PRECISION NOT NULL,
    "refund_to_passenger" DOUBLE PRECISION NOT NULL,
    "admin_fee" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "refund_status" TEXT NOT NULL DEFAULT 'N/A',
    "credit_note_amount" DOUBLE PRECISION,
    "profit_or_loss" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cancellations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_credit_notes" (
    "id" SERIAL NOT NULL,
    "supplier" "Suppliers" NOT NULL,
    "initial_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'AVAILABLE',
    "generated_from_cancellation_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_usage" (
    "id" SERIAL NOT NULL,
    "amount_used" DOUBLE PRECISION NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditNoteId" INTEGER NOT NULL,
    "usedOnCostItemSupplierId" INTEGER NOT NULL,

    CONSTRAINT "credit_note_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payables" (
    "id" SERIAL NOT NULL,
    "supplier" "Suppliers" NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "pending_amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_from_cancellation_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payable_settlements" (
    "id" SERIAL NOT NULL,
    "supplier_payable_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionMethod" TEXT NOT NULL,
    "settlementDate" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payable_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payables" (
    "id" SERIAL NOT NULL,
    "total_amount" DOUBLE PRECISION NOT NULL,
    "paid_amount" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "pending_amount" DOUBLE PRECISION NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "created_from_cancellation_id" INTEGER NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_payables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_payable_settlements" (
    "id" SERIAL NOT NULL,
    "customer_payable_id" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transactionMethod" TEXT NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_payable_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passenger_refund_payments" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "transaction_method" TEXT NOT NULL,
    "refund_date" TIMESTAMP(3) NOT NULL,
    "cancellationId" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "passenger_refund_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "bookings_folder_no_key" ON "bookings"("folder_no");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "cancellations_original_booking_id_key" ON "cancellations"("original_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "cancellations_folder_no_key" ON "cancellations"("folder_no");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_notes_generated_from_cancellation_id_key" ON "supplier_credit_notes"("generated_from_cancellation_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payables_created_from_cancellation_id_key" ON "supplier_payables"("created_from_cancellation_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_payables_created_from_cancellation_id_key" ON "customer_payables"("created_from_cancellation_id");

-- CreateIndex
CREATE UNIQUE INDEX "passenger_refund_payments_cancellationId_key" ON "passenger_refund_payments"("cancellationId");

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_original_booking_id_fkey" FOREIGN KEY ("original_booking_id") REFERENCES "bookings"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;

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

-- AddForeignKey
ALTER TABLE "cancellations" ADD CONSTRAINT "cancellations_original_booking_id_fkey" FOREIGN KEY ("original_booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_generated_from_cancellation_id_fkey" FOREIGN KEY ("generated_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_usage" ADD CONSTRAINT "credit_note_usage_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "supplier_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_usage" ADD CONSTRAINT "credit_note_usage_usedOnCostItemSupplierId_fkey" FOREIGN KEY ("usedOnCostItemSupplierId") REFERENCES "cost_item_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_created_from_cancellation_id_fkey" FOREIGN KEY ("created_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payable_settlements" ADD CONSTRAINT "supplier_payable_settlements_supplier_payable_id_fkey" FOREIGN KEY ("supplier_payable_id") REFERENCES "supplier_payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payables" ADD CONSTRAINT "customer_payables_created_from_cancellation_id_fkey" FOREIGN KEY ("created_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payables" ADD CONSTRAINT "customer_payables_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payable_settlements" ADD CONSTRAINT "customer_payable_settlements_customer_payable_id_fkey" FOREIGN KEY ("customer_payable_id") REFERENCES "customer_payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "passenger_refund_payments" ADD CONSTRAINT "passenger_refund_payments_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
