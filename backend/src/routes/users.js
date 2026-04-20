const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');
const bcrypt = require('bcrypt');

const router = express.Router();

function normalizeStatusFilter(status) {
  if (!status) return null;
  const value = String(status).trim().toUpperCase();
  if (value === 'ACTIVE') return true;
  if (value === 'INACTIVE') return false;
  return null;
}

function normalizeClassifyFilter(classify) {
  if (!classify) return null;
  const value = String(classify).trim().toUpperCase();

  if (value === 'GOOD' || value === 'REGULAR' || value === 'BAD') {
    return value;
  }

  if (value === 'EMPTY' || value === 'NULL' || value === 'SIN_CLASIFICAR') {
    return 'EMPTY';
  }

  return null;
}

/**
 * GET /api/users
 * Listar usuarios (solo admin)
 * Filtros soportados:
 *   - search: nombre, apellido, email
 *   - status: ACTIVE | INACTIVE
 *   - classify: GOOD | REGULAR | BAD | EMPTY
 *   - tagId: number
 */ 
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { search, status, classify, tagId } = req.query;

    const where = {};
    const and = [];

    const normalizedStatus = normalizeStatusFilter(status);
    if (normalizedStatus !== null) {
      and.push({ active: normalizedStatus });
    }

    const normalizedClassify = normalizeClassifyFilter(classify);
    if (normalizedClassify === 'EMPTY') {
      and.push({ classify: null });
    } else if (normalizedClassify) {
      and.push({ classify: normalizedClassify });
    }

    const parsedTagId = Number(tagId);
    if (Number.isFinite(parsedTagId) && parsedTagId > 0) {
      and.push({
        userTags: {
          some: {
            tagId: parsedTagId,
          },
        },
      });
    }

    if (search && String(search).trim()) {
      const q = String(search).trim();
      and.push({
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      });
    }

    if (and.length > 0) {
      where.AND = and;
    }

    const users = await prisma.user.findMany({
      where,
      orderBy: [
        { lastName: 'asc' },
        { name: 'asc' },
        { id: 'asc' },
      ],
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
          orderBy: {
            tag: {
              name: 'asc',
            },
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

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'Ya existe un usuario con ese email' });
    }

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
        password: passwordHash,
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
      : null;

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
          changedByUserId: req.user.userId,
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