const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

/**
 * GET /api/admin/email-templates
 * Lista templates (para tabla).
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const items = await prisma.emailTemplate.findMany({
      orderBy: { key: 'asc' },
    });
    res.json(items);
  } catch (err) {
    console.error('GET /admin/email-templates error:', err);
    res.status(500).json({ message: 'Error obteniendo templates' });
  }
});

/**
 * POST /api/admin/email-templates
 * Crea un template nuevo
 */
router.post('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { key, name, subject, body } = req.body || {};

    if (!key?.trim() || !name?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'key, name, subject y body son obligatorios' });
    }

    const created = await prisma.emailTemplate.create({
      data: {
        key: key.trim(),
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
      },
    });

    return res.status(201).json({ message: 'Template creado', template: created });
  } catch (err) {
  console.error('POST /admin/email-templates error:', {
    code: err?.code,
    target: err?.meta?.target,
    message: err?.message,
  });

  if (err?.code === 'P2002') {
    return res.status(409).json({
      message: `Unique constraint: ${err?.meta?.target?.join(', ') || 'unknown'}`,
    });
  }

  return res.status(500).json({ message: 'Error creando template' });
  }
});


/**
 * GET /api/admin/email-templates/:id
 * Devuelve un template puntual (para editar).
 */
router.get('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await prisma.emailTemplate.findUnique({ where: { id } });
    if (!item) return res.status(404).json({ message: 'Template no encontrado' });
    res.json(item);
  } catch (err) {
    console.error('GET /admin/email-templates/:id error:', err);
    res.status(500).json({ message: 'Error obteniendo template' });
  }
});

/**
 * PUT /api/admin/email-templates/:id
 * Edita name/subject/body (key queda igual por seguridad).
 */
router.put('/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, subject, body } = req.body || {};

    if (!name?.trim() || !subject?.trim() || !body?.trim()) {
      return res.status(400).json({ message: 'name, subject y body son obligatorios' });
    }

    const updated = await prisma.emailTemplate.update({
      where: { id },
      data: {
        name: name.trim(),
        subject: subject.trim(),
        body: body.trim(),
      },
    });

    res.json({ message: 'Template actualizado', template: updated });
  } catch (err) {
    console.error('PUT /admin/email-templates/:id error:', err);
    res.status(500).json({ message: 'Error actualizando template' });
  }
});

module.exports = router;
