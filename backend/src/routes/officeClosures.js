const express = require('express');
const prisma = require('../prisma');
const { requireAuth, requireAdmin } = require('../middlewares/auth'); // ajustá a tus middlewares reales

const router = express.Router();

router.get('/', requireAuth, requireAdmin, async (_req, res) => {
  const rows = await prisma.officeClosure.findMany({ orderBy: { date: 'asc' } });
  res.json({ ok: true, closures: rows });
});

router.upsert('/', requireAuth, requireAdmin, async (req, res) => {
  // ejemplo: upsert por date
});

module.exports = router;
