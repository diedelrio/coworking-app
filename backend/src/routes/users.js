const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /api/users
 * Listar todos los usuarios (solo admin)
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        phone: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    res.json(users);
  } catch (err) {
    console.error('ERROR GET /users', err);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

/**
 * GET /api/users/:id
 * Obtener los datos de un usuario (solo admin)
 */
router.get('/:id', authRequired, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const user = await prisma.user.findUnique({
    where: { id },
  });

  if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });

  const { password, ...safeUser } = user;
  res.json(safeUser);
});

/**
 * PUT /api/users/:id
 * Actualizar datos básicos de usuario (rol, activo, nombre, phone)
 * Body: { name?, lastName?, phone?, role?, active? }
 */
router.put('/:id', authRequired, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);
  const { name, lastName, email, phone, role, active } = req.body;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return res.status(404).json({ message: 'Usuario no encontrado' });
  }

  const updates = { name, lastName, email, phone, role, active };
  const fieldsToTrack = ['name', 'lastName', 'email', 'phone,', 'role', 'active'];

  const historyEntries = [];
  fieldsToTrack.forEach((field) => {
    if (typeof updates[field] === 'undefined') return;

    const oldValue = existing[field];
    const newValue = updates[field];

    // solo registramos si cambió
    if (oldValue !== newValue) {
      historyEntries.push({
        userId: id,
        field,
        oldValue: oldValue !== null ? String(oldValue) : null,
        newValue: newValue !== null ? String(newValue) : null,
        changedBy: req.user.id, // asumiendo que authRequired setea req.user
      });
    }
  });

  const updated = await prisma.$transaction(async (tx) => {
    const u = await tx.user.update({
      where: { id },
      data: updates,
    });

    if (historyEntries.length > 0) {
      await tx.userHistory.createMany({
        data: historyEntries,
      });
    }

    return u;
  });

  const { password, ...safeUser } = updated;
  res.json(safeUser);
});

/**
 * GET /api/users/:id/history
 * Obtener el historial de cambios de un usuario (solo admin)
 */
router.get('/:id/history', authRequired, requireAdmin, async (req, res) => {
  const id = Number(req.params.id);

  const history = await prisma.userHistory.findMany({
    where: { userId: id },
    orderBy: { createdAt: 'desc' },
  });

  res.json(history);
});


module.exports = router;
