const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

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
    const { name, type, capacity, description } = req.body;

    if (!name || !type || !capacity) {
      return res
        .status(400)
        .json({ message: 'Nombre, tipo y capacidad son obligatorios' });
    }

    const space = await prisma.space.create({
      data: {
        name,
        type, // 'FIX_DESK' | 'FLEX_DESK' | 'MEETING_ROOM'
        capacity: Number(capacity),
        description,
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
    const { name, type, capacity, description, active } = req.body;

    const space = await prisma.space.update({
      where: { id },
      data: {
        name,
        type,
        capacity: Number(capacity),
        description,
        active,
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
