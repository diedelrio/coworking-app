-- CreateEnum
CREATE TYPE "public"."ClosureStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateTable
CREATE TABLE "public"."OfficeClosure" (
    "date" TIMESTAMP(3) NOT NULL,
    "reason" TEXT,
    "status" "public"."ClosureStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OfficeClosure_pkey" PRIMARY KEY ("date")
);
