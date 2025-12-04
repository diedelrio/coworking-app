const nodemailer = require('nodemailer');

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
  const transporter = getTransporter();

  const mailOptions = {
    from: `"Coworking Sinergia" <${process.env.SMTP_USER}>`,
    to,
    subject,
    text,
  };

  await transporter.sendMail(mailOptions);
}

module.exports = {
  sendMail,
};
