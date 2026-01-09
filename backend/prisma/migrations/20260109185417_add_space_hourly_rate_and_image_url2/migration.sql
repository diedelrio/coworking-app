-- AlterTable
ALTER TABLE "public"."Space" ADD COLUMN     "hourlyRate" DECIMAL(10,2) NOT NULL DEFAULT 0.00,
ADD COLUMN     "imageUrl" TEXT;
