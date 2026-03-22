const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const router = express.Router();

const PRODUCT_TYPES = ['PLAN', 'BONUS', 'RATE'];
const TARGET_TYPES = ['COWORKING', 'MEETING_ROOM', 'INSPIRATION_ROOM', 'FULL_SPACE', 'OTHER'];
const BILLING_TYPES = ['RECURRING', 'PREPAID', 'PAY_PER_USE', 'INCLUDED'];
const UNIT_TYPES = ['HOUR', 'DAY', 'HALF_DAY', 'FULL_DAY', 'WEEK', 'MONTH', 'UNIT', 'SESSION'];
const TAX_MODES = ['INCLUDED', 'EXCLUDED', 'EXEMPT'];
const BENEFIT_TYPES = ['INCLUDED_CREDIT', 'BONUS_CREDIT', 'DISCOUNT', 'ACCESS_RIGHT'];
const PAYMENT_FREQUENCIES = ['ONE_TIME', 'WEEKLY', 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', 'YEARLY', 'CUSTOM'];

function isEnumValue(value, allowed) {
  return typeof value === 'string' && allowed.includes(value);
}

function normalizeString(value, { required = false, max = 255 } = {}) {
  if (value === undefined || value === null) {
    if (required) return null;
    return null;
  }
  const s = String(value).trim();
  if (!s) {
    if (required) return null;
    return null;
  }
  return s.slice(0, max);
}

function normalizeBoolean(value, defaultValue = false) {
  if (value === undefined || value === null) return defaultValue;
  return Boolean(value);
}

function normalizeInt(value, defaultValue = 0) {
  if (value === undefined || value === null || value === '') return defaultValue;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n;
}

function normalizeDecimal(value, { required = false, min = null } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? null : null;
  }
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  if (min !== null && n < min) return null;
  return n.toFixed(2);
}

function normalizeDate(value, { required = false } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? null : null;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d;
}

function mapRateInput(rate, idx = 0) {
  const unitType = rate?.unitType;
  const currency = normalizeString(rate?.currency || 'EUR', { required: true, max: 10 });
  const price = normalizeDecimal(rate?.price, { required: true, min: 0 });
  const taxMode = rate?.taxMode || 'EXCLUDED';
  const taxPercent =
    rate?.taxPercent === undefined || rate?.taxPercent === null || rate?.taxPercent === ''
      ? null
      : normalizeDecimal(rate?.taxPercent, { required: false, min: 0 });
  const validFrom = normalizeDate(rate?.validFrom, { required: true });
  const validTo = normalizeDate(rate?.validTo, { required: false });
  const priority = normalizeInt(rate?.priority, 0);
  const isActive = normalizeBoolean(rate?.isActive, true);
  const notes = normalizeString(rate?.notes, { max: 500 });

  if (!isEnumValue(unitType, UNIT_TYPES)) {
    throw new Error(`rates[${idx}].unitType inválido`);
  }
  if (!currency) {
    throw new Error(`rates[${idx}].currency inválido`);
  }
  if (price === null) {
    throw new Error(`rates[${idx}].price inválido`);
  }
  if (!isEnumValue(taxMode, TAX_MODES)) {
    throw new Error(`rates[${idx}].taxMode inválido`);
  }
  if (rate?.taxPercent !== undefined && rate?.taxPercent !== null && rate?.taxPercent !== '' && taxPercent === null) {
    throw new Error(`rates[${idx}].taxPercent inválido`);
  }
  if (!validFrom) {
    throw new Error(`rates[${idx}].validFrom inválido`);
  }
  if (rate?.validTo && !validTo) {
    throw new Error(`rates[${idx}].validTo inválido`);
  }
  if (priority === null) {
    throw new Error(`rates[${idx}].priority inválido`);
  }

  return {
    unitType,
    currency,
    price,
    taxMode,
    taxPercent,
    validFrom,
    validTo,
    priority,
    isActive,
    notes,
  };
}

