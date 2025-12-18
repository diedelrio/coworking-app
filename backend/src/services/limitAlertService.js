const { getActiveSettingsMap } = require('./settingsService');
const { sendMail } = require('./emailService'); // ajusta el path si tu mail service está en otro lado

function toBool(val, fallback = true) {
  if (val == null) return fallback;
  const v = String(val).toLowerCase().trim();
  if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;
  return fallback;
}

async function getLimitAlertConfig() {
  const keys = [
    'LIMIT_ALERT_EMAIL_ENABLED',
    'LIMIT_ALERT_TO_EMAIL',
    'LIMIT_ALERT_SUBJECT',
  ];

  const m = await getActiveSettingsMap(keys);

  const enabled = toBool(m.LIMIT_ALERT_EMAIL_ENABLED?.value, true);
  const toEmail = m.LIMIT_ALERT_TO_EMAIL?.value || process.env.ADMIN_EMAIL || null;
  const subject = m.LIMIT_ALERT_SUBJECT?.value || 'Solicitud de ampliación de límite';

  return { enabled, toEmail, subject };
}

async function notifyLimitExceeded({ user, space, date, startTime, endTime, limitReason }) {
  const cfg = await getLimitAlertConfig();

  // Si no hay destinatario, no rompemos el flujo
  if (!cfg.toEmail) {
    console.log('[LIMIT ALERT] Sin destinatario configurado. Se omite envío.');
    return { skipped: true, reason: 'NO_TO_EMAIL' };
  }

  if (!cfg.enabled) {
    console.log('[LIMIT ALERT DISABLED]', { to: cfg.toEmail, user: user?.email, space: space?.name });
    return { skipped: true, reason: 'DISABLED' };
  }

  const text =
`Solicitud de ampliación de límite

Usuario: ${user?.name || ''} (${user?.email || ''})
Espacio: ${space?.name || ''} (ID: ${space?.id})
Fecha: ${date}
Horario: ${startTime} - ${endTime}

Motivo:
${limitReason || '-'}`;

  await sendMail({
    to: cfg.toEmail,
    subject: cfg.subject,
    text,
  });

  return { ok: true };
}

module.exports = {
  notifyLimitExceeded,
};
