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

-- CreateIndex
CREATE UNIQUE INDEX "customer_payables_created_from_cancellation_id_key" ON "customer_payables"("created_from_cancellation_id");

-- AddForeignKey
ALTER TABLE "customer_payables" ADD CONSTRAINT "customer_payables_created_from_cancellation_id_fkey" FOREIGN KEY ("created_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_payables" ADD CONSTRAINT "customer_payables_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
