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

-- AddForeignKey
ALTER TABLE "supplier_payment_settlements" ADD CONSTRAINT "supplier_payment_settlements_costItemSupplierId_fkey" FOREIGN KEY ("costItemSupplierId") REFERENCES "cost_item_suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
