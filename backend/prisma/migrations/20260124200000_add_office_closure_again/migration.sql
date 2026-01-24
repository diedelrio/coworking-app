-- Reintroduce OfficeClosure table (coworking closures / holidays)

CREATE TABLE IF NOT EXISTS "OfficeClosure" (
  "id" SERIAL PRIMARY KEY,
  "date" TIMESTAMP(3) NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS "OfficeClosure_date_key" ON "OfficeClosure"("date");
CREATE INDEX IF NOT EXISTS "OfficeClosure_date_idx" ON "OfficeClosure"("date");
