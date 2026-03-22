-- CreateEnum
CREATE TYPE "public"."CommercialProductType" AS ENUM ('PLAN', 'BONUS', 'RATE');

-- CreateEnum
CREATE TYPE "public"."CommercialTargetType" AS ENUM ('COWORKING', 'MEETING_ROOM', 'INSPIRATION_ROOM', 'FULL_SPACE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."CommercialBillingType" AS ENUM ('RECURRING', 'PREPAID', 'PAY_PER_USE', 'INCLUDED');

-- CreateEnum
CREATE TYPE "public"."CommercialUnitType" AS ENUM ('HOUR', 'DAY', 'HALF_DAY', 'FULL_DAY', 'WEEK', 'MONTH', 'UNIT', 'SESSION');

-- CreateEnum
CREATE TYPE "public"."TaxMode" AS ENUM ('INCLUDED', 'EXCLUDED', 'EXEMPT');

-- CreateEnum
CREATE TYPE "public"."ContractStatus" AS ENUM ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."ContractType" AS ENUM ('COWORKING', 'ROOM', 'MIXED', 'CORPORATE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PaymentFrequency" AS ENUM ('ONE_TIME', 'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."PaymentMethodType" AS ENUM ('CASH', 'TRANSFER', 'CARD', 'DIRECT_DEBIT', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ContractLineType" AS ENUM ('PLAN', 'BONUS', 'SPACE_ACCESS', 'DISCOUNT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."DiscountType" AS ENUM ('NONE', 'PERCENTAGE', 'FIXED_AMOUNT', 'FIXED_PRICE');

-- CreateEnum
CREATE TYPE "public"."ContractConditionType" AS ENUM ('SCHEDULE', 'CANCELLATION', 'NOTICE', 'ACCESS', 'PRICE_EXCEPTION', 'PROMO', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."PromotionStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE', 'EXPIRED');

-- CreateEnum
CREATE TYPE "public"."PromotionType" AS ENUM ('SPECIAL_PRICE', 'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'BONUS_CREDIT');

-- CreateEnum
CREATE TYPE "public"."PromotionScopeType" AS ENUM ('PRODUCT', 'SPACE', 'CONTRACT', 'USER', 'SEGMENT', 'GLOBAL');

-- CreateEnum
CREATE TYPE "public"."BenefitType" AS ENUM ('INCLUDED_CREDIT', 'BONUS_CREDIT', 'DISCOUNT', 'ACCESS_RIGHT');

-- CreateEnum
CREATE TYPE "public"."BalanceStatus" AS ENUM ('ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."PricingSourceType" AS ENUM ('CONTRACT', 'BENEFIT', 'PROMOTION', 'STANDARD_RATE', 'MANUAL');

-- CreateTable
CREATE TABLE "public"."CommercialProduct" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "productType" "public"."CommercialProductType" NOT NULL,
    "targetType" "public"."CommercialTargetType" NOT NULL,
    "billingType" "public"."CommercialBillingType" NOT NULL,
    "defaultUnitType" "public"."CommercialUnitType" NOT NULL,
    "taxMode" "public"."TaxMode" NOT NULL DEFAULT 'EXCLUDED',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "validFrom" TIMESTAMP(3),
    "validTo" TIMESTAMP(3),
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommercialRate" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "unitType" "public"."CommercialUnitType" NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "price" DECIMAL(10,2) NOT NULL,
    "taxMode" "public"."TaxMode" NOT NULL DEFAULT 'EXCLUDED',
    "taxPercent" DECIMAL(5,2),
    "validFrom" TIMESTAMP(3) NOT NULL,
    "validTo" TIMESTAMP(3),
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommercialBenefit" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "benefitType" "public"."BenefitType" NOT NULL,
    "targetType" "public"."CommercialTargetType" NOT NULL,
    "unitType" "public"."CommercialUnitType" NOT NULL,
    "creditAmount" DECIMAL(10,2) NOT NULL,
    "resetEachPeriod" BOOLEAN NOT NULL DEFAULT false,
    "resetFrequency" "public"."PaymentFrequency",
    "rolloverAllowed" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommercialBenefit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Contract" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "status" "public"."ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "contractType" "public"."ContractType" NOT NULL DEFAULT 'OTHER',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "paymentFrequency" "public"."PaymentFrequency" NOT NULL DEFAULT 'MONTHLY',
    "paymentMethod" "public"."PaymentMethodType" NOT NULL DEFAULT 'TRANSFER',
    "paymentTerms" TEXT,
    "agreedCurrency" TEXT NOT NULL DEFAULT 'EUR',
    "notes" TEXT,
    "specialConditionsText" TEXT,
    "signedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractLine" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "productId" INTEGER,
    "spaceId" INTEGER,
    "lineType" "public"."ContractLineType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitType" "public"."CommercialUnitType" NOT NULL,
    "listPrice" DECIMAL(10,2),
    "agreedPrice" DECIMAL(10,2),
    "discountType" "public"."DiscountType" NOT NULL DEFAULT 'NONE',
    "discountValue" DECIMAL(10,2),
    "billingType" "public"."CommercialBillingType" NOT NULL DEFAULT 'RECURRING',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ContractCondition" (
    "id" SERIAL NOT NULL,
    "contractId" INTEGER NOT NULL,
    "conditionType" "public"."ContractConditionType" NOT NULL,
    "title" TEXT NOT NULL,
    "value" TEXT,
    "notes" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContractCondition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Promotion" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."PromotionStatus" NOT NULL DEFAULT 'DRAFT',
    "promotionType" "public"."PromotionType" NOT NULL,
    "scopeType" "public"."PromotionScopeType" NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "isCombinable" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "usageLimitTotal" INTEGER,
    "usageLimitPerUser" INTEGER,
    "metadataJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promotion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PromotionRule" (
    "id" SERIAL NOT NULL,
    "promotionId" INTEGER NOT NULL,
    "targetProductId" INTEGER,
    "targetSpaceId" INTEGER,
    "targetContractId" INTEGER,
    "unitType" "public"."CommercialUnitType",
    "minimumQuantity" DECIMAL(10,2),
    "discountPercent" DECIMAL(5,2),
    "discountAmount" DECIMAL(10,2),
    "specialUnitPrice" DECIMAL(10,2),
    "bonusCreditAmount" DECIMAL(10,2),
    "bonusCreditUnit" "public"."CommercialUnitType",
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromotionRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserCommercialProduct" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "status" "public"."BalanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "priceSnapshot" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "taxMode" "public"."TaxMode",
    "taxPercent" DECIMAL(5,2),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCommercialProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."UserBenefitBalance" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "userCommercialProductId" INTEGER,
    "sourceType" "public"."PricingSourceType" NOT NULL,
    "targetType" "public"."CommercialTargetType" NOT NULL,
    "unitType" "public"."CommercialUnitType" NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "grantedAmount" DECIMAL(10,2) NOT NULL,
    "consumedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "remainingAmount" DECIMAL(10,2) NOT NULL,
    "status" "public"."BalanceStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBenefitBalance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BenefitConsumption" (
    "id" SERIAL NOT NULL,
    "balanceId" INTEGER NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "consumedAmount" DECIMAL(10,2) NOT NULL,
    "unitType" "public"."CommercialUnitType" NOT NULL,
    "consumedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "BenefitConsumption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ReservationPricingSnapshot" (
    "id" SERIAL NOT NULL,
    "reservationId" INTEGER NOT NULL,
    "pricingSource" "public"."PricingSourceType" NOT NULL,
    "contractId" INTEGER,
    "promotionId" INTEGER,
    "benefitBalanceId" INTEGER,
    "appliedProductId" INTEGER,
    "appliedRateId" INTEGER,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "unitType" "public"."CommercialUnitType",
    "quantity" DECIMAL(10,2),
    "baseAmount" DECIMAL(10,2),
    "discountAmount" DECIMAL(10,2),
    "benefitAmount" DECIMAL(10,2),
    "taxAmount" DECIMAL(10,2),
    "finalAmount" DECIMAL(10,2) NOT NULL,
    "explanation" TEXT,
    "snapshotJson" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReservationPricingSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CommercialProduct_code_key" ON "public"."CommercialProduct"("code");

-- CreateIndex
CREATE INDEX "CommercialProduct_isActive_idx" ON "public"."CommercialProduct"("isActive");

-- CreateIndex
CREATE INDEX "CommercialProduct_productType_idx" ON "public"."CommercialProduct"("productType");

-- CreateIndex
CREATE INDEX "CommercialProduct_targetType_idx" ON "public"."CommercialProduct"("targetType");

-- CreateIndex
CREATE INDEX "CommercialRate_productId_isActive_idx" ON "public"."CommercialRate"("productId", "isActive");

-- CreateIndex
CREATE INDEX "CommercialRate_validFrom_validTo_idx" ON "public"."CommercialRate"("validFrom", "validTo");

-- CreateIndex
CREATE INDEX "CommercialBenefit_productId_isActive_idx" ON "public"."CommercialBenefit"("productId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_code_key" ON "public"."Contract"("code");

-- CreateIndex
CREATE INDEX "Contract_userId_status_idx" ON "public"."Contract"("userId", "status");

-- CreateIndex
CREATE INDEX "Contract_startDate_endDate_idx" ON "public"."Contract"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "ContractLine_contractId_isActive_idx" ON "public"."ContractLine"("contractId", "isActive");

-- CreateIndex
CREATE INDEX "ContractLine_productId_idx" ON "public"."ContractLine"("productId");

-- CreateIndex
CREATE INDEX "ContractLine_spaceId_idx" ON "public"."ContractLine"("spaceId");

-- CreateIndex
CREATE INDEX "ContractCondition_contractId_isActive_idx" ON "public"."ContractCondition"("contractId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "public"."Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_status_idx" ON "public"."Promotion"("status");

-- CreateIndex
CREATE INDEX "Promotion_startDate_endDate_idx" ON "public"."Promotion"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "PromotionRule_promotionId_isActive_idx" ON "public"."PromotionRule"("promotionId", "isActive");

-- CreateIndex
CREATE INDEX "PromotionRule_targetProductId_idx" ON "public"."PromotionRule"("targetProductId");

-- CreateIndex
CREATE INDEX "PromotionRule_targetSpaceId_idx" ON "public"."PromotionRule"("targetSpaceId");

-- CreateIndex
CREATE INDEX "PromotionRule_targetContractId_idx" ON "public"."PromotionRule"("targetContractId");

-- CreateIndex
CREATE INDEX "UserCommercialProduct_userId_status_idx" ON "public"."UserCommercialProduct"("userId", "status");

-- CreateIndex
CREATE INDEX "UserCommercialProduct_productId_idx" ON "public"."UserCommercialProduct"("productId");

-- CreateIndex
CREATE INDEX "UserCommercialProduct_contractId_idx" ON "public"."UserCommercialProduct"("contractId");

-- CreateIndex
CREATE INDEX "UserBenefitBalance_userId_status_idx" ON "public"."UserBenefitBalance"("userId", "status");

-- CreateIndex
CREATE INDEX "UserBenefitBalance_productId_idx" ON "public"."UserBenefitBalance"("productId");

-- CreateIndex
CREATE INDEX "UserBenefitBalance_expiresAt_idx" ON "public"."UserBenefitBalance"("expiresAt");

-- CreateIndex
CREATE INDEX "BenefitConsumption_balanceId_idx" ON "public"."BenefitConsumption"("balanceId");

-- CreateIndex
CREATE INDEX "BenefitConsumption_reservationId_idx" ON "public"."BenefitConsumption"("reservationId");

-- CreateIndex
CREATE UNIQUE INDEX "ReservationPricingSnapshot_reservationId_key" ON "public"."ReservationPricingSnapshot"("reservationId");

-- CreateIndex
CREATE INDEX "ReservationPricingSnapshot_pricingSource_idx" ON "public"."ReservationPricingSnapshot"("pricingSource");

-- CreateIndex
CREATE INDEX "ReservationPricingSnapshot_contractId_idx" ON "public"."ReservationPricingSnapshot"("contractId");

-- CreateIndex
CREATE INDEX "ReservationPricingSnapshot_promotionId_idx" ON "public"."ReservationPricingSnapshot"("promotionId");

-- AddForeignKey
ALTER TABLE "public"."CommercialRate" ADD CONSTRAINT "CommercialRate_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommercialBenefit" ADD CONSTRAINT "CommercialBenefit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Contract" ADD CONSTRAINT "Contract_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractLine" ADD CONSTRAINT "ContractLine_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractLine" ADD CONSTRAINT "ContractLine_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CommercialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractLine" ADD CONSTRAINT "ContractLine_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "public"."Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ContractCondition" ADD CONSTRAINT "ContractCondition_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRule" ADD CONSTRAINT "PromotionRule_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRule" ADD CONSTRAINT "PromotionRule_targetProductId_fkey" FOREIGN KEY ("targetProductId") REFERENCES "public"."CommercialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRule" ADD CONSTRAINT "PromotionRule_targetSpaceId_fkey" FOREIGN KEY ("targetSpaceId") REFERENCES "public"."Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PromotionRule" ADD CONSTRAINT "PromotionRule_targetContractId_fkey" FOREIGN KEY ("targetContractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCommercialProduct" ADD CONSTRAINT "UserCommercialProduct_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCommercialProduct" ADD CONSTRAINT "UserCommercialProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserCommercialProduct" ADD CONSTRAINT "UserCommercialProduct_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBenefitBalance" ADD CONSTRAINT "UserBenefitBalance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBenefitBalance" ADD CONSTRAINT "UserBenefitBalance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."CommercialProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."UserBenefitBalance" ADD CONSTRAINT "UserBenefitBalance_userCommercialProductId_fkey" FOREIGN KEY ("userCommercialProductId") REFERENCES "public"."UserCommercialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BenefitConsumption" ADD CONSTRAINT "BenefitConsumption_balanceId_fkey" FOREIGN KEY ("balanceId") REFERENCES "public"."UserBenefitBalance"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."BenefitConsumption" ADD CONSTRAINT "BenefitConsumption_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReservationPricingSnapshot" ADD CONSTRAINT "ReservationPricingSnapshot_reservationId_fkey" FOREIGN KEY ("reservationId") REFERENCES "public"."Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReservationPricingSnapshot" ADD CONSTRAINT "ReservationPricingSnapshot_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "public"."Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReservationPricingSnapshot" ADD CONSTRAINT "ReservationPricingSnapshot_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "public"."Promotion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReservationPricingSnapshot" ADD CONSTRAINT "ReservationPricingSnapshot_benefitBalanceId_fkey" FOREIGN KEY ("benefitBalanceId") REFERENCES "public"."UserBenefitBalance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReservationPricingSnapshot" ADD CONSTRAINT "ReservationPricingSnapshot_appliedProductId_fkey" FOREIGN KEY ("appliedProductId") REFERENCES "public"."CommercialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."ReservationPricingSnapshot" ADD CONSTRAINT "ReservationPricingSnapshot_appliedRateId_fkey" FOREIGN KEY ("appliedRateId") REFERENCES "public"."CommercialRate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
