// backend/src/routes/public.js
const express = require('express');
const prisma = require('../prisma');

const router = express.Router();

/**
 * Settings públicos necesarios para UI.
 * OJO: solo devolvemos lo mínimo requerido (no secretos).
 */
router.get('/settings', async (_req, res) => {
  try {
    const keys = ['OFFICE_OPEN_HOUR', 'OFFICE_CLOSE_HOUR'];

    const rows = await prisma.setting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });

    const out = {};
    for (const r of rows) out[r.key] = r.value;

    res.json({ ok: true, settings: out });
  } catch (e) {
    console.error(e);
    res.status(500).json({ ok: false, error: 'Failed to load public settings' });
  }
});

module.exports = router;
