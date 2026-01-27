/*
  Warnings:

  - You are about to drop the column `changedBy` on the `UserHistory` table. All the data in the column will be lost.
  - You are about to drop the `OfficeClosure` table. If the table is not empty, all the data it contains will be lost.

*/
-- CreateEnum
CREATE TYPE "public"."LiquidationStatus" AS ENUM ('GENERATED', 'PAID', 'CANCELLED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "public"."ReservationStatus" ADD VALUE 'COMPLETED';
ALTER TYPE "public"."ReservationStatus" ADD VALUE 'PENALIZED';
ALTER TYPE "public"."ReservationStatus" ADD VALUE 'INVOICED';

-- AlterTable
ALTER TABLE "public"."Reservation" ALTER COLUMN "status" SET DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "public"."UserHistory" DROP COLUMN "changedBy",
ADD COLUMN     "changedByUserId" INTEGER;

-- DropTable
DROP TABLE "public"."OfficeClosure";

-- CreateTable
CREATE TABLE "public"."Liquidation" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "total" DECIMAL(10,2) NOT NULL,
    "status" "public"."LiquidationStatus" NOT NULL DEFAULT 'GENERATED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Liquidation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LiquidationItem" (
    "id" SERIAL NOT NULL,
    "liquidationId" INTEGER NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "LiquidationItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Liquidation_userId_idx" ON "public"."Liquidation"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "LiquidationItem_reservationId_key" ON "public"."LiquidationItem"("reservationId");

-- CreateIndex
CREATE INDEX "Reservation_userId_idx" ON "public"."Reservation"("userId");

-- CreateIndex
CREATE INDEX "Reservation_spaceId_idx" ON "public"."Reservation"("spaceId");

-- CreateIndex
CREATE INDEX "Reservation_status_idx" ON "public"."Reservation"("status");

-- CreateIndex
CREATE INDEX "Reservation_date_idx" ON "public"."Reservation"("date");

-- CreateIndex
CREATE INDEX "SettingHistory_settingId_idx" ON "public"."SettingHistory"("settingId");

-- CreateIndex
CREATE INDEX "SettingHistory_changedByUserId_idx" ON "public"."SettingHistory"("changedByUserId");

-- CreateIndex
CREATE INDEX "UserHistory_userId_idx" ON "public"."UserHistory"("userId");

-- CreateIndex
CREATE INDEX "UserHistory_changedByUserId_idx" ON "public"."UserHistory"("changedByUserId");

-- AddForeignKey
ALTER TABLE "public"."UserHistory" ADD CONSTRAINT "UserHistory_changedByUserId_fkey" FOREIGN KEY ("changedByUserId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Liquidation" ADD CONSTRAINT "Liquidation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiquidationItem" ADD CONSTRAINT "LiquidationItem_liquidationId_fkey" FOREIGN KEY ("liquidationId") REFERENCES "public"."Liquidation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LiquidationItem" ADD CONSTRAINT "LiquidationItem_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
