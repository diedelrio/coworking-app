const bcrypt = require("bcryptjs");
const prisma = require("../prisma"); // ajusta si tu prisma client está en otra ruta

async function bootstrapMasterAdmin() {
  const masterEmail = process.env.MASTER_ADMIN_EMAIL;
  const masterPass = process.env.MASTER_ADMIN_PASSWORD;

  if (!masterEmail || !masterPass) {
    console.warn("[bootstrap] MASTER_ADMIN_EMAIL/PASSWORD not set. Skipping.");
    return;
  }

  const existingAdmin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
  });

  if (existingAdmin) {
    console.log("[bootstrap] Admin already exists. Skipping.");
    return;
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: masterEmail },
  });

  if (existingUser) {
    await prisma.user.update({
      where: { id: existingUser.id },
      data: { role: "ADMIN", active: true },
    });
    console.log("[bootstrap] Promoted existing user to ADMIN");
    return;
  }

  const hashed = await bcrypt.hash(masterPass, 10);

  await prisma.user.create({
    data: {
      name: process.env.MASTER_ADMIN_NAME || "Admin",
      lastName: process.env.MASTER_ADMIN_LASTNAME || "Master",
      email: masterEmail,
      phone: process.env.MASTER_ADMIN_PHONE || null,
      password: hashed,
      role: "ADMIN",
      active: true,
    },
  });

  console.log("[bootstrap] Master ADMIN created");
}

module.exports = { bootstrapMasterAdmin };