// backend/src/routes/operations/helpers.js
// Utilidades compartidas por las rutas de /api/admin/operations.
const prisma = require('../../prisma');
const crypto = require('crypto');
const { sendMail } = require('../../services/emailService');
const { getEmailTemplateByKey, renderEmailTemplate } = require('../../services/emailTemplateService');
const { joinFrontendUrl } = require('../../utils/frontendUrl');

const EMAIL_MESSAGE_TYPES = ['SYSTEM', 'COMMERCIAL_COMMUNICATIONS', 'SOCIAL_COMMUNICATIONS'];

const MESSAGE_TYPE_TO_CONSENT_TYPE = {
  COMMERCIAL_COMMUNICATIONS: 'COMMERCIAL_COMMUNICATIONS',
  SOCIAL_COMMUNICATIONS: 'SOCIAL_COMMUNICATIONS',
};

function normalizeEmailMessageType(value) {
  const type = String(value || 'SYSTEM').toUpperCase();
  return EMAIL_MESSAGE_TYPES.includes(type) ? type : 'SYSTEM';
}

function displayUser(u) {
  return `${u.name || ''} ${u.lastName || ''}`.trim() || u.email || `Usuario ${u.id}`;
}

async function filterUsersByTemplateConsent(users, template) {
  const messageType = normalizeEmailMessageType(template?.messageType);

  if (messageType === 'SYSTEM') {
    return {
      messageType,
      consentType: null,
      allowedUsers: users,
      blockedRows: [],
      requiredConsents: [],
    };
  }

  const consentType = MESSAGE_TYPE_TO_CONSENT_TYPE[messageType];
  const requiredConsents = await prisma.consentDefinition.findMany({
    where: {
      type: consentType,
      active: true,
      requiresAcceptance: true,
    },
    select: {
      id: true,
      title: true,
      version: true,
      type: true,
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
  });

  if (!requiredConsents.length) {
    return {
      messageType,
      consentType,
      allowedUsers: [],
      requiredConsents: [],
      blockedRows: users.map((u) => ({
        userId: u.id,
        email: u.email,
        name: displayUser(u),
        reason: `No existe un consentimiento activo de tipo ${consentType}.`,
      })),
    };
  }

  const userIds = users.map((u) => u.id);
  const consentIds = requiredConsents.map((c) => c.id);

  const acceptances = await prisma.userConsentAcceptance.findMany({
    where: {
      userId: { in: userIds },
      consentDefinitionId: { in: consentIds },
    },
    orderBy: { acceptedAt: 'desc' },
    select: {
      userId: true,
      consentDefinitionId: true,
      consentVersion: true,
      accepted: true,
      acceptedAt: true,
    },
  });

  const latestByUserAndConsent = new Map();
  for (const acceptance of acceptances) {
    const key = `${acceptance.userId}:${acceptance.consentDefinitionId}`;
    if (!latestByUserAndConsent.has(key)) latestByUserAndConsent.set(key, acceptance);
  }

  const allowedUsers = [];
  const blockedRows = [];

  for (const user of users) {
    const missing = [];

    for (const consent of requiredConsents) {
      const acceptance = latestByUserAndConsent.get(`${user.id}:${consent.id}`);
      const acceptedCurrentVersion =
        acceptance &&
        acceptance.accepted === true &&
        String(acceptance.consentVersion) === String(consent.version);

      if (!acceptedCurrentVersion) {
        missing.push(`${consent.title} v${consent.version}`);
      }
    }

    if (missing.length) {
      blockedRows.push({
        userId: user.id,
        email: user.email,
        name: displayUser(user),
        reason: `No acepta ${consentType}: ${missing.join(', ')}`,
      });
    } else {
      allowedUsers.push(user);
    }
  }

  return {
    messageType,
    consentType,
    allowedUsers,
    blockedRows,
    requiredConsents,
  };
}

function slugify(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function getOrCreateTagBySlug({ slug, name }) {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return null;

  const existing = await prisma.tag.findUnique({ where: { slug: cleanSlug } });
  if (existing) return existing;

  return prisma.tag.create({
    data: {
      slug: cleanSlug,
      name: String(name || cleanSlug),
    },
  });
}


function parseMaybeInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseEndBefore(query) {
  if (query.endBefore) {
    const d = new Date(query.endBefore);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

// -----------------------------
// Alta masiva de usuarios (Batch)
// -----------------------------

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(e) {
  return typeof e === 'string' ? e.trim().toLowerCase() : '';
}

function getActivationTtlMinutes() {
  const n = Number(process.env.ACTIVATE_TOKEN_TTL_MINUTES || 60);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

async function createActivationTokenForUser(userId) {
  await prisma.activationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + getActivationTtlMinutes() * 60 * 1000);

  await prisma.activationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

async function sendActivationEmail({ user, token }) {
  const activationLink = joinFrontendUrl(`activate?token=${token}`);
  const ttlMinutes = getActivationTtlMinutes();

  try {
    const tpl = await getEmailTemplateByKey('CREATE_NEW_USER_BATCH');
    const { subject, body } = renderEmailTemplate(tpl, { name: user.name || '', activationLink, actionUrl: activationLink, ttlMinutes });
    await sendMail({ to: user.email, subject, text: body });
  } catch (e) {
    await sendMail({
      to: user.email,
      subject: 'Activá tu cuenta',
      text: `Hola ${user.name || ''}\n\nActivá tu cuenta aquí: ${activationLink}\n\nEste link vence en ${ttlMinutes} minutos.`,
    });
  }
}

function normalizeUserRow(raw) {
  const name = (raw.name || raw.nombre || '').trim();
  const lastName = (raw.lastname || raw.apellido || raw['last_name'] || '').trim();
  const email = normalizeEmail(raw.email || raw.mail);
  const phone = (raw.phone || raw.telefono || raw.tel || '').trim() || null;
  const roleRaw = String(raw.role || '').trim().toUpperCase();
  const role = roleRaw === 'ADMIN' ? 'ADMIN' : 'CLIENT';

  return { name, lastName, email, phone, role };
}

function validateUserRow(model) {
  const errors = [];
  if (!model.name) errors.push('name requerido');
  if (!model.lastName) errors.push('lastname requerido');
  if (!model.email) errors.push('email requerido');
  if (model.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(model.email)) errors.push('email inválido');
  if (model.role !== 'CLIENT') errors.push('role no permitido (solo CLIENT)');
  return errors;
}

async function resolveAudienceUsers(audience) {
  const type = String(audience?.type || 'CLIENT').toUpperCase();

  // Por defecto: activos. Caller puede forzar active=false.
  const activeFilter = audience?.active;
  const activeWhere = (activeFilter === true || activeFilter === false) ? activeFilter : true;

  if (type === 'CLIENT') {
    return prisma.user.findMany({
      where: { role: 'CLIENT', active: activeWhere },
      select: { id: true, name: true, lastName: true, email: true },
      orderBy: { id: 'asc' },
    });
  }

  if (type === 'CLASSIFY') {
    const classify = String(audience?.classify || '').toUpperCase();
    if (!['GOOD', 'REGULAR', 'BAD'].includes(classify)) throw new Error('classify inválido');
    return prisma.user.findMany({
      where: { role: 'CLIENT', classify, active: activeWhere },
      select: { id: true, name: true, lastName: true, email: true },
      orderBy: { id: 'asc' },
    });
  }

  if (type === 'TAG') {
    const slug = String(audience?.tagSlug || '').trim();
    if (!slug) throw new Error('tagSlug requerido');

    return prisma.user.findMany({
      where: {
        role: 'CLIENT',
        active: activeWhere,
        userTags: { some: { tag: { slug } } },
      },
      select: { id: true, name: true, lastName: true, email: true },
      orderBy: { id: 'asc' },
    });
  }

  throw new Error('audience.type inválido');
}


async function createResetTokenForUser(userId) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const ttlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt, ttlMinutes };
}

async function sendTemplateEmail({ templateKey, template, user, vars }) {
  const tpl = template || await getEmailTemplateByKey(templateKey);
  const { subject, body } = renderEmailTemplate(tpl, vars);
  await sendMail({ to: user.email, subject, text: body });
}

module.exports = {
  EMAIL_MESSAGE_TYPES,
  MESSAGE_TYPE_TO_CONSENT_TYPE,
  normalizeEmailMessageType,
  displayUser,
  filterUsersByTemplateConsent,
  slugify,
  getOrCreateTagBySlug,
  parseMaybeInt,
  parseEndBefore,
  hashToken,
  normalizeEmail,
  getActivationTtlMinutes,
  createActivationTokenForUser,
  sendActivationEmail,
  normalizeUserRow,
  validateUserRow,
  resolveAudienceUsers,
  createResetTokenForUser,
  sendTemplateEmail,
};
