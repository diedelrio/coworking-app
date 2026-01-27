const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

function parseMaybeInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseEndBefore(query) {
  if (query.endBefore) {
    const d = new Date(query.endBefore);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * RF-OPER-01
 * GET /api/admin/operations/complete-preview
 * Preview de reservas ACTIVE que deberían pasar a COMPLETED (endTime <= endBefore)
 */
router.get('/complete-preview', authRequired, requireAdmin, async (req, res) => {
  try {
    const endBefore = parseEndBefore(req.query);
    const userId = parseMaybeInt(req.query.userId);
    const spaceId = parseMaybeInt(req.query.spaceId);

    const where = {
      status: 'ACTIVE',
      endTime: { lte: endBefore },
      ...(userId ? { userId } : {}),
      ...(spaceId ? { spaceId } : {}),
    };

    const [count, rows] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        orderBy: { endTime: 'asc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, lastName: true, email: true } },
          space: { select: { id: true, name: true, type: true } },
        },
      }),
    ]);

    return res.json({
      count,
      sample: rows,
      endBefore,
      note: count > rows.length ? `Mostrando 50 de ${count}` : null,
    });
  } catch (err) {
    console.error('complete-preview error:', err);
    return res.status(500).json({ message: 'Error generando preview de reservas' });
  }
});

/**
 * RF-OPER-02
 * GET /api/admin/operations/liquidations/eligible-users
 * Usuarios elegibles: role CLIENT + al menos 1 reserva facturable (COMPLETED/PENALIZED) sin liquidationItem
 */
router.get('/liquidations/eligible-users', authRequired, requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: {
        role: 'CLIENT',
        active: true,
        reservations: {
          some: {
            status: { in: ['COMPLETED', 'PENALIZED'] },
            liquidationItem: { is: null },
          },
        },
      },
      select: { id: true, name: true, lastName: true, email: true, role: true, active: true },
      orderBy: [{ name: 'asc' }, { lastName: 'asc' }],
    });

    return res.json(rows);
  } catch (err) {
    console.error('eligible-users error:', err);
    return res.status(500).json({ message: 'Error cargando usuarios elegibles para facturación' });
  }
});

/**
 * RF-OPER-02
 * GET /api/admin/operations/liquidations/preview
 * Preview de reservas a facturar (COMPLETED/PENALIZED) sin liquidación.
 * Query: ?userId=number (opcional)
 */
router.get('/liquidations/preview', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = parseMaybeInt(req.query.userId);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ['COMPLETED', 'PENALIZED'] },
        ...(userId ? { userId } : {}),
        liquidationItem: { is: null },
      },
      orderBy: { endTime: 'asc' },
      include: {
        user: { select: { id: true, name: true, lastName: true, email: true } },
        space: { select: { id: true, name: true, type: true } },
      },
    });

    if (!reservations.length) {
      return res.json({ count: 0, totalAmount: 0, byUser: [] });
    }

    const map = new Map();
    for (const r of reservations) {
      const key = r.userId;
      if (!map.has(key)) {
        map.set(key, {
          user: r.user,
          count: 0,
          total: 0,
          reservations: [],
        });
      }
      const g = map.get(key);
      g.count += 1;
      g.total += Number(r.totalAmount ?? 0);
      g.reservations.push({
        id: r.id,
        endTime: r.endTime,
        status: r.status,
        totalAmount: r.totalAmount,
        space: r.space,
      });
    }

    const totalAmount = reservations.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);

    return res.json({
      count: reservations.length,
      totalAmount,
      byUser: Array.from(map.values()),
    });
  } catch (err) {
    console.error('liquidations/preview error:', err);
    return res.status(500).json({ message: 'Error generando preview de facturación' });
  }
});


/**
 * RF-OPER-01
 * POST /api/admin/operations/complete-execute
 * Ejecuta el cambio a COMPLETED.
 * Body:
 *  - ids: number[] (opcional)
 *  - userId?, spaceId?, endBefore? (opcionales, si no hay ids)
 */
router.post('/complete-execute', authRequired, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body || {};

    let where = {
      status: 'ACTIVE',
      endTime: { lte: new Date() },
    };

    if (Array.isArray(ids) && ids.length) {
      where = { ...where, id: { in: ids.map(Number).filter(Number.isFinite) } };
    } else {
      const endBefore = req.body?.endBefore ? new Date(req.body.endBefore) : new Date();
      const userId = parseMaybeInt(req.body?.userId);
      const spaceId = parseMaybeInt(req.body?.spaceId);
      where = {
        ...where,
        endTime: { lte: Number.isNaN(endBefore.getTime()) ? new Date() : endBefore },
        ...(userId ? { userId } : {}),
        ...(spaceId ? { spaceId } : {}),
      };
    }

    const result = await prisma.reservation.updateMany({
      where,
      data: { status: 'COMPLETED' },
    });

    return res.json({ updated: result.count ?? 0 });
  } catch (err) {
    console.error('complete-execute error:', err);
    return res.status(500).json({ message: 'Error ejecutando proceso de completado' });
  }
});

/**
 * RF-OPER-02
 * POST /api/admin/operations/liquidations/generate
 * Genera liquidaciones para reservas COMPLETED/PENALIZED sin liquidación.
 * Body: { userId?: number }
 */
router.post('/liquidations/generate', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = parseMaybeInt(req.body?.userId);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ['COMPLETED', 'PENALIZED'] },
        ...(userId ? { userId } : {}),
        liquidationItem: { is: null },
      },
      orderBy: { endTime: 'asc' },
      include: {
        user: { select: { id: true, name: true, lastName: true, email: true } },
      },
    });

    if (!reservations.length) {
      return res.json({ createdLiquidations: 0, createdItems: 0, message: 'No hay reservas pendientes de facturación.' });
    }

    const byUser = new Map();
    for (const r of reservations) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, []);
      byUser.get(r.userId).push(r);
    }

    const created = await prisma.$transaction(async (tx) => {
      let createdLiquidations = 0;
      let createdItems = 0;
      let updatedReservations = 0;

      for (const [uid, rows] of byUser.entries()) {
        const total = rows.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);

        const fromDate = rows[0]?.endTime ?? null;
        const toDate = rows[rows.length - 1]?.endTime ?? null;

        const liquidation = await tx.liquidation.create({
          data: {
            userId: uid,
            status: 'DRAFT',
            totalAmount: total,
            fromDate,
            toDate,
          },
        });
        createdLiquidations += 1;

        for (const r of rows) {
          await tx.liquidationItem.create({
            data: {
              liquidationId: liquidation.id,
              reservationId: r.id,
              amount: r.totalAmount,
            },
          });
          createdItems += 1;
        }

        // ✅ Al generar la liquidación, marcamos automáticamente como facturadas (INVOICED)
        const upd = await tx.reservation.updateMany({
          where: {
            id: { in: rows.map((r) => r.id) },
            status: { in: ['COMPLETED', 'PENALIZED'] },
          },
          data: { status: 'INVOICED' },
        });
        updatedReservations += upd.count ?? 0;
      }

      return { createdLiquidations, createdItems, updatedReservations };
    });

    return res.json({ ...created });
  } catch (err) {
    console.error('liquidations/generate error:', err);
    return res.status(500).json({ message: 'Error generando liquidaciones' });
  }
});

module.exports = router;
