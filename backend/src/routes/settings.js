const express = require('express');
const router = express.Router();

const {
  listSettings,
  getSettingHistory,
  createSetting,
  updateSetting,
} = require('../services/settingsService');
const { authRequired } = require('../middlewares/auth'); // ajusta ruta si es distinta

// Middleware sencillo para exigir rol ADMIN
function adminOnly(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Acceso solo para administradores' });
  }
  next();
}

// GET /api/settings
router.get('/', authRequired, adminOnly, async (req, res) => {
  try {
    const settings = await listSettings();
    res.json(settings);
  } catch (err) {
    console.error('ERROR GET /settings', err);
    res.status(500).json({ message: 'Error al obtener settings' });
  }
});

// GET /api/settings/:id/history
router.get('/:id/history', authRequired, adminOnly, async (req, res) => {
  try {
    const history = await getSettingHistory(req.params.id);
    res.json(history);
  } catch (err) {
    console.error('ERROR GET /settings/:id/history', err);
    res.status(500).json({ message: 'Error al obtener historial' });
  }
});

// POST /api/settings
router.post('/', authRequired, adminOnly, async (req, res) => {
  try {
    const { key, value, valueType, description } = req.body;

    if (!key || !value || !valueType) {
      return res.status(400).json({ message: 'Faltan datos' });
    }

    const setting = await createSetting({
      key,
      value,
      valueType,
      description,
      userId: req.user.userId,
    });

    res.status(201).json(setting);
  } catch (err) {
    console.error('ERROR POST /settings', err);
    res.status(500).json({ message: 'Error al crear setting' });
  }
});

// PUT /api/settings/:id
router.put('/:id', authRequired, adminOnly, async (req, res) => {
  try {
    const { value, status, description } = req.body;

    const setting = await updateSetting({
      id: req.params.id,
      value,
      status,
      description,
      userId: req.user.userId,
    });

    res.json(setting);
  } catch (err) {
    console.error('ERROR PUT /settings/:id', err);
    res.status(500).json({ message: 'Error al actualizar setting' });
  }
});

module.exports = router;
