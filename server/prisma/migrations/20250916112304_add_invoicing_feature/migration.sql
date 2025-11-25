-- AlterEnum
ALTER TYPE "ActionType" ADD VALUE 'GENERATE_INVOICE';

-- CreateTable
CREATE TABLE "invoice_counters" (
    "id" SERIAL NOT NULL,
    "prefix" TEXT NOT NULL,
    "last_number" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_counters_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "invoice_counters_prefix_key" ON "invoice_counters"("prefix");
