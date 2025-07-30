-- AlterTable
ALTER TABLE "cancellations" ADD COLUMN     "refund_status" TEXT NOT NULL DEFAULT 'N/A';

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
CREATE UNIQUE INDEX "passenger_refund_payments_cancellationId_key" ON "passenger_refund_payments"("cancellationId");

-- AddForeignKey
ALTER TABLE "passenger_refund_payments" ADD CONSTRAINT "passenger_refund_payments_cancellationId_fkey" FOREIGN KEY ("cancellationId") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
