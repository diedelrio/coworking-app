-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "recurrenceCount" INTEGER,
ADD COLUMN     "recurrenceEndDate" TIMESTAMP(3),
ADD COLUMN     "recurrencePattern" TEXT,
ADD COLUMN     "seriesId" TEXT;
