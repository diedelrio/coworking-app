// backend/src/scripts/seedEmailTemplates.js
const prisma = require('../prisma');

const templates = [
  {
    key: 'LIMIT_OVERRIDE_REQUEST',
    name: 'Solicitud extra por límite de reservas',
    subject: 'Solicitud extra de reserva de {{userName}}',
    body: `Hola {{adminName}},

El usuario {{userName}} ({{userEmail}}) intentó realizar una reserva que supera los límites configurados.

Detalles:
- Espacio: {{spaceName}} ({{spaceType}})
- Fecha: {{date}}
- Horario: {{startTime}} a {{endTime}}
- Motivo: {{limitReason}}

Por favor, ponte en contacto con el usuario para evaluar la solicitud.

Saludos,
Sistema de reservas`.trim(),
  },
  {
    key: 'CREATE_NEW_USER_BATCH',
    name: 'Alta masiva - Activación de cuenta',
    subject: 'Activá tu cuenta en Coworking Sinergia',
    body: `Hola {{name}},

Bienvenido/a a Coworking Sinergia.

Para activar tu cuenta y crear tu contraseña, ingresá al siguiente enlace:
{{activationLink}}

Este enlace vence en {{ttlMinutes}} minutos.

Si el enlace expiró, podés solicitar uno nuevo desde la misma página.

Saludos,
Coworking Sinergia`.trim(),
  },
];

async function main() {
  // Migración de key vieja (legacy)
  const OLD_KEY = 'limit_override_request';
  const old = await prisma.emailTemplate.findUnique({ where: { key: OLD_KEY } });
  if (old) {
    await prisma.emailTemplate.update({ where: { id: old.id }, data: { key: 'LIMIT_OVERRIDE_REQUEST' } });
    console.log(`EmailTemplate key migrada: ${OLD_KEY} -> LIMIT_OVERRIDE_REQUEST`);
  }

  for (const tpl of templates) {
    await prisma.emailTemplate.upsert({
      where: { key: tpl.key },
      create: tpl,
      update: {
        name: tpl.name,
        subject: tpl.subject,
        body: tpl.body,
      },
    });
    console.log(`EmailTemplate upsert: ${tpl.key}`);
  }
}

main()
  .catch((e) => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
