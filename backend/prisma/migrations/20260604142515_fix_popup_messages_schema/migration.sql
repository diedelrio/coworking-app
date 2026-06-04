-- AlterTable
ALTER TABLE "PopupMessage" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "UserPopupMessageRead_popupMessageId_idx" ON "UserPopupMessageRead"("popupMessageId");
