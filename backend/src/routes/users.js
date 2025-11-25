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
 * PUT /api/users/:id
 * Actualizar datos básicos de usuario (rol, activo, nombre, phone)
 * Body: { name?, lastName?, phone?, role?, active? }
 */
router.put('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, lastName, phone, role, active } = req.body;

    const data = {};

    if (typeof name === 'string') data.name = name;
    if (typeof lastName === 'string') data.lastName = lastName;
    if (typeof phone === 'string') data.phone = phone;

    if (typeof role === 'string') {
      // Ajusta esto si en tu schema el enum es distinto
      const allowedRoles = ['ADMIN', 'USER'];
      if (!allowedRoles.includes(role)) {
        return res
          .status(400)
          .json({ message: 'Rol no válido. Usa ADMIN o USER.' });
      }
      data.role = role;
    }

    if (typeof active === 'boolean') {
      data.active = active;
    }

    const updated = await prisma.user.update({
      where: { id },
      data,
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

    res.json(updated);
  } catch (err) {
    console.error('ERROR PUT /users/:id', err);
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

module.exports = router;
