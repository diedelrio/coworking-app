// backend/src/routes/officeClosures.js
const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

function toYMD(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * GET /api/office-closures
 * Lista cierres (si está vacío => no hay cierres, NO es error)
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { from, to } = req.query || {};

    let where = {};
    if (from || to) {
      const fromDate = from ? new Date(`${from}T00:00:00`) : null;
      const toDate = to ? new Date(`${to}T23:59:59`) : null;

      if (fromDate && Number.isNaN(fromDate.getTime())) {
        return res.status(400).json({ message: 'from inválido (YYYY-MM-DD)' });
      }
      if (toDate && Number.isNaN(toDate.getTime())) {
        return res.status(400).json({ message: 'to inválido (YYYY-MM-DD)' });
      }

      where.date = {};
      if (fromDate) where.date.gte = fromDate;
      if (toDate) where.date.lte = toDate;
    }

    const closures = await prisma.officeClosure.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    return res.json(closures);
  } catch (err) {
    console.error('ERROR GET /office-closures', err);
    return res.status(500).json({ message: 'Error al obtener cierres' });
  }
});

/**
 * POST /api/office-closures
 * Body: { date: 'YYYY-MM-DD', reason?: string }
 */
router.post('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { date, reason } = req.body || {};
    if (!date) return res.status(400).json({ message: 'date es requerido (YYYY-MM-DD)' });

    const dateOnly = new Date(`${date}T00:00:00`);
    if (Number.isNaN(dateOnly.getTime())) {
      return res.status(400).json({ message: 'date inválido (YYYY-MM-DD)' });
    }

    // Normalizamos a 00:00 para evitar duplicados por hora
    dateOnly.setHours(0, 0, 0, 0);

    const created = await prisma.officeClosure.create({
      data: {
        date: dateOnly,
        reason: reason ? String(reason).trim() : null,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    // unique constraint
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Ya existe un cierre para esa fecha' });
    }
    console.error('ERROR POST /office-closures', err);
    return res.status(500).json({ message: 'Error al crear cierre' });
  }
});

/**
 * DELETE /api/office-closures/:id
 */
router.delete('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'id inválido' });

    await prisma.officeClosure.delete({ where: { id } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('ERROR DELETE /office-closures/:id', err);
    return res.status(500).json({ message: 'Error al eliminar cierre' });
  }
});

module.exports = router;
