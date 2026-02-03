const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');
const bcrypt = require('bcrypt');

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
        classify: true,
        active: true,
        createdAt: true,
        userTags: {
          select: {
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    res.json(users);
  } catch (err) {
    console.error('ERROR GET /users', err);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

/**
 * POST /api/users
 * Crear usuario (solo admin)
 * Body: { name, lastName, email, phone?, role?, classify? }
 *
 * Nota: Tu modelo Prisma requiere password, así que generamos uno temporal hasheado.
 * Luego el usuario puede usar "Olvidé mi contraseña".
 */
router.post('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { name, lastName, maternalLastName, email, phone, role, classify, tagIds } = req.body;

    if (!name || !lastName || !email) {
      return res.status(400).json({
        message: 'Faltan datos obligatorios (name, lastName, email)',
      });
    }

    if (typeof maternalLastName !== 'undefined' && maternalLastName !== null) {
      if (typeof maternalLastName !== 'string') {
        return res
          .status(400)
          .json({ message: 'maternalLastName debe ser string o null' });
      }
    }

    // Evitar duplicado por email
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    }

    // Password temporal (no se devuelve por seguridad)
    const tempPassword = Math.random().toString(36).slice(-10);
    const passwordHash = await bcrypt.hash(tempPassword, 10);

    const parsedTagIds = Array.isArray(tagIds)
      ? tagIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : [];

    const created = await prisma.user.create({
      data: {
        name,
        lastName,
        maternalLastName:
          typeof maternalLastName === 'undefined' ? null : (maternalLastName || null),
        email,
        phone: phone || null,
        role: role || 'CLIENT',
        classify: typeof classify === 'undefined' ? 'GOOD' : classify,
        active: true,
        password: passwordHash, // ✅ requerido por Prisma
        ...(parsedTagIds.length > 0
          ? { userTags: { create: parsedTagIds.map((tagId) => ({ tagId })) } }
          : {}),
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        maternalLastName: true,
        email: true,
        phone: true,
        role: true,
        classify: true,
        active: true,
        createdAt: true,
        userTags: {
          select: {
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    // (Opcional futuro) Enviar mail con link para setear password (forgot-password)
    return res.status(201).json(created);
  } catch (err) {
    console.error('ERROR POST /users', err);
    return res.status(500).json({ message: 'Error al crear el usuario' });
  }
});

/**
 * GET /api/users/missing-classify
 * Usuarios sin classify (solo admin)
 * ⚠️ IMPORTANTE: antes de '/:id'
 */
router.get('/missing-classify', authRequired, requireAdmin, async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { classify: null },
      select: {
        id: true,
        name: true,
        lastName: true,
        maternalLastName: true,
        email: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(users);
  } catch (err) {
    console.error('ERROR GET /users/missing-classify', err);
    res.status(500).json({ message: 'Error al obtener usuarios sin classify' });
  }
});
// ✅ GET /api/users/me (cliente o admin: su propio perfil)
router.get('/me', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        lastName: true,
        maternalLastName: true,
        email: true,
        phone: true,
        role: true,
        classify: true,
        active: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    res.json(user);
  } catch (err) {
    console.error('ERROR GET /users/me', err);
    res.status(500).json({ message: 'Error al obtener el perfil' });
  }
});

// ✅ PATCH /api/users/me (solo phone + maternalLastName)
router.patch('/me', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { phone, maternalLastName } = req.body;

    const updated = await prisma.user.update({
      where: { id: userId },
      data: {
        phone: typeof phone === 'undefined' ? undefined : (phone || null),
        maternalLastName:
          typeof maternalLastName === 'undefined' ? undefined : (maternalLastName || null),
      },
      select: {
        id: true,
        name: true,
        lastName: true,
        maternalLastName: true,
        email: true,
        phone: true,
        role: true,
        classify: true,
        active: true,
      },
    });

    res.json(updated);
  } catch (err) {
    console.error('ERROR PATCH /users/me', err);
    res.status(500).json({ message: 'Error al actualizar el perfil' });
  }
});

