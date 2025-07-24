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

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payables_created_from_cancellation_id_key" ON "supplier_payables"("created_from_cancellation_id");

-- AddForeignKey
ALTER TABLE "supplier_payables" ADD CONSTRAINT "supplier_payables_created_from_cancellation_id_fkey" FOREIGN KEY ("created_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payable_settlements" ADD CONSTRAINT "supplier_payable_settlements_supplier_payable_id_fkey" FOREIGN KEY ("supplier_payable_id") REFERENCES "supplier_payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
