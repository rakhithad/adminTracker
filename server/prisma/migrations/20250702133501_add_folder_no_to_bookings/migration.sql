/*
  Warnings:

  - A unique constraint covering the columns `[folder_no]` on the table `bookings` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `folder_no` to the `bookings` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "bookings" ADD COLUMN     "folder_no" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "bookings_folder_no_key" ON "bookings"("folder_no");
