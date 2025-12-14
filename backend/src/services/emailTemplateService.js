// backend/src/services/emailTemplateService.js
const prisma = require('../prisma');

async function getEmailTemplateById(id) {
  const template = await prisma.emailTemplate.findUnique({
    where: { id: Number(id) },
  });

  if (!template) {
    throw new Error('EmailTemplate no encontrado');
  }

  return template;
}

/**
 * Reemplaza {{clave}} en un string por variables[clave]
 */
function renderTemplateString(templateString, variables = {}) {
  if (!templateString) return '';

  return templateString.replace(/{{\s*([^}]+)\s*}}/g, (match, key) => {
    const trimmedKey = key.trim();
    const value = variables[trimmedKey];
    return value != null ? String(value) : match;
  });
}

function renderEmailTemplate(template, variables = {}) {
  const subject = renderTemplateString(template.subject, variables);
  const body = renderTemplateString(template.body, variables);
  return { subject, body };
}

async function getEmailTemplateByKey(key) {
  const template = await prisma.emailTemplate.findUnique({
    where: { key },
  });

  if (!template) {
    throw new Error('EmailTemplate no encontrado');
  }

  return template;
}

module.exports = {
  getEmailTemplateById,
  renderTemplateString,
  renderEmailTemplate,
  getEmailTemplateByKey,
};
