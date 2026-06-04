const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

const PORTALS = ['ADMIN', 'CLIENT', 'BOTH'];
const CATEGORIES = ['SYSTEM', 'RELEASE', 'COMMERCIAL', 'SOCIAL', 'OTHER'];

function normalizeBool(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'undefined' || value === null || value === '') return fallback;
  return String(value).toLowerCase() === 'true';
}

function normalizeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function normalizePortal(value) {
  return PORTALS.includes(value) ? value : 'BOTH';
}

function normalizeCategory(value) {
  return CATEGORIES.includes(value) ? value : 'SYSTEM';
}

function mapPopupPayload(body = {}) {
  return {
    title: String(body.title || '').trim(),
    description: String(body.description || '').trim(),
    portal: normalizePortal(body.portal),
    category: normalizeCategory(body.category),
    active: normalizeBool(body.active, true),
    showFrom: normalizeDate(body.showFrom),
    showUntil: normalizeDate(body.showUntil),
    showOnce: normalizeBool(body.showOnce, true),
    requireConfirmation: normalizeBool(body.requireConfirmation, true),
  };
}

function selectPopup(includeReads = false) {
  return {
    id: true,
    title: true,
    description: true,
    portal: true,
    category: true,
    active: true,
    showFrom: true,
    showUntil: true,
    showOnce: true,
    requireConfirmation: true,
    createdAt: true,
    updatedAt: true,
    ...(includeReads
      ? {
          reads: {
            orderBy: { readAt: 'desc' },
            take: 20,
            select: {
              id: true,
              readAt: true,
              user: { select: { id: true, name: true, lastName: true, email: true, role: true } },
            },
          },
        }
      : {}),
  };
}

// ADMIN: ABM mensajes emergentes
router.get('/admin/popup-messages', authRequired, requireAdmin, async (req, res) => {
  try {
    const messages = await prisma.popupMessage.findMany({
      orderBy: [{ active: 'desc' }, { showFrom: 'desc' }, { id: 'desc' }],
      select: selectPopup(true),
    });
    res.json(messages);
  } catch (err) {
    console.error('ERROR GET /admin/popup-messages', err);
    res.status(500).json({ message: 'Error al obtener mensajes emergentes' });
  }
});

router.post('/admin/popup-messages', authRequired, requireAdmin, async (req, res) => {
  try {
    const payload = mapPopupPayload(req.body);
    if (!payload.title || !payload.description) {
      return res.status(400).json({ message: 'Título y descripción son obligatorios' });
    }
    if (payload.showFrom && payload.showUntil && payload.showFrom > payload.showUntil) {
      return res.status(400).json({ message: 'La fecha desde no puede ser posterior a la fecha hasta' });
    }

    const created = await prisma.popupMessage.create({ data: payload, select: selectPopup(true) });
    res.status(201).json(created);
  } catch (err) {
    console.error('ERROR POST /admin/popup-messages', err);
    res.status(500).json({ message: 'Error al crear mensaje emergente' });
  }
});

router.put('/admin/popup-messages/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    const existing = await prisma.popupMessage.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ message: 'Mensaje emergente no encontrado' });

    const payload = mapPopupPayload(req.body);
    if (!payload.title || !payload.description) {
      return res.status(400).json({ message: 'Título y descripción son obligatorios' });
    }
    if (payload.showFrom && payload.showUntil && payload.showFrom > payload.showUntil) {
      return res.status(400).json({ message: 'La fecha desde no puede ser posterior a la fecha hasta' });
    }

    const updated = await prisma.popupMessage.update({ where: { id }, data: payload, select: selectPopup(true) });
    res.json(updated);
  } catch (err) {
    console.error('ERROR PUT /admin/popup-messages/:id', err);
    res.status(500).json({ message: 'Error al actualizar mensaje emergente' });
  }
});

router.delete('/admin/popup-messages/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });
    await prisma.popupMessage.delete({ where: { id } });
    res.json({ ok: true });
  } catch (err) {
    console.error('ERROR DELETE /admin/popup-messages/:id', err);
    res.status(500).json({ message: 'Error al eliminar mensaje emergente' });
  }
});

// USER/ADMIN: mensajes pendientes para mostrar en el portal
router.get('/popup-messages/pending', authRequired, async (req, res) => {
  try {
    const portal = normalizePortal(req.query.portal);
    const userId = req.user.userId;
    const now = new Date();

    const messages = await prisma.popupMessage.findMany({
      where: {
        active: true,
        portal: { in: [portal, 'BOTH'] },
        OR: [{ showFrom: null }, { showFrom: { lte: now } }],
        AND: [{ OR: [{ showUntil: null }, { showUntil: { gte: now } }] }],
      },
      orderBy: [{ showFrom: 'desc' }, { id: 'desc' }],
      select: selectPopup(false),
    });

    if (!messages.length) return res.json([]);

    const reads = await prisma.userPopupMessageRead.findMany({
      where: { userId, popupMessageId: { in: messages.map((m) => m.id) } },
      select: { popupMessageId: true },
    });
    const readIds = new Set(reads.map((r) => r.popupMessageId));

    const pending = messages.filter((message) => !message.showOnce || !readIds.has(message.id));
    res.json(pending);
  } catch (err) {
    console.error('ERROR GET /popup-messages/pending', err);
    res.status(500).json({ message: 'Error al obtener mensajes emergentes pendientes' });
  }
});

router.post('/popup-messages/:id/read', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: 'ID inválido' });

    const popup = await prisma.popupMessage.findUnique({ where: { id } });
    if (!popup) return res.status(404).json({ message: 'Mensaje emergente no encontrado' });

    const read = await prisma.userPopupMessageRead.upsert({
      where: { userId_popupMessageId: { userId: req.user.userId, popupMessageId: id } },
      update: { readAt: new Date() },
      create: { userId: req.user.userId, popupMessageId: id },
    });

    res.status(201).json(read);
  } catch (err) {
    console.error('ERROR POST /popup-messages/:id/read', err);
    res.status(500).json({ message: 'Error al registrar lectura del mensaje emergente' });
  }
});

module.exports = router;
