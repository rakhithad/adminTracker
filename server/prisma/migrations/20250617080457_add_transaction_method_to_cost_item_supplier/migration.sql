-- AlterTable
ALTER TABLE "cost_item_suppliers" ADD COLUMN     "transaction_method" TEXT,
ALTER COLUMN "paymentMethod" SET DEFAULT 'BANK_TRANSFER';
