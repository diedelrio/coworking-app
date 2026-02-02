-- Add active flag and indexes for OfficeClosure

ALTER TABLE "OfficeClosure"
  ADD COLUMN IF NOT EXISTS "active" BOOLEAN NOT NULL DEFAULT true;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS "OfficeClosure_active_idx" ON "OfficeClosure"("active");
CREATE INDEX IF NOT EXISTS "OfficeClosure_date_idx" ON "OfficeClosure"("date");
