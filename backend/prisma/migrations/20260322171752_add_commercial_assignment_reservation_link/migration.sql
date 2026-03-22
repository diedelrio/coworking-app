-- AlterTable
ALTER TABLE "public"."CommercialProduct" ADD COLUMN     "defaultSpaceId" INTEGER,
ADD COLUMN     "requiresReservation" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "public"."Reservation" ADD COLUMN     "userCommercialProductId" INTEGER;

-- AddForeignKey
ALTER TABLE "public"."Reservation" ADD CONSTRAINT "Reservation_userCommercialProductId_fkey" FOREIGN KEY ("userCommercialProductId") REFERENCES "public"."UserCommercialProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommercialProduct" ADD CONSTRAINT "CommercialProduct_defaultSpaceId_fkey" FOREIGN KEY ("defaultSpaceId") REFERENCES "public"."Space"("id") ON DELETE SET NULL ON UPDATE CASCADE;
