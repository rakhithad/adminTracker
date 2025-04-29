-- CreateTable
CREATE TABLE "Booking" (
    "id" SERIAL NOT NULL,
    "refNo" TEXT NOT NULL,
    "paxName" TEXT NOT NULL,
    "revenue" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Booking_refNo_key" ON "Booking"("refNo");
