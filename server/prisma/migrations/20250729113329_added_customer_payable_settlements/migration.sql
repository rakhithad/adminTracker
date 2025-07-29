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

-- AddForeignKey
ALTER TABLE "customer_payable_settlements" ADD CONSTRAINT "customer_payable_settlements_customer_payable_id_fkey" FOREIGN KEY ("customer_payable_id") REFERENCES "customer_payables"("id") ON DELETE CASCADE ON UPDATE CASCADE;
