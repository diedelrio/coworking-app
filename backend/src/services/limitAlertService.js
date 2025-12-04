// backend/src/services/limitAlertService.js
const { getLimitAlertSettings } = require('./settingsService');
const {
  getEmailTemplateById,
  renderEmailTemplate,
} = require('./emailTemplateService');

/**
 * Simula (por ahora) el envío de un correo de alerta al admin
 * cuando un usuario pide "más espacio" de lo permitido.
 *
 * Más adelante aquí pluggeas tu servicio de correo real.
 */
async function notifyLimitExceeded({
  user,
  space,
  date,
  startTime,
  endTime,
  limitReason,
}) {
  const { emails, subject: subjectOverride, templateId } =
    await getLimitAlertSettings();

  if (!emails.length) {
    console.warn(
      '[notifyLimitExceeded] No hay limit_alert_emails configurados, no se envía nada'
    );
    return;
  }

  const template = await getEmailTemplateById(templateId);

  const variables = {
    userName: user.name ?? '',
    userEmail: user.email ?? '',
    spaceType: space.type,
    spaceName: space.name,
    date,
    startTime,
    endTime,
    limitReason,
    adminName: 'Administrador',
  };

  const { subject, body } = renderEmailTemplate(template, variables);
  const finalSubject = subjectOverride || subject;

  // FUTURO: aquí iría la integración real de correo (SendGrid, SMTP, etc.)
  /*console.log('--- Simulación de envío de correo de límite superado ---');
  console.log('To:', emails.join(', '));
  console.log('Subject:', finalSubject);
  console.log('Body:\n', body);
  console.log('-------------------------------------------------------'); */

  const { sendMail } = require('./emailService');

  await sendMail({
    to: emails.join(','),
    subject: finalSubject,
    text: body,
  });

  console.log('[Correo enviado al administrador]');

}

module.exports = {
  notifyLimitExceeded,
};
