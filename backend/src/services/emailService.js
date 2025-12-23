// backend/src/services/emailService.js
const nodemailer = require('nodemailer');

const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED ?? 'true').toLowerCase() === 'true';

let transporter = null;

function boolEnv(name, fallback = false) {
  const v = process.env[name];
  if (v == null) return fallback;
  return ['true', '1', 'yes', 'y', 'on'].includes(String(v).toLowerCase().trim());
}

function intEnv(name, fallback) {
  const n = Number.parseInt(String(process.env[name] ?? ''), 10);
  return Number.isFinite(n) ? n : fallback;
}

function getTransporter() {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = intEnv('SMTP_PORT', 465);
  const secure = boolEnv('SMTP_SECURE', port === 465);

  if (!host || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    throw new Error('SMTP env vars missing (SMTP_HOST/SMTP_USER/SMTP_PASS).');
  }

  console.log('[email] SMTP config:', { host, port, secure, user: process.env.SMTP_USER });

  transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 15000,
    greetingTimeout: 15000,
    socketTimeout: 20000,
  });

  return transporter;
}

async function sendMail({ to, subject, text, html, replyTo }) {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] to=%s subject=%s', to, subject);
    return { skipped: true, disabled: true };
  }

  if (!to) throw new Error('sendMail: "to" is required');
  if (!subject) throw new Error('sendMail: "subject" is required');
  if (!text && !html) throw new Error('sendMail: "text" or "html" is required');

  const from = process.env.MAIL_FROM || `"Coworking Sinergia" <${process.env.SMTP_USER}>`;

  const transporter = getTransporter();
  const info = await transporter.sendMail({ from, to, subject, text, html, replyTo });

  console.log('[email] sent:', { messageId: info.messageId, to, subject });
  return info;
}

async function verifySmtp() {
  const transporter = getTransporter();
  await transporter.verify();
  console.log('[email] SMTP verify OK');
  return true;
}

module.exports = { sendMail, verifySmtp };
