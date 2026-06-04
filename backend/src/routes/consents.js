const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

const VALID_TYPES = ['TERMS_AND_POLICIES', 'COMMERCIAL_COMMUNICATIONS', 'SOCIAL_COMMUNICATIONS', 'OTHER'];

function normalizeBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'undefined' || value === null) return fallback;
  return String(value).toLowerCase() === 'true';
}

function normalizeKey(value, fallbackTitle = '') {
  const raw = String(value || fallbackTitle || '').trim();
  return raw
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '') || `CONSENT_${Date.now()}`;
}

function sanitizeDocuments(documents = []) {
  if (!Array.isArray(documents)) return [];
  return documents
    .filter((doc) => doc && doc.title && doc.fileName && doc.contentBase64)
    .map((doc, index) => ({
      title: String(doc.title).trim(),
      fileName: String(doc.fileName).trim(),
      mimeType: String(doc.mimeType || 'application/octet-stream').trim(),
      contentBase64: String(doc.contentBase64).replace(/^data:[^;]+;base64,/, ''),
      active: normalizeBool(doc.active, true),
      downloadEnabled: normalizeBool(doc.downloadEnabled, true),
      sortOrder: Number.isFinite(Number(doc.sortOrder)) ? Number(doc.sortOrder) : index,
    }));
}

function selectConsent(includeAcceptances = false) {
  return {
    id: true,
    key: true,
    title: true,
    type: true,
    version: true,
    description: true,
    active: true,
    required: true,
    requiresAcceptance: true,
    showDocumentsToUser: true,
    allowUserDownloadDocuments: true,
    createdAt: true,
    updatedAt: true,
    documents: {
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        title: true,
        fileName: true,
        mimeType: true,
        active: true,
        downloadEnabled: true,
        sortOrder: true,
        createdAt: true,
      },
    },
    ...(includeAcceptances
      ? {
          acceptances: {
            orderBy: { acceptedAt: 'desc' },
            take: 10,
            select: {
              id: true,
              userId: true,
              consentVersion: true,
              accepted: true,
              acceptedAt: true,
              source: true,
              user: { select: { id: true, name: true, lastName: true, email: true } },
            },
          },
        }
      : {}),
  };
}

// ADMIN: ABM de consentimientos
router.get('/admin/consents', authRequired, requireAdmin, async (req, res) => {
  try {
    const consents = await prisma.consentDefinition.findMany({
      orderBy: [{ active: 'desc' }, { type: 'asc' }, { title: 'asc' }],
      select: selectConsent(true),
    });
    res.json(consents);
  } catch (err) {
    console.error('ERROR GET /admin/consents', err);
    res.status(500).json({ message: 'Error al obtener consentimientos' });
  }
});

router.post('/admin/consents', authRequired, requireAdmin, async (req, res) => {
  try {
    const { title, key, type, version, description } = req.body;
    if (!title || !version) return res.status(400).json({ message: 'Título y versión son obligatorios' });
    const normalizedType = VALID_TYPES.includes(type) ? type : 'OTHER';
    const documents = sanitizeDocuments(req.body.documents);

    const created = await prisma.consentDefinition.create({
      data: {
        key: normalizeKey(key, title),
        title: String(title).trim(),
        type: normalizedType,
        version: String(version).trim(),
        description: description ? String(description).trim() : null,
        active: normalizeBool(req.body.active, true),
        required: normalizeBool(req.body.required, normalizedType === 'TERMS_AND_POLICIES'),
        requiresAcceptance: normalizeBool(req.body.requiresAcceptance, true),
        showDocumentsToUser: normalizeBool(req.body.showDocumentsToUser, true),
        allowUserDownloadDocuments: normalizeBool(req.body.allowUserDownloadDocuments, true),
        documents: documents.length ? { create: documents } : undefined,
      },
      select: selectConsent(true),
    });
    res.status(201).json(created);
  } catch (err) {
    console.error('ERROR POST /admin/consents', err);
    if (err?.code === 'P2002') return res.status(400).json({ message: 'Ya existe un consentimiento con esa key' });
    res.status(500).json({ message: 'Error al crear consentimiento' });
  }
});