function mapBenefitInput(benefit, idx = 0) {
  const benefitType = benefit?.benefitType;
  const targetType = benefit?.targetType;
  const unitType = benefit?.unitType;
  const creditAmount = normalizeDecimal(benefit?.creditAmount, { required: true, min: 0 });
  const resetEachPeriod = normalizeBoolean(benefit?.resetEachPeriod, false);
  const resetFrequency =
    benefit?.resetFrequency === undefined || benefit?.resetFrequency === null || benefit?.resetFrequency === ''
      ? null
      : benefit?.resetFrequency;
  const rolloverAllowed = normalizeBoolean(benefit?.rolloverAllowed, false);
  const isActive = normalizeBoolean(benefit?.isActive, true);
  const notes = normalizeString(benefit?.notes, { max: 500 });

  if (!isEnumValue(benefitType, BENEFIT_TYPES)) {
    throw new Error(`benefits[${idx}].benefitType inválido`);
  }
  if (!isEnumValue(targetType, TARGET_TYPES)) {
    throw new Error(`benefits[${idx}].targetType inválido`);
  }
  if (!isEnumValue(unitType, UNIT_TYPES)) {
    throw new Error(`benefits[${idx}].unitType inválido`);
  }
  if (creditAmount === null) {
    throw new Error(`benefits[${idx}].creditAmount inválido`);
  }
  if (resetFrequency && !isEnumValue(resetFrequency, PAYMENT_FREQUENCIES)) {
    throw new Error(`benefits[${idx}].resetFrequency inválido`);
  }

  return {
    benefitType,
    targetType,
    unitType,
    creditAmount,
    resetEachPeriod,
    resetFrequency,
    rolloverAllowed,
    isActive,
    notes,
  };
}

function mapProductPayload(body) {
  const code = normalizeString(body?.code, { required: true, max: 100 });
  const name = normalizeString(body?.name, { required: true, max: 200 });
  const description = normalizeString(body?.description, { max: 2000 });
  const productType = body?.productType;
  const targetType = body?.targetType;
  const billingType = body?.billingType;
  const defaultUnitType = body?.defaultUnitType;
  const taxMode = body?.taxMode || 'EXCLUDED';
  const isActive = normalizeBoolean(body?.isActive, true);
  const requiresReservation = normalizeBoolean(body?.requiresReservation, false);
  const defaultSpaceId = normalizeNullableInt(body?.defaultSpaceId);
  const validFrom = normalizeDate(body?.validFrom, { required: false });
  const validTo = normalizeDate(body?.validTo, { required: false });
  const sortOrder = normalizeInt(body?.sortOrder, 0);
  
  const metadataJson =
    body?.metadataJson && typeof body.metadataJson === 'object' ? body.metadataJson : null;

  if (!code) throw new Error('code es obligatorio');
  if (!name) throw new Error('name es obligatorio');
  if (!isEnumValue(productType, PRODUCT_TYPES)) throw new Error('productType inválido');
  if (!isEnumValue(targetType, TARGET_TYPES)) throw new Error('targetType inválido');
  if (!isEnumValue(billingType, BILLING_TYPES)) throw new Error('billingType inválido');
  if (!isEnumValue(defaultUnitType, UNIT_TYPES)) throw new Error('defaultUnitType inválido');
  if (!isEnumValue(taxMode, TAX_MODES)) throw new Error('taxMode inválido');
  if (sortOrder === null) throw new Error('sortOrder inválido');

  const rates = Array.isArray(body?.rates) ? body.rates.map(mapRateInput) : [];
  const benefits = Array.isArray(body?.benefits) ? body.benefits.map(mapBenefitInput) : [];

  return {
    code,
    name,
    description,
    productType,
    targetType,
    billingType,
    defaultUnitType,
    taxMode,
    isActive,
    requiresReservation,
    defaultSpaceId,
    validFrom,
    validTo,
    sortOrder,
    metadataJson,
    rates,
    benefits,
  };
}

function productInclude() {
  return {
    defaultSpace: {
      select: {
        id: true,
        name: true,
      },
    },
    rates: {
      orderBy: [{ priority: 'desc' }, { validFrom: 'desc' }, { id: 'asc' }],
    },
    benefits: {
      orderBy: [{ id: 'asc' }],
    },
  };
}
function normalizeNullableInt(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  if (!Number.isInteger(n)) return null;
  return n;
}

