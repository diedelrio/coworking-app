-- CreateTable
CREATE TABLE "public"."PriceListTargetTag" (
    "priceListId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PriceListTargetTag_pkey" PRIMARY KEY ("priceListId","tagId")
);

-- CreateIndex
CREATE INDEX "PriceListTargetTag_tagId_idx" ON "public"."PriceListTargetTag"("tagId");

-- CreateIndex
CREATE INDEX "PriceListTargetTag_priceListId_idx" ON "public"."PriceListTargetTag"("priceListId");

-- AddForeignKey
ALTER TABLE "public"."PriceListTargetTag" ADD CONSTRAINT "PriceListTargetTag_priceListId_fkey" FOREIGN KEY ("priceListId") REFERENCES "public"."PriceList"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PriceListTargetTag" ADD CONSTRAINT "PriceListTargetTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "public"."Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;
