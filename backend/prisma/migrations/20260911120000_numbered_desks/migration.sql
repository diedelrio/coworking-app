ALTER TABLE "Space" ADD COLUMN "numberedDesks" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE "Desk" (
 "id" SERIAL PRIMARY KEY, "spaceId" INTEGER NOT NULL REFERENCES "Space"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "number" INTEGER NOT NULL CHECK ("number" > 0), "active" BOOLEAN NOT NULL DEFAULT true
);
CREATE UNIQUE INDEX "Desk_spaceId_number_key" ON "Desk"("spaceId", "number");
CREATE TABLE "ReservationDesk" (
 "reservationId" INTEGER NOT NULL REFERENCES "Reservation"("id") ON DELETE CASCADE ON UPDATE CASCADE,
 "deskId" INTEGER NOT NULL REFERENCES "Desk"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ReservationDesk_pkey" PRIMARY KEY ("reservationId", "deskId")
);
CREATE INDEX "ReservationDesk_deskId_idx" ON "ReservationDesk"("deskId");
CREATE TABLE "FixedDeskAssignment" (
 "id" SERIAL PRIMARY KEY, "deskId" INTEGER NOT NULL REFERENCES "Desk"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 "occupantName" TEXT NOT NULL, "startTime" TIMESTAMP(3) NOT NULL,
 "endTime" TIMESTAMP(3), "active" BOOLEAN NOT NULL DEFAULT true,
 CONSTRAINT "FixedDeskAssignment_valid_interval" CHECK ("endTime" IS NULL OR "endTime" > "startTime")
);
CREATE INDEX "FixedDeskAssignment_deskId_startTime_idx" ON "FixedDeskAssignment"("deskId", "startTime");
