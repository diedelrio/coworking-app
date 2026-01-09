const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

function normalizeImageUrl(raw) {
  if (raw === undefined || raw === null) return null;
  const s = String(raw).trim();
  if (!s) return null;

  // Validación simple de URL
  try {
    const u = new URL(s);
    if (!["http:", "https:"].includes(u.protocol)) return null;
    return u.toString();
  } catch {
    return null;
  }
}

function normalizeHourlyRate(raw) {
  if (raw === undefined || raw === null || raw === "") return "0.00";
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < 0) return null;
  // Guardamos con 2 decimales para Decimal(10,2)
  return n.toFixed(2);
}


/**
 * GET /api/spaces
 * Lista TODOS los espacios (solo admin)
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const spaces = await prisma.space.findMany({
      orderBy: { id: 'asc' },
    });

    res.json(spaces);
  } catch (err) {
    console.error('ERROR GET /spaces', err);
    res.status(500).json({ message: 'Error al obtener espacios' });
  }
});

/**
 * GET /api/spaces/active
 * Lista SOLO espacios activos (clientes y admin)
 */
router.get('/active', authRequired, async (req, res) => {
  try {
    const spaces = await prisma.space.findMany({
      where: { active: true },
      orderBy: { id: 'asc' },
    });

    res.json(spaces);
  } catch (err) {
    console.error('ERROR GET /spaces/active', err);
    res.status(500).json({ message: 'Error al obtener espacios activos' });
  }
});

/**
 * GET /api/spaces/:id
 * Obtener un espacio concreto (solo admin)
 */
router.get('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const space = await prisma.space.findUnique({ where: { id } });

    if (!space) {
      return res.status(404).json({ message: 'Espacio no encontrado' });
    }

    res.json(space);
  } catch (err) {
    console.error('ERROR GET /spaces/:id', err);
    res.status(500).json({ message: 'Error al obtener el espacio' });
  }
});

/**
 * POST /api/spaces
 * Crear un nuevo espacio (solo admin)
 */
router.post('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { name, type, capacity, description, hourlyRate, imageUrl } = req.body;

    if (!name || !type || !capacity) {
      return res
        .status(400)
        .json({ message: 'Nombre, tipo y capacidad son obligatorios' });
    }

    const rate = normalizeHourlyRate(hourlyRate);
    if (rate === null) {
      return res.status(400).json({ message: 'La tarifa por hora no es válida' });
    }

    const imgUrl = normalizeImageUrl(imageUrl);
    if (imageUrl && !imgUrl) {
      return res.status(400).json({ message: 'La URL de imagen no es válida' });
    }

    const space = await prisma.space.create({
      data: {
        name: String(name).trim(),
        type,
        capacity: Number(capacity),
        description: description ? String(description).trim() : null,
        hourlyRate: rate,   // Decimal(10,2) acepta string
        imageUrl: imgUrl,   // null si vacío
      },
    });

    res.status(201).json(space);
  } catch (err) {
    console.error('ERROR POST /spaces', err);
    res.status(500).json({ message: 'Error al crear espacio' });
  }
});


/**
 * PUT /api/spaces/:id
 * Actualizar un espacio (solo admin)
 */
router.put('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, type, capacity, description, active, hourlyRate, imageUrl } = req.body;

    const rate = normalizeHourlyRate(hourlyRate);
    if (rate === null) {
      return res.status(400).json({ message: 'La tarifa por hora no es válida' });
    }

    const imgUrl = normalizeImageUrl(imageUrl);
    if (imageUrl && !imgUrl) {
      return res.status(400).json({ message: 'La URL de imagen no es válida' });
    }

    const space = await prisma.space.update({
      where: { id },
      data: {
        name: String(name).trim(),
        type,
        capacity: Number(capacity),
        description: description ? String(description).trim() : null,
        active: Boolean(active),
        hourlyRate: rate,
        imageUrl: imgUrl,
      },
    });

    res.json(space);
  } catch (err) {
    console.error('ERROR PUT /spaces/:id', err);
    res.status(500).json({ message: 'Error al actualizar espacio' });
  }
});


/**
 * DELETE /api/spaces/:id
 * “Borrar” un espacio → lo marcamos como inactivo (soft delete)
 */
router.delete('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);

    const space = await prisma.space.update({
      where: { id },
      data: {
        active: false,
      },
    });

    res.json({ message: 'Espacio desactivado', space });
  } catch (err) {
    console.error('ERROR DELETE /spaces/:id', err);
    res.status(500).json({ message: 'Error al desactivar espacio' });
  }
});

module.exports = router;
