// backend/src/routes/public.js
const express = require('express');
const prisma = require('../prisma');

const router = express.Router();

function toNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Settings publicos necesarios para UI.
 * OJO: solo devolvemos lo minimo requerido (no secretos).
 */
router.get('/settings', async (_req, res) => {
  try {
    const keys = [
      'OFFICE_OPEN_HOUR',
      'OFFICE_CLOSE_HOUR',
      'MAX_DAYS_UPCOMING_BOOKING',
      'RESERVATION_STEP_MINUTES',
      'HALF_DAY_MINUTES',
      'RESERVATION_MIN_MINUTES',
      'MIN_HOURS_BEFORE',
    ];

    const rows = await prisma.setting.findMany({
      where: { key: { in: keys }, status: 'ACTIVE' },
      select: { key: true, value: true, valueType: true },
    });

    const out = {};
    for (const r of rows) {
      if (r.key === 'MAX_DAYS_UPCOMING_BOOKING') {
        out[r.key] = toNumber(r.value, 7);
      } else {
        out[r.key] = r.value;
      }
    }

    // defaults seguros por si el setting no existe
    if (out.MAX_DAYS_UPCOMING_BOOKING == null) out.MAX_DAYS_UPCOMING_BOOKING = 7;

    res.json({ ok: true, settings: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to load public settings' });
  }
});

module.exports = router;

/**
 * GET /api/public/content
 * ?keys=TEXT_LOGIN,TEXT_CREATE_USER
 */
router.get('/content', async (req, res) => {
  try {
    const keysParam = String(req.query.keys || '').trim();
    if (!keysParam) {
      return res.json({ content: {} });
    }

    const keys = keysParam
      .split(',')
      .map(k => k.trim())
      .filter(Boolean);

    if (!keys.length) {
      return res.json({ content: {} });
    }

    const rows = await prisma.setting.findMany({
      where: {
        key: { in: keys },
        status: 'ACTIVE', // ✅ en tu modelo no existe "active"
      },
      select: {
        key: true,
        value: true,
      },
    });

    // 🔁 Pasamos a objeto plano
    const content = {};
    for (const r of rows) {
      content[r.key] = r.value;
    }

    return res.json({ content });
  } catch (err) {
    console.error('public/content error:', err);
    return res.status(500).json({ message: 'Error obteniendo contenido público' });
  }
});

module.exports = router;