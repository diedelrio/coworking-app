// backend/src/scripts/seedEmailTemplates.js
const prisma = require('../prisma');

async function main() {
  const NEW_KEY = 'LIMIT_OVERRIDE_REQUEST';
  const OLD_KEY = 'limit_override_request';

  // Si existe con key vieja, la migramos
  const old = await prisma.emailTemplate.findUnique({ where: { key: OLD_KEY } });
  if (old) {
    await prisma.emailTemplate.update({
      where: { id: old.id },
      data: { key: NEW_KEY },
    });
    console.log(`EmailTemplate key migrada: ${OLD_KEY} -> ${NEW_KEY}`);
  }

  // Si ya existe con key nueva, no hacemos nada
  const existing = await prisma.emailTemplate.findUnique({ where: { key: NEW_KEY } });
  if (existing) {
    console.log('EmailTemplate ya existe con key nueva, no se crea de nuevo.');
    return;
  }

  // Crear template si no existe
  await prisma.emailTemplate.create({
    data: {
      key: NEW_KEY,
      name: 'Solicitud extra por límite de reservas',
      subject: 'Solicitud extra de reserva de {{userName}}',
      body: `
Hola {{adminName}},

El usuario {{userName}} ({{userEmail}}) intentó realizar una reserva que supera los límites configurados.

Detalles:
- Espacio: {{spaceName}} ({{spaceType}})
- Fecha: {{date}}
- Horario: {{startTime}} a {{endTime}}
- Motivo: {{limitReason}}

Por favor, ponte en contacto con el usuario para evaluar la solicitud.

Saludos,
Sistema de reservas
      `.trim(),
    },
  });

  console.log('EmailTemplate creado correctamente.');
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
