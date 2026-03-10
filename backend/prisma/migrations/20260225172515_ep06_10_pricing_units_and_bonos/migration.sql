/*
  Warnings:

  - A unique constraint covering the columns `[priceListId,scope,spaceType,spaceId,unit]` on the table `PriceItem` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."PriceUnit" ADD VALUE 'HALF_DAY';
ALTER TYPE "public"."PriceUnit" ADD VALUE 'DAY';
ALTER TYPE "public"."PriceUnit" ADD VALUE 'MONTH';

-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "entitlementConsumedHours" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "entitlementId" INTEGER;

-- CreateIndex
CREATE INDEX "PriceItem_unit_idx" ON "public"."PriceItem"("unit");

-- CreateIndex
CREATE UNIQUE INDEX "PriceItem_priceListId_scope_spaceType_spaceId_unit_key" ON "public"."PriceItem"("priceListId", "scope", "spaceType", "spaceId", "unit");

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_entitlementId_fkey" FOREIGN KEY ("entitlementId") REFERENCES "public"."UserEntitlement"("id") ON DELETE SET NULL ON UPDATE CASCADE;
