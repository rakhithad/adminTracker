-- CreateTable
CREATE TABLE "supplier_credit_notes" (
    "id" SERIAL NOT NULL,
    "supplier" "Suppliers" NOT NULL,
    "initial_amount" DOUBLE PRECISION NOT NULL,
    "remaining_amount" DOUBLE PRECISION NOT NULL,
    "status" "CreditNoteStatus" NOT NULL DEFAULT 'AVAILABLE',
    "generated_from_cancellation_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_usage" (
    "id" SERIAL NOT NULL,
    "amount_used" DOUBLE PRECISION NOT NULL,
    "used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creditNoteId" INTEGER NOT NULL,
    "usedOnCostItemSupplierId" INTEGER NOT NULL,

    CONSTRAINT "credit_note_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "supplier_credit_notes_generated_from_cancellation_id_key" ON "supplier_credit_notes"("generated_from_cancellation_id");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_usage_usedOnCostItemSupplierId_key" ON "credit_note_usage"("usedOnCostItemSupplierId");

-- AddForeignKey
ALTER TABLE "supplier_credit_notes" ADD CONSTRAINT "supplier_credit_notes_generated_from_cancellation_id_fkey" FOREIGN KEY ("generated_from_cancellation_id") REFERENCES "cancellations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_usage" ADD CONSTRAINT "credit_note_usage_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "supplier_credit_notes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_usage" ADD CONSTRAINT "credit_note_usage_usedOnCostItemSupplierId_fkey" FOREIGN KEY ("usedOnCostItemSupplierId") REFERENCES "cost_item_suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