// ✅ PATCH /api/users/me/deactivate (darse de baja)
router.patch('/me/deactivate', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;

    await prisma.user.update({
      where: { id: userId },
      data: { active: false },
    });

    res.json({ message: 'Cuenta desactivada correctamente.' });
  } catch (err) {
    console.error('ERROR PATCH /users/me/deactivate', err);
    res.status(500).json({ message: 'Error al desactivar la cuenta' });
  }
});

/**
 * GET /api/users/:id
 * Obtener los datos de un usuario (solo admin)
 */
router.get('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const user = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        lastName: true,
        maternalLastName: true,
        email: true,
        phone: true,
        role: true,
        classify: true,
        active: true,
        createdAt: true,
        userTags: {
          select: {
            tag: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    res.json(user);
  } catch (err) {
    console.error('ERROR GET /users/:id', err);
    res.status(500).json({ message: 'Error al obtener el usuario' });
  }
});

/**
 * PUT /api/users/:id
 * Actualizar datos básicos + classify (solo admin)
 */
router.put('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { name, lastName, maternalLastName, email, phone, role, active, classify, tagIds } = req.body;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const updates = {
      name,
      lastName,
      maternalLastName,
      email,
      phone,
      role,
      active,
      classify: classify ?? null,
    };

    const parsedTagIds = Array.isArray(tagIds)
      ? tagIds.map((x) => Number(x)).filter((n) => Number.isFinite(n))
      : null; // null => no tocar tags

    const fieldsToTrack = [
      'name',
      'lastName',
      'maternalLastName',
      'email',
      'phone',
      'role',
      'active',
      'classify',
    ];

    const historyEntries = [];
    fieldsToTrack.forEach((field) => {
      if (typeof updates[field] === 'undefined') return;

      const oldValue = existing[field];
      const newValue = updates[field];

      if (oldValue !== newValue) {
        historyEntries.push({
          userId: id,
          field,
          oldValue: oldValue !== null ? String(oldValue) : null,
          newValue: newValue !== null ? String(newValue) : null,
          changedByUserId: req.user.userId, // ✅ coherente con tu auth
        });
      }
    });

    const updated = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: updates,
        select: {
          id: true,
          name: true,
          lastName: true,
          maternalLastName: true,
          email: true,
          phone: true,
          role: true,
          classify: true,
          active: true,
          createdAt: true,
          userTags: {
            select: {
              tag: { select: { id: true, name: true, slug: true } },
            },
          },
        },
      });

      // ✅ Tags: si el front envía tagIds, reemplazamos el set completo
      if (parsedTagIds !== null) {
        await tx.userTag.deleteMany({ where: { userId: id } });
        if (parsedTagIds.length > 0) {
          await tx.userTag.createMany({
            data: parsedTagIds.map((tagId) => ({ userId: id, tagId })),
            skipDuplicates: true,
          });
        }
      }

      if (historyEntries.length > 0) {
        await tx.userHistory.createMany({
          data: historyEntries,
        });
      }

      // ⚠️ Si tocamos tags, recargamos el usuario con tags para responder consistente
      if (parsedTagIds !== null) {
        return await tx.user.findUnique({
          where: { id },
          select: {
            id: true,
            name: true,
            lastName: true,
            maternalLastName: true,
            email: true,
            phone: true,
            role: true,
            classify: true,
            active: true,
            createdAt: true,
            userTags: {
              select: {
                tag: { select: { id: true, name: true, slug: true } },
              },
            },
          },
        });
      }

      return u;
    });

    res.json(updated);
  } catch (err) {
    console.error('ERROR PUT /users/:id', err);
    res.status(500).json({ message: 'Error al actualizar el usuario' });
  }
});

/**
 * GET /api/users/:id/history
 * Obtener el historial de cambios de un usuario (solo admin)
 */
router.get('/:id/history', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const history = await prisma.userHistory.findMany({
      where: { userId: id },
      orderBy: { createdAt: 'desc' },
    });

    res.json(history);
  } catch (err) {
    console.error('ERROR GET /users/:id/history', err);
    res.status(500).json({ message: 'Error al obtener el historial' });
  }
});

module.exports = router;
