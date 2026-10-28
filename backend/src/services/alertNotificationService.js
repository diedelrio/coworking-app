const prisma = require('../prisma');
const { sendMail } = require('./emailService');

function renderTemplate(text, vars = {}) {
  if (!text) return '';
  return text.replace(/\{\{(\w+)\}\}/g, (_, key) => {
    const val = vars[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

async function getAdminRecipients() {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', active: true },
    select: { email: true },
  });

  const dbEmails = (admins || []).map(a => a.email).filter(Boolean);

  // fallback opcional (por si querés un buzón fijo sin depender de usuarios)
  const envEmails = (process.env.ADMIN_NOTIFICATION_EMAILS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  return Array.from(new Set([...dbEmails, ...envEmails]));
}

const APP_TIME_ZONE = 'Europe/Madrid';

function formatDateES(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: APP_TIME_ZONE,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

function formatTimeHHMM(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';

  return new Intl.DateTimeFormat('es-ES', {
    timeZone: APP_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Notifica al admin: Reserva pendiente de aprobación
 * Requiere EmailTemplate.key = "RESERVATION_PENDING_APPROVAL"
 */
async function notifyReservationPendingApproval({ reservation, user, space }) {
  const recipients = await getAdminRecipients();

  if (!recipients.length) {
    console.warn('[alertNotificationService] No hay emails de admins (DB ni ENV).');
    return { sent: false, reason: 'NO_RECIPIENTS' };
  }

  const tpl = await prisma.emailTemplate.findUnique({
    where: { key: 'RESERVATION_PENDING_APPROVAL' },
  });

  if (!tpl) {
    console.warn('[alertNotificationService] Falta EmailTemplate key=RESERVATION_PENDING_APPROVAL');
    return { sent: false, reason: 'TEMPLATE_NOT_FOUND' };
  }

  const vars = {
    adminName: 'Admin',
    userName: user?.name || '',
    userEmail: user?.email || '',
    spaceName: space?.name || '',
    spaceType: space?.type || '',
    date: formatDateES(reservation?.date),
    startTime: formatTimeHHMM(reservation?.startTime),
    endTime: formatTimeHHMM(reservation?.endTime),
    reservationId: reservation?.id ?? '',
  };

  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);

  await sendMail({
    to: recipients,
    subject,
    text: body,
  });

  return { sent: true, recipients };
}

async function notifyReservationApprovedToUser({ reservation, user, space }) {
  if (!user?.email) {
    console.warn('[alertNotificationService] Usuario sin email, no se puede notificar aprobación.');
    return { sent: false, reason: 'USER_NO_EMAIL' };
  }

  const tpl = await prisma.emailTemplate.findUnique({
    where: { key: 'RESERVATION_APPROVED_USER' },
  });

  if (!tpl) {
    console.warn('[alertNotificationService] Falta EmailTemplate key=RESERVATION_APPROVED_USER');
    return { sent: false, reason: 'TEMPLATE_NOT_FOUND' };
  }

  const vars = {
    userName: user?.name || '',
    userEmail: user?.email || '',
    spaceName: space?.name || '',
    spaceType: space?.type || '',
    date: formatDateES(reservation?.date),
    startTime: formatTimeHHMM(reservation?.startTime),
    endTime: formatTimeHHMM(reservation?.endTime),
    reservationId: reservation?.id ?? '',
  };

  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);

  await sendMail({
    to: user.email,
    subject,
    text: body,
  });

  return { sent: true, recipient: user.email };
}

async function notifyReservationRejectedToUser({ reservation, user, space, reason }) {
  if (!user?.email) {
    console.warn('[alertNotificationService] Usuario sin email, no se puede notificar rechazo.');
    return { sent: false, reason: 'USER_NO_EMAIL' };
  }

  const tpl = await prisma.emailTemplate.findUnique({
    where: { key: 'RESERVATION_REJECTED_USER' },
  });

  if (!tpl) {
    console.warn('[alertNotificationService] Falta EmailTemplate key=RESERVATION_REJECTED_USER');
    return { sent: false, reason: 'TEMPLATE_NOT_FOUND' };
  }

  const vars = {
    userName: user?.name || '',
    userEmail: user?.email || '',
    spaceName: space?.name || '',
    spaceType: space?.type || '',
    date: formatDateES(reservation?.date),
    startTime: formatTimeHHMM(reservation?.startTime),
    endTime: formatTimeHHMM(reservation?.endTime),
    reservationId: reservation?.id ?? '',
    reason: reason?.trim() ? reason.trim() : 'No especificado.',
  };

  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);

  await sendMail({
    to: user.email,
    subject,
    text: body,
  });

  return { sent: true, recipient: user.email };
}

const DEFAULT_CANCELLED_SUBJECT = 'Reserva cancelada: {{spaceName}} el {{date}}';
const DEFAULT_CANCELLED_BODY = [
  'Hola {{adminName}},',
  '',
  '{{userName}} ({{userEmail}}) canceló una reserva:',
  '',
  'Espacio: {{spaceName}}',
  'Fecha: {{date}}',
  'Horario: {{startTime}} - {{endTime}}',
  'Reserva Nº: {{reservationId}}',
  '',
  'El espacio quedó libre para ese horario.',
].join(String.fromCharCode(10));

/**
 * Avisa a los admins de que un usuario canceló una reserva:
 *  - email (EmailTemplate key = "RESERVATION_CANCELLED_ADMIN" si existe; si no, texto por defecto)
 *  - popup en el portal ADMIN, que cada admin ve al iniciar sesión (vence en 14 días)
 * Ambos canales son independientes: si falla uno, el otro se intenta igual.
 */
async function notifyReservationCancelledToAdmins({ reservation, user, space }) {
  const vars = {
    adminName: 'Admin',
    userName: [user?.name, user?.lastName].filter(Boolean).join(' '),
    userEmail: user?.email || '',
    spaceName: space?.name || '',
    spaceType: space?.type || '',
    date: formatDateES(reservation?.date),
    startTime: formatTimeHHMM(reservation?.startTime),
    endTime: formatTimeHHMM(reservation?.endTime),
    reservationId: reservation?.id ?? '',
  };

  const result = { email: null, popup: null };

  try {
    const recipients = await getAdminRecipients();
    if (!recipients.length) {
      console.warn('[alertNotificationService] No hay emails de admins (DB ni ENV).');
      result.email = { sent: false, reason: 'NO_RECIPIENTS' };
    } else {
      const tpl = await prisma.emailTemplate.findUnique({ where: { key: 'RESERVATION_CANCELLED_ADMIN' } });
      await sendMail({
        to: recipients,
        subject: renderTemplate(tpl?.subject || DEFAULT_CANCELLED_SUBJECT, vars),
        text: renderTemplate(tpl?.body || DEFAULT_CANCELLED_BODY, vars),
      });
      result.email = { sent: true, recipients };
    }
  } catch (err) {
    console.error('[alertNotificationService] No se pudo enviar el email de cancelación:', err);
    result.email = { sent: false, reason: 'ERROR' };
  }

  try {
    const popup = await prisma.popupMessage.create({
      data: {
        title: 'Reserva cancelada',
        description: `${vars.userName || vars.userEmail} canceló su reserva en ${vars.spaceName} el ${vars.date} de ${vars.startTime} a ${vars.endTime} (Nº ${vars.reservationId}).`,
        portal: 'ADMIN',
        category: 'CANCELLATION',
        active: true,
        showFrom: new Date(),
        showUntil: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
        showOnce: true,
        requireConfirmation: true,
      },
      select: { id: true },
    });
    result.popup = { created: true, id: popup.id };
  } catch (err) {
    console.error('[alertNotificationService] No se pudo crear el popup de cancelación:', err);
    result.popup = { created: false, reason: 'ERROR' };
  }

  return result;
}

module.exports = {
  notifyReservationCancelledToAdmins,
  notifyReservationPendingApproval,
  notifyReservationApprovedToUser,  
  notifyReservationRejectedToUser,
};
