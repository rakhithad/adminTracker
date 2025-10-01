/*
  Warnings:

  - Added the required column `commission_month` to the `internal_invoices` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "internal_invoices" ADD COLUMN     "commission_month" TIMESTAMP(3) NOT NULL;
