-- CreateEnum
CREATE TYPE "ActionType" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'APPROVE_PENDING', 'REJECT_PENDING', 'DATE_CHANGE', 'VOID_BOOKING', 'CREATE_CANCELLATION', 'SETTLEMENT_PAYMENT', 'REFUND_PAYMENT');

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "model_name" TEXT NOT NULL,
    "record_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "action" "ActionType" NOT NULL,
    "field_name" TEXT,
    "old_value" TEXT,
    "new_value" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
