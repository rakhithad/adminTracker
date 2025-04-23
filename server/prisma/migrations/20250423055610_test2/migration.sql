/*
  Warnings:

  - Made the column `pc_date` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `issued_date` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `ref_no` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pnr` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `pax_name` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `agent_name` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `team_name` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `revenue` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `prod_cost` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `received_amount` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `profit` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `invoiced` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `created_at` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `booking_type` on table `bookings` required. This step will fail if there are existing NULL values in that column.
  - Made the column `payment_method` on table `bookings` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "bookings" ALTER COLUMN "pc_date" SET NOT NULL,
ALTER COLUMN "issued_date" SET NOT NULL,
ALTER COLUMN "ref_no" SET NOT NULL,
ALTER COLUMN "pnr" SET NOT NULL,
ALTER COLUMN "pax_name" SET NOT NULL,
ALTER COLUMN "agent_name" SET NOT NULL,
ALTER COLUMN "team_name" SET NOT NULL,
ALTER COLUMN "revenue" SET NOT NULL,
ALTER COLUMN "prod_cost" SET NOT NULL,
ALTER COLUMN "received_amount" SET NOT NULL,
ALTER COLUMN "profit" SET NOT NULL,
ALTER COLUMN "invoiced" SET NOT NULL,
ALTER COLUMN "created_at" SET NOT NULL,
ALTER COLUMN "booking_type" SET NOT NULL,
ALTER COLUMN "payment_method" SET NOT NULL;

-- AlterTable
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