router.put('/admin/consents/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
    const existing = await prisma.consentDefinition.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Consentimiento no encontrado' });

    const { title, key, type, version, description } = req.body;
    const normalizedType = VALID_TYPES.includes(type) ? type : existing.type;
    const documents = sanitizeDocuments(req.body.documents);

    const updated = await prisma.$transaction(async (tx) => {
      const consent = await tx.consentDefinition.update({
        where: { id },
        data: {
          key: typeof key === 'undefined' ? undefined : normalizeKey(key, title || existing.title),
          title: typeof title === 'undefined' ? undefined : String(title).trim(),
          type: normalizedType,
          version: typeof version === 'undefined' ? undefined : String(version).trim(),
          description: typeof description === 'undefined' ? undefined : (description ? String(description).trim() : null),
          active: typeof req.body.active === 'undefined' ? undefined : normalizeBool(req.body.active, existing.active),
          required: typeof req.body.required === 'undefined' ? undefined : normalizeBool(req.body.required, existing.required),
          requiresAcceptance: typeof req.body.requiresAcceptance === 'undefined' ? undefined : normalizeBool(req.body.requiresAcceptance, existing.requiresAcceptance),
          showDocumentsToUser: typeof req.body.showDocumentsToUser === 'undefined' ? undefined : normalizeBool(req.body.showDocumentsToUser, existing.showDocumentsToUser),
          allowUserDownloadDocuments: typeof req.body.allowUserDownloadDocuments === 'undefined' ? undefined : normalizeBool(req.body.allowUserDownloadDocuments, existing.allowUserDownloadDocuments),
        },
      });

      if (Array.isArray(req.body.documents)) {
        await tx.consentDocument.deleteMany({ where: { consentDefinitionId: id } });
        if (documents.length) {
          await tx.consentDocument.createMany({
            data: documents.map((doc) => ({ ...doc, consentDefinitionId: id })),
          });
        }
      }

      return tx.consentDefinition.findUnique({ where: { id }, select: selectConsent(true) });
    });

    res.json(updated);
  } catch (err) {
    console.error('ERROR PUT /admin/consents/:id', err);
    if (err?.code === 'P2002') return res.status(400).json({ message: 'Ya existe un consentimiento con esa key' });
    res.status(500).json({ message: 'Error al actualizar consentimiento' });
  }
});

router.get('/admin/users/:userId/consents', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    if (!Number.isFinite(userId)) return res.status(400).json({ message: 'ID inválido' });
    const acceptances = await prisma.userConsentAcceptance.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
      include: { consentDefinition: { select: { id: true, key: true, title: true, type: true, version: true, active: true } } },
    });
    res.json(acceptances);
  } catch (err) {
    console.error('ERROR GET /admin/users/:userId/consents', err);
    res.status(500).json({ message: 'Error al obtener aceptaciones' });
  }
});

// USER: consentimientos activos + aceptación
router.get('/consents/active', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const consents = await prisma.consentDefinition.findMany({
      where: { active: true },
      orderBy: [{ required: 'desc' }, { type: 'asc' }, { title: 'asc' }],
      select: selectConsent(false),
    });

    const acceptances = await prisma.userConsentAcceptance.findMany({
      where: { userId },
      orderBy: { acceptedAt: 'desc' },
      select: { consentDefinitionId: true, consentVersion: true, accepted: true, acceptedAt: true },
    });

    const latestByConsent = new Map();
    acceptances.forEach((a) => {
      if (!latestByConsent.has(a.consentDefinitionId)) latestByConsent.set(a.consentDefinitionId, a);
    });

    res.json(consents.map((consent) => ({ ...consent, userAcceptance: latestByConsent.get(consent.id) || null })));
  } catch (err) {
    console.error('ERROR GET /consents/active', err);
    res.status(500).json({ message: 'Error al obtener consentimientos activos' });
  }
});

router.post('/consents/:id/accept', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    const consent = await prisma.consentDefinition.findUnique({ where: { id } });
    if (!consent || !consent.active) return res.status(404).json({ message: 'Consentimiento no disponible' });

    const accepted = normalizeBool(req.body.accepted, true);
    if (consent.required && !accepted) {
      return res.status(400).json({ message: 'Este consentimiento es obligatorio' });
    }

    const created = await prisma.userConsentAcceptance.create({
      data: {
        userId: req.user.userId,
        consentDefinitionId: id,
        consentVersion: consent.version,
        accepted,
        source: req.body.source || 'USER_PROFILE',
        ipAddress: req.headers['x-forwarded-for']?.split(',')[0] || req.socket.remoteAddress || null,
        userAgent: req.headers['user-agent'] || null,
      },
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('ERROR POST /consents/:id/accept', err);
    res.status(500).json({ message: 'Error al registrar aceptación' });
  }
});

router.get('/consents/documents/:documentId/download', authRequired, async (req, res) => {
  try {
    const documentId = Number(req.params.documentId);
    if (!Number.isFinite(documentId)) return res.status(400).json({ message: 'ID inválido' });

    const doc = await prisma.consentDocument.findUnique({
      where: { id: documentId },
      include: { consentDefinition: { select: { active: true, allowUserDownloadDocuments: true } } },
    });

    if (!doc || !doc.active || !doc.contentBase64) return res.status(404).json({ message: 'Documento no encontrado' });
    if (!doc.downloadEnabled || !doc.consentDefinition?.allowUserDownloadDocuments) {
      return res.status(403).json({ message: 'Documento no habilitado para descarga' });
    }

    const buffer = Buffer.from(doc.contentBase64, 'base64');
    res.setHeader('Content-Type', doc.mimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(doc.fileName)}"`);
    res.send(buffer);
  } catch (err) {
    console.error('ERROR GET /consents/documents/:documentId/download', err);
    res.status(500).json({ message: 'Error al descargar documento' });
  }
});

module.exports = router;
