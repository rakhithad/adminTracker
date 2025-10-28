-- CreateTable
CREATE TABLE "customer_credit_notes" (
    "id" SERIAL NOT NULL,
    "customer_name" TEXT NOT NULL,
    "initial_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'AVAILABLE',
    "generated_from_cancellation_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_credit_note_usage" (
    "id" SERIAL NOT NULL,
    "amount_used" DOUBLE PRECISION NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "credit_note_id" INTEGER NOT NULL,
    "used_on_initial_payment_id" INTEGER NOT NULL,

    CONSTRAINT "customer_credit_note_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_notes_generated_from_cancellation_id_key" ON "customer_credit_notes"("generated_from_cancellation_id");

-- CreateIndex
CREATE INDEX "customer_credit_notes_customer_name_idx" ON "customer_credit_notes"("customer_name");

-- CreateIndex
CREATE UNIQUE INDEX "customer_credit_note_usage_used_on_initial_payment_id_key" ON "customer_credit_note_usage"("used_on_initial_payment_id");

-- AddForeignKey
ALTER TABLE "customer_credit_notes" ADD CONSTRAINT "customer_credit_notes_generated_from_cancellation_id_fkey" FOREIGN KEY ("generated_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_note_usage" ADD CONSTRAINT "customer_credit_note_usage_credit_note_id_fkey" FOREIGN KEY ("credit_note_id") REFERENCES "customer_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_credit_note_usage" ADD CONSTRAINT "customer_credit_note_usage_used_on_initial_payment_id_fkey" FOREIGN KEY ("used_on_initial_payment_id") REFERENCES "initial_payments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