function addFrequency(date, frequency) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return null;

  switch (frequency) {
    case 'ONE_TIME':
      return d;
    case 'WEEKLY':
      d.setDate(d.getDate() + 7);
      return d;
    case 'MONTHLY':
      d.setMonth(d.getMonth() + 1);
      return d;
    case 'BIMONTHLY':
      d.setMonth(d.getMonth() + 2);
      return d;
    case 'QUARTERLY':
      d.setMonth(d.getMonth() + 3);
      return d;
    case 'YEARLY':
      d.setFullYear(d.getFullYear() + 1);
      return d;
    default:
      return null;
  }
}

function minDate(a, b) {
  if (!a) return b || null;
  if (!b) return a || null;
  return a.getTime() <= b.getTime() ? a : b;
}

function serializeAssignment(item) {
  return {
    ...item,
    balances: (item.balances || []).map((b) => ({
      ...b,
      grantedAmount: Number(b.grantedAmount),
      consumedAmount: Number(b.consumedAmount),
      remainingAmount: Number(b.remainingAmount),
    })),
    reservations: item.reservations || [],
    priceSnapshot:
      item.priceSnapshot === null || item.priceSnapshot === undefined
        ? null
        : Number(item.priceSnapshot),
    taxPercent:
      item.taxPercent === null || item.taxPercent === undefined
        ? null
        : Number(item.taxPercent),
  };
}

function assignmentInclude() {
  return {
    user: {
      select: {
        id: true,
        name: true,
        lastName: true,
        email: true,
        active: true,
      },
    },
    product: {
      include: {
        rates: {
          where: { isActive: true },
          orderBy: [{ priority: 'desc' }, { validFrom: 'desc' }, { id: 'asc' }],
        },
        benefits: {
          where: { isActive: true },
          orderBy: [{ id: 'asc' }],
        },
      },
    },
    contract: {
      select: {
        id: true,
        code: true,
        status: true,
      },
    },
    balances: {
      orderBy: [{ createdAt: 'desc' }],
    },
  };
}

/**
 * GET /api/admin/commercial/products
 * Lista productos comerciales
 * Query params opcionales:
 * - active=true|false
 * - productType=PLAN|BONUS|RATE
 * - targetType=...
 */
router.get('/products', authRequired, requireAdmin, async (req, res) => {
  try {
    const { active, productType, targetType } = req.query;

    const where = {};

    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;
    if (productType && isEnumValue(productType, PRODUCT_TYPES)) where.productType = productType;
    if (targetType && isEnumValue(targetType, TARGET_TYPES)) where.targetType = targetType;

    const products = await prisma.commercialProduct.findMany({
      where,
      include: productInclude(),
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });

    res.json(products);
  } catch (err) {
    console.error('ERROR GET /api/admin/commercial/products', err);
    res.status(500).json({ message: 'Error al obtener productos comerciales' });
  }
});

/**
 * GET /api/admin/commercial/products/:id
 * Detalle de un producto
 */
router.get('/products/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const product = await prisma.commercialProduct.findUnique({
      where: { id },
      include: productInclude(),
    });

    if (!product) {
      return res.status(404).json({ message: 'Producto comercial no encontrado' });
    }

    res.json(product);
  } catch (err) {
    console.error('ERROR GET /api/admin/commercial/products/:id', err);
    res.status(500).json({ message: 'Error al obtener el producto comercial' });
  }
});

/**
 * POST /api/admin/commercial/products
 * Crea producto con tarifas y beneficios
 */
router.post('/products', authRequired, requireAdmin, async (req, res) => {
  try {
    const payload = mapProductPayload(req.body);

    const existing = await prisma.commercialProduct.findUnique({
      where: { code: payload.code },
      select: { id: true },
    });

    if (existing) {
      return res.status(400).json({ message: 'Ya existe un producto con ese code' });
    }

    const created = await prisma.commercialProduct.create({
      data: {
        code: payload.code,
        name: payload.name,
        description: payload.description,
        productType: payload.productType,
        targetType: payload.targetType,
        billingType: payload.billingType,
        defaultUnitType: payload.defaultUnitType,
        taxMode: payload.taxMode,
        isActive: payload.isActive,
        requiresReservation: payload.requiresReservation,
        defaultSpaceId: payload.defaultSpaceId,
        validFrom: payload.validFrom,
        validTo: payload.validTo,
        sortOrder: payload.sortOrder,
        metadataJson: payload.metadataJson,
        ...(payload.rates.length > 0
          ? {
              rates: {
                create: payload.rates,
              },
            }
          : {}),
        ...(payload.benefits.length > 0
          ? {
              benefits: {
                create: payload.benefits,
              },
            }
          : {}),
      },
      include: productInclude(),
    });

    res.status(201).json(created);
  } catch (err) {
    console.error('ERROR POST /api/admin/commercial/products', err);
    res.status(400).json({ message: err.message || 'Error al crear producto comercial' });
  }
});

