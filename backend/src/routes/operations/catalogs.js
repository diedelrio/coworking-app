// backend/src/routes/operations/catalogs.js
// Listados auxiliares (templates y tags)
const express = require('express');
const prisma = require('../../prisma');
const { authRequired, requireAdmin } = require('../../middlewares/auth');
const { slugify } = require('./helpers');

const router = express.Router();

/**
 * GET /api/admin/operations/email-templates
 * Devuelve lista corta de templates para UI de operaciones.
 */
router.get('/email-templates', authRequired, requireAdmin, async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      select: { key: true, name: true, subject: true, messageType: true, updatedAt: true },
      orderBy: { key: 'asc' },
    });
    return res.json({ templates });
  } catch (err) {
    console.error('email-templates error:', err);
    return res.status(500).json({ message: 'Error obteniendo templates' });
  }
});

/**
 * GET /api/admin/operations/tags
 * Lista de tags para segmentación.
 */
router.get('/tags', authRequired, requireAdmin, async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      select: { id: true, name: true, slug: true, description: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
    return res.json({ tags });
  } catch (err) {
    console.error('tags list error:', err);
    return res.status(500).json({ message: 'Error obteniendo tags' });
  }
});

/**
 * POST /api/admin/operations/tags
 * Body: { name, slug?, description? }
 */
router.post('/tags', authRequired, requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const slug = slugify(String(req.body?.slug || name));
    const description = req.body?.description ? String(req.body.description) : null;

    if (!name) return res.status(400).json({ message: 'name requerido' });
    if (!slug) return res.status(400).json({ message: 'slug inválido' });

    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name, description },
      create: { name, slug, description },
    });
    return res.json({ tag });
  } catch (err) {
    console.error('tags create error:', err);
    return res.status(500).json({ message: 'Error creando tag' });
  }
});

module.exports = router;
