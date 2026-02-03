const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /api/admin/tags
 * Listar tags (solo admin)
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      orderBy: [{ name: 'asc' }],
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
      },
    });

    return res.json(tags);
  } catch (err) {
    console.error('ERROR GET /admin/tags', err);
    return res.status(500).json({ message: 'Error al obtener tags' });
  }
});

/**
 * POST /api/admin/tags
 * Crear tag (solo admin)
 * Body: { name, slug?, description? }
 */
router.post('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { name, slug, description } = req.body || {};
    if (!name || typeof name !== 'string') {
      return res.status(400).json({ message: 'name es obligatorio' });
    }

    const normalizedSlug = (typeof slug === 'string' && slug.trim())
      ? slug.trim().toLowerCase()
      : name
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')
          .replace(/^_+|_+$/g, '');

    const created = await prisma.tag.create({
      data: {
        name: name.trim(),
        slug: normalizedSlug,
        description: typeof description === 'string' ? description.trim() : null,
      },
      select: {
        id: true,
        name: true,
        slug: true,
        description: true,
        createdAt: true,
      },
    });

    return res.status(201).json(created);
  } catch (err) {
    // Prisma unique constraint
    if (err && err.code === 'P2002') {
      return res.status(400).json({ message: 'Ya existe un tag con ese slug' });
    }
    console.error('ERROR POST /admin/tags', err);
    return res.status(500).json({ message: 'Error al crear tag' });
  }
});

module.exports = router;