/**
 * PUT /api/admin/commercial/products/:id
 * Actualiza producto y reemplaza completamente rates + benefits
 */
router.put('/products/:id', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const payload = mapProductPayload(req.body);

    const existingByCode = await prisma.commercialProduct.findFirst({
      where: {
        code: payload.code,
        NOT: { id },
      },
      select: { id: true },
    });

    if (existingByCode) {
      return res.status(400).json({ message: 'Ya existe otro producto con ese code' });
    }

    const existing = await prisma.commercialProduct.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Producto comercial no encontrado' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.commercialRate.deleteMany({ where: { productId: id } });
      await tx.commercialBenefit.deleteMany({ where: { productId: id } });

      await tx.commercialProduct.update({
        where: { id },
        data: {
          code: payload.code,
          name: payload.name,
          description: payload.description,
          productType: payload.productType,
          targetType: payload.targetType,
          billingType: payload.billingType,
          defaultUnitType: payload.defaultUnitType,
          taxMode: payload.taxMode,
          isActive: payload.isActive,
          requiresReservation: payload.requiresReservation,
          defaultSpaceId: payload.defaultSpaceId,
          validFrom: payload.validFrom,
          validTo: payload.validTo,
          sortOrder: payload.sortOrder,
          metadataJson: payload.metadataJson,
        },
      });

      if (payload.rates.length > 0) {
        await tx.commercialRate.createMany({
          data: payload.rates.map((r) => ({
            productId: id,
            ...r,
          })),
        });
      }

      if (payload.benefits.length > 0) {
        await tx.commercialBenefit.createMany({
          data: payload.benefits.map((b) => ({
            productId: id,
            ...b,
          })),
        });
      }

      return tx.commercialProduct.findUnique({
        where: { id },
        include: productInclude(),
      });
    });

    res.json(updated);
  } catch (err) {
    console.error('ERROR PUT /api/admin/commercial/products/:id', err);
    res.status(400).json({ message: err.message || 'Error al actualizar producto comercial' });
  }
});

/**
 * PATCH /api/admin/commercial/products/:id/active
 * Activa/desactiva producto
 * Body: { isActive: true|false }
 */
router.patch('/products/:id/active', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    const { isActive } = req.body;
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({ message: 'isActive debe ser boolean' });
    }

    const updated = await prisma.commercialProduct.update({
      where: { id },
      data: { isActive },
      include: productInclude(),
    });

    res.json(updated);
  } catch (err) {
    console.error('ERROR PATCH /api/admin/commercial/products/:id/active', err);
    res.status(500).json({ message: 'Error al actualizar estado del producto' });
  }
});

/**
 * GET /api/admin/commercial/assignments
 * Lista asignaciones comerciales
 * Query params:
 * - userId
 * - status
 */
router.get('/assignments', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = normalizeNullableInt(req.query.userId);
    const status = req.query.status;

    const where = {};
    if (userId !== null) where.userId = userId;
    if (status && ['ACTIVE', 'EXHAUSTED', 'EXPIRED', 'CANCELLED'].includes(status)) {
      where.status = status;
    }

    const items = await prisma.userCommercialProduct.findMany({
      where,
      include: assignmentInclude(),
      orderBy: [{ createdAt: 'desc' }],
    });

    res.json(items.map(serializeAssignment));
  } catch (err) {
    console.error('ERROR GET /api/admin/commercial/assignments', err);
    res.status(500).json({ message: 'Error al obtener asignaciones comerciales' });
  }
});

