/*
  Warnings:

  - The `team_name` column on the `bookings` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- CreateEnum
CREATE TYPE "Teams" AS ENUM ('PH', 'TOURS');

-- CreateEnum
CREATE TYPE "Suppliers" AS ENUM ('BTRES', 'LYCA', 'CEBU', 'BTRES_LYCA', 'BA', 'TRAINLINE', 'EASYJET', 'FLYDUBAI');

-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "supplier" "Suppliers",
ADD COLUMN     "travel_date" TIMESTAMP(3),
DROP COLUMN "team_name",
ADD COLUMN     "team_name" "Teams";
