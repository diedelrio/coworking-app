CREATE TABLE IF NOT EXISTS "PopupMessage" (
  "id" SERIAL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "portal" TEXT NOT NULL DEFAULT 'BOTH',
  "category" TEXT NOT NULL DEFAULT 'SYSTEM',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "showFrom" TIMESTAMP(3),
  "showUntil" TIMESTAMP(3),
  "showOnce" BOOLEAN NOT NULL DEFAULT true,
  "requireConfirmation" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "UserPopupMessageRead" (
  "id" SERIAL PRIMARY KEY,
  "userId" INTEGER NOT NULL,
  "popupMessageId" INTEGER NOT NULL,
  "readAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserPopupMessageRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserPopupMessageRead_popupMessageId_fkey" FOREIGN KEY ("popupMessageId") REFERENCES "PopupMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "UserPopupMessageRead_userId_popupMessageId_key"
ON "UserPopupMessageRead"("userId", "popupMessageId");

CREATE INDEX IF NOT EXISTS "PopupMessage_active_showFrom_showUntil_idx"
ON "PopupMessage"("active", "showFrom", "showUntil");

CREATE INDEX IF NOT EXISTS "PopupMessage_portal_idx"
ON "PopupMessage"("portal");
