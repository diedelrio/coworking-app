const prisma = require('../prisma');

async function main() {
  const key = 'limit_override_request';

  const existing = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (existing) {
    console.log('EmailTemplate ya existe, no se crea de nuevo.');
    return;
  }

  await prisma.emailTemplate.create({
    data: {
      key,
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
  .catch((e) => {
    console.error(e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
