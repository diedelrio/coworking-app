// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.emailTemplate.upsert({
    where: { key: 'PASSWORD_CHANGED' },
    update: {
      name: 'Password Changed',
      subject: 'Tu contraseña fue actualizada - Coworking',
      body: `
Hola {{name}},

Tu contraseña fue actualizada correctamente.

Fecha y hora: {{dateTime}}
IP: {{ip}}
Dispositivo/Navegador: {{userAgent}}

Si no fuiste vos, contactá al administrador inmediatamente.

Saludos,
Coworking
      `.trim(),
    },
    create: {
      key: 'PASSWORD_CHANGED',
      name: 'Password Changed',
      subject: 'Tu contraseña fue actualizada - Coworking',
      body: `
Hola {{name}},

Tu contraseña fue actualizada correctamente.

Fecha y hora: {{dateTime}}
IP: {{ip}}
Dispositivo/Navegador: {{userAgent}}

Si no fuiste vos, contactá al administrador inmediatamente.

Saludos,
Coworking
      `.trim(),
    },
  });

  console.log('✅ Seed EmailTemplate: PASSWORD_CHANGED listo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
