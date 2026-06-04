ALTER TABLE "ConsentDefinition"
ADD COLUMN IF NOT EXISTS "defaultAcceptedForNonAdmins" BOOLEAN NOT NULL DEFAULT false;
