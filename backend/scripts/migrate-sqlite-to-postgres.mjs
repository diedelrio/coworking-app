import dotenv from "dotenv";
dotenv.config();

import { PrismaClient as PgClient } from "@prisma/client";
import { PrismaClient as SqliteClient } from "../generated/sqlite/index.js";



const pg = new PgClient();
const sqlite = new SqliteClient();

async function main() {
  console.log("🔎 Reading from SQLite...");
  const users = await sqlite.user.findMany();
  const spaces = await sqlite.space.findMany();
  const reservations = await sqlite.reservation.findMany();

  // Opcionales si existen en tu schema
  const settings = sqlite.setting ? await sqlite.setting.findMany() : [];
  const settingHistory = sqlite.settingHistory ? await sqlite.settingHistory.findMany() : [];
  const emailTemplates = sqlite.emailTemplate ? await sqlite.emailTemplate.findMany() : [];
  const userHistory = sqlite.userHistory ? await sqlite.userHistory.findMany() : [];
  const passwordResetTokens = sqlite.passwordResetToken ? await sqlite.passwordResetToken.findMany() : [];

  console.log(`✅ SQLite rows: users=${users.length}, spaces=${spaces.length}, reservations=${reservations.length}`);

  console.log("✍️ Writing to Postgres (Neon)...");

  // Limpieza (orden FK)
  if (pg.passwordResetToken) await pg.passwordResetToken.deleteMany();
  if (pg.userHistory) await pg.userHistory.deleteMany();
  if (pg.reservation) await pg.reservation.deleteMany();
  if (pg.space) await pg.space.deleteMany();
  if (pg.emailTemplate) await pg.emailTemplate.deleteMany();
  if (pg.settingHistory) await pg.settingHistory.deleteMany();
  if (pg.setting) await pg.setting.deleteMany();
  await pg.user.deleteMany();

  // Insert orden FK
  for (const u of users) await pg.user.create({ data: u });
  for (const s of spaces) await pg.space.create({ data: s });
  for (const r of reservations) await pg.reservation.create({ data: r });

  if (pg.setting && settings.length) for (const x of settings) await pg.setting.create({ data: x });
  if (pg.settingHistory && settingHistory.length) for (const x of settingHistory) await pg.settingHistory.create({ data: x });
  if (pg.emailTemplate && emailTemplates.length) for (const x of emailTemplates) await pg.emailTemplate.create({ data: x });
  if (pg.userHistory && userHistory.length) for (const x of userHistory) await pg.userHistory.create({ data: x });
  if (pg.passwordResetToken && passwordResetTokens.length) for (const x of passwordResetTokens) await pg.passwordResetToken.create({ data: x });

  console.log("🎉 Migration OK");
}

main()
  .catch((e) => {
    console.error("❌ Migration failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await sqlite.$disconnect();
    await pg.$disconnect();
  });
