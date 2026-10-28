// backend/src/routes/officeClosures.js
const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

// Los cierres se guardan SIEMPRE como medianoche UTC del día (YYYY-MM-DDT00:00:00Z),
// sin depender de la zona horaria del servidor. Quien los lee los compara por fecha.
function toYMD(date) {
  return new Date(date).toISOString().slice(0, 10);
}

/**
 * GET /api/office-closures
 * Lista cierres (admin). Por defecto devuelve solo activos.
 * Query:
 *  - from/to: YYYY-MM-DD
 *  - includeInactive=true para traer también inactivos
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { from, to, includeInactive, q } = req.query || {};

    const includeInactiveBool = String(includeInactive || '').toLowerCase() === 'true';

    let where = {};
    if (!includeInactiveBool) {
      where.active = true;
    }

    if (from || to) {
      const fromDate = from ? new Date(`${from}T00:00:00.000Z`) : null;
      const toDate = to ? new Date(`${to}T23:59:59.999Z`) : null;

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

    if (q) {
      where.OR = [
        { reason: { contains: String(q), mode: 'insensitive' } },
      ];
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
 * Crea cierres.
 * Body:
 *  - date: 'YYYY-MM-DD' (crea 1)
 *  - o startDate/endDate (inclusive) para crear rango
 *  - reason?: string
 *
 * Si la fecha ya existe como inactiva, se reactiva.
 */
router.post('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { date, startDate, endDate, reason } = req.body || {};

    const reasonValue = reason ? String(reason).trim() : null;

    const oneDate = date || startDate;
    if (!oneDate) {
      return res.status(400).json({ message: 'Debe enviar date (YYYY-MM-DD) o startDate/endDate' });
    }

    const start = new Date(`${oneDate}T00:00:00.000Z`);
    if (Number.isNaN(start.getTime())) {
      return res.status(400).json({ message: 'Fecha inválida (YYYY-MM-DD)' });
    }

    let end = null;
    if (endDate) {
      end = new Date(`${endDate}T00:00:00.000Z`);
      if (Number.isNaN(end.getTime())) {
        return res.status(400).json({ message: 'endDate inválida (YYYY-MM-DD)' });
      }
    } else {
      end = new Date(start);
    }

    if (end < start) {
      return res.status(400).json({ message: 'endDate debe ser >= startDate' });
    }

    // Expandir rango inclusive (día por día)
    const createdOrUpdated = [];
    const errors = [];

    const current = new Date(start);
    while (current <= end) {
      const d = new Date(current);
      try {
        // upsert: si existe, reactivar y actualizar reason
        const row = await prisma.officeClosure.upsert({
          where: { date: d },
          create: { date: d, reason: reasonValue, active: true },
          update: { reason: reasonValue, active: true },
        });
        createdOrUpdated.push(row);
      } catch (e) {
        errors.push({ date: toYMD(d), error: e?.message || 'error' });
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    return res.status(201).json({
      ok: true,
      created: createdOrUpdated.length,
      errors,
      rows: createdOrUpdated,
    });
  } catch (err) {
    console.error('ERROR POST /office-closures', err);
    return res.status(500).json({ message: 'Error al crear cierre' });
  }
});

/**
 * PUT /api/office-closures/:id
 * Body: { date: 'YYYY-MM-DD', reason?: string, active?: boolean }
 */
router.put('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'id inválido' });

    const { date, reason, active } = req.body || {};

    const data = {};
    if (date != null) {
      const dateOnly = new Date(`${date}T00:00:00.000Z`);
      if (Number.isNaN(dateOnly.getTime())) return res.status(400).json({ message: 'date inválido (YYYY-MM-DD)' });
      data.date = dateOnly;
    }
    if (reason !== undefined) data.reason = reason ? String(reason).trim() : null;
    if (active !== undefined) data.active = !!active;

    const updated = await prisma.officeClosure.update({ where: { id }, data });
    return res.json(updated);
  } catch (err) {
    if (err?.code === 'P2002') {
      return res.status(409).json({ message: 'Ya existe un cierre para esa fecha' });
    }
    console.error('ERROR PUT /office-closures/:id', err);
    return res.status(500).json({ message: 'Error al actualizar cierre' });
  }
});

/**
 * DELETE /api/office-closures/:id
 * Soft delete: marca active=false
 */
router.delete('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) return res.status(400).json({ message: 'id inválido' });

    await prisma.officeClosure.update({ where: { id }, data: { active: false } });
    return res.json({ ok: true });
  } catch (err) {
    console.error('ERROR DELETE /office-closures/:id', err);
    return res.status(500).json({ message: 'Error al eliminar cierre' });
  }
});

module.exports = router;
