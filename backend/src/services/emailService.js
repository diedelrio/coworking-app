const nodemailer = require('nodemailer');
const EMAIL_ENABLED = String(process.env.EMAIL_ENABLED || 'true').toLowerCase() === 'true';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;

  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  return transporter;
}

async function sendMail({ to, subject, text }) {
  if (!EMAIL_ENABLED) {
    console.log('[EMAIL DISABLED] to=%s subject=%s', to, subject);
    return { skipped: true, disabled: true };
  }

  const transporter = getTransporter();

  const mailOptions = {
    from: `"Coworking Sinergia" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
  module.exports = { sendMail };
}
