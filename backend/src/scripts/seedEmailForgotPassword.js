// prisma/seed.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  await prisma.emailTemplate.upsert({
    where: { key: 'FORGOT_PASSWORD' },
    update: {
      name: 'Forgot Password',
      subject: 'Restablecer contraseña - Coworking',
      body: `
Hola {{name}},

Recibimos una solicitud para restablecer tu contraseña.

Usá este enlace para crear una nueva contraseña (válido por {{ttlMinutes}} minutos):
{{resetLink}}

Si vos no solicitaste este cambio, podés ignorar este correo.

Saludos,
Coworking
      `.trim(),
    },
    create: {
      key: 'FORGOT_PASSWORD',
      name: 'Forgot Password',
      subject: 'Restablecer contraseña - Coworking',
      body: `
Hola {{name}},

Recibimos una solicitud para restablecer tu contraseña.

Usá este enlace para crear una nueva contraseña (válido por {{ttlMinutes}} minutos):
{{resetLink}}

Si vos no solicitaste este cambio, podés ignorar este correo.

Saludos,
Coworking
      `.trim(),
    },
  });

  console.log('✅ Seed EmailTemplate: FORGOT_PASSWORD listo');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
