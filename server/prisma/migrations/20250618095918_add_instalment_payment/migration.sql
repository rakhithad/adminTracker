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

-- AddForeignKey
ALTER TABLE "instalment_payments" ADD CONSTRAINT "instalment_payments_instalmentId_fkey" FOREIGN KEY ("instalmentId") REFERENCES "instalments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