/**
 * POST /api/admin/commercial/assignments
 * Asigna un producto comercial a un usuario y genera balances según beneficios
 */
router.post('/assignments', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = normalizeNullableInt(req.body?.userId);
    const productId = normalizeNullableInt(req.body?.productId);
    const contractId = normalizeNullableInt(req.body?.contractId);

    const startDate = normalizeDate(req.body?.startDate, { required: true });
    const endDate = normalizeDate(req.body?.endDate, { required: false });

    const priceSnapshot =
      req.body?.priceSnapshot === undefined || req.body?.priceSnapshot === null || req.body?.priceSnapshot === ''
        ? null
        : normalizeDecimal(req.body?.priceSnapshot, { required: false, min: 0 });

    const currency = normalizeString(req.body?.currency || 'EUR', { required: true, max: 10 });
    const taxMode =
      req.body?.taxMode === undefined || req.body?.taxMode === null || req.body?.taxMode === ''
        ? null
        : req.body?.taxMode;
    const taxPercent =
      req.body?.taxPercent === undefined || req.body?.taxPercent === null || req.body?.taxPercent === ''
        ? null
        : normalizeDecimal(req.body?.taxPercent, { required: false, min: 0 });

    const notes = normalizeString(req.body?.notes, { max: 1000 });

    const createReservation = normalizeBoolean(req.body?.createReservation, false);
    const reservationSpaceId = normalizeNullableInt(req.body?.reservation?.spaceId);
    const reservationStatus = normalizeString(req.body?.reservation?.status || 'ACTIVE', { max: 50 });
    const reservationNotes = normalizeString(req.body?.reservation?.notes, { max: 1000 });

    if (!userId) return res.status(400).json({ message: 'userId es obligatorio' });
    if (!productId) return res.status(400).json({ message: 'productId es obligatorio' });
    if (!startDate) return res.status(400).json({ message: 'startDate es obligatorio y válido' });
    if (req.body?.endDate && !endDate) {
      return res.status(400).json({ message: 'endDate inválido' });
    }
    if (endDate && startDate > endDate) {
      return res.status(400).json({ message: 'endDate no puede ser menor a startDate' });
    }
    if (taxMode && !isEnumValue(taxMode, TAX_MODES)) {
      return res.status(400).json({ message: 'taxMode inválido' });
    }
    if (req.body?.taxPercent !== undefined && req.body?.taxPercent !== null && req.body?.taxPercent !== '' && taxPercent === null) {
      return res.status(400).json({ message: 'taxPercent inválido' });
    }
    if (createReservation) {
      if (!reservationSpaceId) {
        return res.status(400).json({ message: 'reservation.spaceId es obligatorio cuando createReservation=true' });
      }
      if (!startDate || !endDate) {
        return res.status(400).json({ message: 'Para crear la reserva asociada se requieren startDate y endDate' });
      }
    }

    const [user, product, contract, reservationSpace] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, active: true, role: true, name: true, lastName: true, email: true },
      }),
      prisma.commercialProduct.findUnique({
        where: { id: productId },
        include: {
          defaultSpace: {
            select: {
              id: true,
              name: true,
            },
          },
          benefits: {
            where: { isActive: true },
            orderBy: [{ id: 'asc' }],
          },
        },
      }),
      contractId
        ? prisma.contract.findUnique({
            where: { id: contractId },
            select: { id: true, userId: true, status: true, code: true },
          })
        : Promise.resolve(null),
      createReservation && reservationSpaceId
        ? prisma.space.findUnique({
            where: { id: reservationSpaceId },
            select: { id: true, name: true },
          })
        : Promise.resolve(null),
    ]);

    if (!user) return res.status(404).json({ message: 'Usuario no encontrado' });
    if (!product) return res.status(404).json({ message: 'Producto comercial no encontrado' });
    if (contractId && !contract) return res.status(404).json({ message: 'Contrato no encontrado' });
    if (contract && contract.userId !== userId) {
      return res.status(400).json({ message: 'El contrato no pertenece al usuario indicado' });
    }
    if (createReservation && !reservationSpace) {
      return res.status(404).json({ message: 'Espacio de reserva no encontrado' });
    }
    const created = await prisma.$transaction(async (tx) => {
      const assignment = await tx.userCommercialProduct.create({
        data: {
          userId,
          productId,
          contractId,
          status: 'ACTIVE',
          startDate,
          endDate,
          priceSnapshot,
          currency,
          taxMode,
          taxPercent,
          notes,
        },
      });

      if (product.benefits?.length) {
        for (const benefit of product.benefits) {
          let periodStart = startDate;
          let periodEnd = null;
          let expiresAt = endDate || null;

          if (benefit.resetEachPeriod && benefit.resetFrequency) {
            const tentativeEnd = addFrequency(startDate, benefit.resetFrequency);
            periodEnd = minDate(tentativeEnd, endDate || null);
            expiresAt = minDate(periodEnd, endDate || null) || periodEnd || endDate || null;
          }

          await tx.userBenefitBalance.create({
            data: {
              userId,
              productId,
              userCommercialProductId: assignment.id,
              sourceType: 'BENEFIT',
              targetType: benefit.targetType,
              unitType: benefit.unitType,
              periodStart,
              periodEnd,
              expiresAt,
              grantedAmount: benefit.creditAmount,
              consumedAmount: '0.00',
              remainingAmount: benefit.creditAmount,
              status: 'ACTIVE',
              notes: benefit.notes || `Generado automáticamente por asignación de ${product.name}`,
            },
          });
        }
      }
      if (createReservation) {
        const startDateTime = new Date(startDate);
        const endDateTime = new Date(endDate);

        const reservationDate = new Date(startDateTime);
        reservationDate.setHours(0, 0, 0, 0);

        const durationMinutes = Math.max(
          0,
          Math.round((endDateTime.getTime() - startDateTime.getTime()) / 60000)
        );

        await tx.reservation.create({
          data: {
            userId,
            spaceId: reservationSpaceId,
            date: reservationDate,
            startTime: startDateTime,
            endTime: endDateTime,
            status: reservationStatus || 'ACTIVE',
            notes:
              reservationNotes ||
              notes ||
              `Reserva generada por asignación comercial de ${product.name}`,
            userCommercialProductId: assignment.id,
            totalAmount: priceSnapshot || 0,
            durationMinutes,
            hourlyRateSnapshot: priceSnapshot || 0,
          },
        });
      }
        
      return tx.userCommercialProduct.findUnique({
        where: { id: assignment.id },
        include: assignmentInclude(),
      });
    });

    res.status(201).json(serializeAssignment(created));
  } catch (err) {
    console.error('ERROR POST /api/admin/commercial/assignments', err);
    res.status(400).json({ message: err.message || 'Error al asignar producto comercial' });
  }
});

