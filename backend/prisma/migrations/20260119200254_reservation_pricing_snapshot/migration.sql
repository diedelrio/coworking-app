-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "durationMinutes" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hourlyRateSnapshot" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "purpose" TEXT,
ADD COLUMN     "totalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.00;
