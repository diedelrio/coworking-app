// backend/src/services/limitAlertService.js
const prisma = require('../prisma');
const { sendMail } = require('./emailService');

function renderTemplate(text, vars = {}) {
  if (!text) return '';
  return text.replace(/\{\{\s*([a-zA-Z0-9_.-]+)\s*\}\}/g, (_, key) => {
    const val = vars[key];
    return val === undefined || val === null ? '' : String(val);
  });
}

function splitEmails(raw) {
  if (!raw) return [];
  return String(raw)
    .split(/[;,]/g)
    .map(s => s.trim())
    .filter(Boolean);
}

async function getLimitAlertRecipients() {
  // según tu Setting.json, este es el campo real: limit_alert_emails
  const s = await prisma.setting.findUnique({ where: { key: 'limit_alert_emails' } });
  return splitEmails(s?.value);
}

/**
 * Envia email usando EmailTemplate.key = "LIMIT_OVERRIDE_REQUEST"
 * Variables requeridas (según tu EmailTemplate.json):
 * adminName, userName, userEmail, spaceName, spaceType, date, startTime, endTime, limitReason
 */
async function notifyLimitExceeded({ user, space, date, startTime, endTime, limitReason }) {
  const recipients = await getLimitAlertRecipients();

  if (!recipients.length) {
    console.log('[LIMIT ALERT] Sin destinatarios configurados en Setting.limit_alert_emails. Se omite envío.');
    return { skipped: true, reason: 'NO_RECIPIENTS' };
  }

  const tpl = await prisma.emailTemplate.findUnique({
    where: { key: 'LIMIT_OVERRIDE_REQUEST' },
  });

  if (!tpl) {
    console.warn('[LIMIT ALERT] Falta EmailTemplate key=LIMIT_OVERRIDE_REQUEST');
    return { skipped: true, reason: 'TEMPLATE_NOT_FOUND' };
  }

  const vars = {
    adminName: 'Admin',
    userName: user?.name || user?.email || 'Usuario',
    userEmail: user?.email || '',
    spaceName: space?.name || '',
    spaceType: space?.type || '',
    date: date || '',
    startTime: startTime || '',
    endTime: endTime || '',
    limitReason: limitReason || '-',
  };

  const subject = renderTemplate(tpl.subject, vars);
  const body = renderTemplate(tpl.body, vars);

  await sendMail({
    to: recipients.join(','),
    subject,
    text: body,
  });

  return { ok: true, recipients };
}

module.exports = { notifyLimitExceeded };
