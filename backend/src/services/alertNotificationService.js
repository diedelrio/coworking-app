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
    where: { role: 'ADMIN' },
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

function formatDateES(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function formatTimeHHMM(dateValue) {
  const d = new Date(dateValue);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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

module.exports = {
  notifyReservationPendingApproval,
  notifyReservationApprovedToUser,  
  notifyReservationRejectedToUser,
};
