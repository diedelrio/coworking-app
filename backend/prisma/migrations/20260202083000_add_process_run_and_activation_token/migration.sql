-- CreateTable
CREATE TYPE "public"."ProcessRunStatus" AS ENUM ('RUNNING','SUCCESS','PARTIAL','ERROR');

-- CreateTable
CREATE TABLE "public"."ActivationToken" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivationToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ProcessRun" (
    "id" SERIAL NOT NULL,
    "processName" TEXT NOT NULL,
    "processCode" TEXT NOT NULL,
    "executedByUserId" INTEGER NOT NULL,
    "executedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" "public"."ProcessRunStatus" NOT NULL DEFAULT 'RUNNING',
    "inputFileName" TEXT,
    "inputFileType" TEXT,
    "totalRecords" INTEGER NOT NULL DEFAULT 0,
    "successRecords" INTEGER NOT NULL DEFAULT 0,
    "errorRecords" INTEGER NOT NULL DEFAULT 0,
    "skippedRecords" INTEGER NOT NULL DEFAULT 0,
    "resultSummary" TEXT,
    "errorSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndexes
CREATE INDEX "ActivationToken_userId_idx" ON "public"."ActivationToken"("userId");
CREATE INDEX "ActivationToken_tokenHash_idx" ON "public"."ActivationToken"("tokenHash");
CREATE INDEX "ActivationToken_expiresAt_idx" ON "public"."ActivationToken"("expiresAt");

CREATE INDEX "ProcessRun_processCode_idx" ON "public"."ProcessRun"("processCode");
CREATE INDEX "ProcessRun_executedAt_idx" ON "public"."ProcessRun"("executedAt");

-- Foreign Keys
ALTER TABLE "public"."ActivationToken" ADD CONSTRAINT "ActivationToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."ProcessRun" ADD CONSTRAINT "ProcessRun_executedByUserId_fkey" FOREIGN KEY ("executedByUserId") REFERENCES "public"."User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
