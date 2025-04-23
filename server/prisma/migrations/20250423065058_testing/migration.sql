/*
  Warnings:

  - You are about to drop the column `airline` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `bal_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `booking_type` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `created_at` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `invoiced` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `issued_date` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `lastpay_date` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pax_type` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `payment_method` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pc_date` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `pnr` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `prod_cost` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `profit` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `received_amount` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `revenue` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `route_from` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `route_to` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `status` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `surcharge` on the `bookings` table. All the data in the column will be lost.
  - You are about to drop the column `trans_fee` on the `bookings` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "bookings_pnr_key";

-- AlterTable
ALTER TABLE "bookings" DROP COLUMN "airline",
DROP COLUMN "bal_amount",
DROP COLUMN "booking_type",
DROP COLUMN "created_at",
DROP COLUMN "invoiced",
DROP COLUMN "issued_date",
DROP COLUMN "lastpay_date",
DROP COLUMN "pax_type",
DROP COLUMN "payment_method",
DROP COLUMN "pc_date",
DROP COLUMN "pnr",
DROP COLUMN "prod_cost",
DROP COLUMN "profit",
DROP COLUMN "received_amount",
DROP COLUMN "revenue",
DROP COLUMN "route_from",
DROP COLUMN "route_to",
DROP COLUMN "status",
DROP COLUMN "surcharge",
DROP COLUMN "trans_fee";
