// backend/src/routes/pricingResolve.js
// Endpoint simple para que el front pueda previsualizar el precio según unidad.

const express = require('express');
const { authRequired } = require('../middlewares/auth');
const { resolveUnitPrice, resolveHourlyRate } = require('../services/pricingResolver');

const router = express.Router();

router.get('/resolve', authRequired, async (req, res) => {
  try {
    const spaceId = Number(req.query.spaceId);
    const unit = String(req.query.unit || 'HOUR').toUpperCase();

    if (!spaceId || Number.isNaN(spaceId)) {
      return res.status(400).json({ error: 'spaceId is required' });
    }

    const when = req.query.date ? new Date(String(req.query.date)) : new Date();

    const hourly = await resolveHourlyRate({ userId: req.user?.id, spaceId, date: when });
    const unitPrice = await resolveUnitPrice({ userId: req.user?.id, spaceId, unit, date: when });

    return res.json({
      spaceId,
      unit,
      hourlyRate: hourly,
      unitPrice: unitPrice ?? null,
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Failed to resolve pricing' });
  }
});

module.exports = router;