/**
 * PATCH /api/admin/commercial/assignments/:id/status
 * Cambia estado de la asignación
 * Body: { status: 'ACTIVE'|'CANCELLED'|'EXPIRED'|'EXHAUSTED' }
 */
router.patch('/assignments/:id/status', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const status = req.body?.status;

    if (!Number.isInteger(id)) {
      return res.status(400).json({ message: 'ID inválido' });
    }

    if (!['ACTIVE', 'CANCELLED', 'EXPIRED', 'EXHAUSTED'].includes(status)) {
      return res.status(400).json({ message: 'status inválido' });
    }

    const existing = await prisma.userCommercialProduct.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Asignación no encontrada' });
    }

    const updated = await prisma.$transaction(async (tx) => {
      await tx.userCommercialProduct.update({
        where: { id },
        data: { status },
      });

      if (status === 'CANCELLED' || status === 'EXPIRED' || status === 'EXHAUSTED') {
        await tx.userBenefitBalance.updateMany({
          where: {
            userCommercialProductId: id,
            status: 'ACTIVE',
          },
          data: {
            status,
          },
        });
      }

      return tx.userCommercialProduct.findUnique({
        where: { id },
        include: assignmentInclude(),
      });
    });

    res.json(serializeAssignment(updated));
  } catch (err) {
    console.error('ERROR PATCH /api/admin/commercial/assignments/:id/status', err);
    res.status(500).json({ message: 'Error al actualizar estado de la asignación' });
  }
});

module.exports = router;