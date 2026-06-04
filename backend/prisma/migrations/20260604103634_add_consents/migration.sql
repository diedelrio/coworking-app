-- CreateEnum
CREATE TYPE "ConsentType" AS ENUM ('TERMS_AND_POLICIES', 'COMMERCIAL_COMMUNICATIONS', 'SOCIAL_COMMUNICATIONS', 'OTHER');

-- CreateTable
CREATE TABLE "ConsentDefinition" (
    "id" SERIAL NOT NULL,
    "key" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "ConsentType" NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "requiresAcceptance" BOOLEAN NOT NULL DEFAULT true,
    "showDocumentsToUser" BOOLEAN NOT NULL DEFAULT true,
    "allowUserDownloadDocuments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentDefinition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ConsentDocument" (
    "id" SERIAL NOT NULL,
    "consentDefinitionId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "contentBase64" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "downloadEnabled" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ConsentDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserConsentAcceptance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "consentDefinitionId" INTEGER NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "accepted" BOOLEAN NOT NULL DEFAULT true,
    "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "source" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "UserConsentAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ConsentDefinition_key_key" ON "ConsentDefinition"("key");

-- CreateIndex
CREATE INDEX "ConsentDefinition_type_idx" ON "ConsentDefinition"("type");

-- CreateIndex
CREATE INDEX "ConsentDefinition_active_idx" ON "ConsentDefinition"("active");

-- CreateIndex
CREATE INDEX "ConsentDocument_consentDefinitionId_idx" ON "ConsentDocument"("consentDefinitionId");

-- CreateIndex
CREATE INDEX "UserConsentAcceptance_userId_idx" ON "UserConsentAcceptance"("userId");

-- CreateIndex
CREATE INDEX "UserConsentAcceptance_consentDefinitionId_idx" ON "UserConsentAcceptance"("consentDefinitionId");

-- CreateIndex
CREATE INDEX "UserConsentAcceptance_acceptedAt_idx" ON "UserConsentAcceptance"("acceptedAt");

-- AddForeignKey
ALTER TABLE "ConsentDocument" ADD CONSTRAINT "ConsentDocument_consentDefinitionId_fkey" FOREIGN KEY ("consentDefinitionId") REFERENCES "ConsentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsentAcceptance" ADD CONSTRAINT "UserConsentAcceptance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserConsentAcceptance" ADD CONSTRAINT "UserConsentAcceptance_consentDefinitionId_fkey" FOREIGN KEY ("consentDefinitionId") REFERENCES "ConsentDefinition"("id") ON DELETE CASCADE ON UPDATE CASCADE;
