/*
  Warnings:

  - Added the required column `updatedAt` to the `OfficeClosure` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "public"."OfficeClosure_date_idx";

-- AlterTable
ALTER TABLE "public"."OfficeClosure" ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;
