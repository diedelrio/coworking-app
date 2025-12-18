// backend/src/routes/reservations.js
const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const reservationValidationService = require('../services/reservationValidationService');



const { getTypeReservationRules } = reservationValidationService;

const { getReservationRules } = require('../services/settingsService');

const { notifyLimitExceeded } = require('../services/limitAlertService');
const {
  notifyReservationPendingApproval,
  notifyReservationApprovedToUser,
} = require('../services/alertNotificationService');

// ✅ Validador de horario/min/step (usa settings DB por dentro)
const { validateReservationTimes } = require('../utils/reservationTimeValidator');

const router = express.Router();

/* ------------------------------ Helpers fechas ------------------------------ */

function getDayRange(dateOnly) {
  const start = new Date(dateOnly);
  start.setHours(0, 0, 0, 0);
  const end = new Date(dateOnly);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getWeekRangeFromDate(dateOnly) {
  const base = new Date(dateOnly);
  base.setHours(0, 0, 0, 0);

  const day = base.getDay() || 7; // domingo=0 -> 7
  const weekStart = new Date(base);
  weekStart.setDate(base.getDate() - day + 1);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  return { weekStart, weekEnd };
}

/* ------------------------------ Error tipado ------------------------------ */

class ReservationValidationError extends Error {
  constructor(message, code = 'VALIDATION_ERROR', extra = {}) {
    super(message);
    this.name = 'ReservationValidationError';
    this.code = code;
    this.extra = extra;
  }
}

const MS_PER_HOUR = 1000 * 60 * 60;

function getReservationDurationHours(startTime, endTime) {
  return (endTime - startTime) / MS_PER_HOUR;
}

/**
 * Decide el estado inicial de la reserva según rol y classify del usuario destino
 */
function resolveInitialStatus({ actorRole, targetUserClassify }) {
  if (actorRole === 'ADMIN') return 'ACTIVE';

  if (targetUserClassify === 'BAD') return 'BLOCKED';
  if (targetUserClassify === 'GOOD') return 'ACTIVE';

  // null o REGULAR
  return 'PENDING';
}

/**
 * Valida reglas de negocio y devuelve los objetos Date construidos.
 * Lanza ReservationValidationError si algo no cumple.
 */
async function validateAndBuildReservation({
  userId,
  spaceId,
  date,
  startTime,
  endTime,
  reservationIdToExclude = null,
}) {
  if (!spaceId || !date || !startTime || !endTime) {
    throw new ReservationValidationError('Faltan datos de la reserva');
  }

  const dateOnly = new Date(`${date}T00:00:00`);
  const startDateTime = new Date(`${date}T${startTime}:00`);
  const endDateTime = new Date(`${date}T${endTime}:00`);

  if (
    Number.isNaN(dateOnly.getTime()) ||
    Number.isNaN(startDateTime.getTime()) ||
    Number.isNaN(endDateTime.getTime())
  ) {
    throw new ReservationValidationError('Fecha u horas inválidas');
  }

  if (endDateTime <= startDateTime) {
    throw new ReservationValidationError(
      'La hora de fin debe ser posterior a la de inicio'
    );
  }

  // ✅ Validación única (sin duplicar): horario + step + minDuration
  // Este validador debe leer settings (openHour/closeHour/minMinutes/stepMinutes).
  try {
    await validateReservationTimes({
      startTime: startDateTime,
      endTime: endDateTime,
    });
  } catch (e) {
    throw new ReservationValidationError(
      e?.message || 'Reglas de horario inválidas',
      e?.code || 'RESERVATION_TIME_RULE',
      e?.extra || {}
    );
  }

  // ✅ Antelación mínima (si tu sistema la usa desde settings)
  // Si no tenés esta regla cargada, dejá default seguro.
  const now = new Date();
  let minHoursBefore = 0;

  try {
    const rules = await getReservationRules();
    // soporta varios nombres por compatibilidad
    const v =
      rules?.min_hours_before ??
      rules?.minHoursBefore ??
      rules?.MIN_HOURS_BEFORE ??
      0;
    minHoursBefore = Number(v) || 0;
  } catch (e) {
    // si falla settings, no rompemos reservas (pero dejá log si querés)
    minHoursBefore = 0;
  }

  const diffHours = (startDateTime - now) / MS_PER_HOUR;
  if (diffHours < minHoursBefore) {
    throw new ReservationValidationError(
      `Debes reservar con al menos ${minHoursBefore} horas de antelación`,
      'MIN_HOURS_BEFORE_EXCEEDED',
      { minHoursBefore }
    );
  }

  // --- Cargamos el espacio para conocer su tipo ---
  const space = await prisma.space.findUnique({
    where: { id: Number(spaceId) },
  });

  if (!space || !space.active) {
    throw new ReservationValidationError('El espacio no existe o está inactivo');
  }

  // Reglas por tipo (viene desde reservationValidationService.js)
  const typeRules = await getTypeReservationRules(space.type);

  const newReservationHours = getReservationDurationHours(
    startDateTime,
    endDateTime
  );

  const excludeFilter = reservationIdToExclude
    ? { id: { not: reservationIdToExclude } }
    : {};

  // --- 1) Límite por día, por usuario y tipo de espacio ---
  const { start: startOfDay, end: endOfDay } = getDayRange(dateOnly);

  const dayReservations = await prisma.reservation.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      ...excludeFilter,
      date: {
        gte: startOfDay,
        lt: endOfDay,
      },
      space: {
        type: space.type,
      },
    },
    include: { space: true },
  });

  const usedDayHours = dayReservations.reduce(
    (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
    0
  );

  if (usedDayHours + newReservationHours > typeRules.maxHoursPerDayPerUser) {
    throw new ReservationValidationError(
      `Superas el máximo de ${typeRules.maxHoursPerDayPerUser} horas por día para este tipo de espacio`,
      'DAY_HOURS_LIMIT_EXCEEDED',
      {
        spaceType: space.type,
        usedDayHours,
        newReservationHours,
        maxHoursPerDayPerUser: typeRules.maxHoursPerDayPerUser,
      }
    );
  }

  // --- 1b) Límite de cantidad de espacios distintos por día (por tipo) ---
  const distinctSpacesDay = new Set(dayReservations.map((r) => r.spaceId));
  distinctSpacesDay.add(Number(spaceId));

  const maxSpacesPerDayPerUser = typeRules.maxSpacesPerDayPerUser ?? 999;

  if (distinctSpacesDay.size > maxSpacesPerDayPerUser) {
    throw new ReservationValidationError(
      `No puedes reservar más de ${maxSpacesPerDayPerUser} espacios de este tipo en el mismo día`,
      'DAY_SPACES_LIMIT_EXCEEDED',
      {
        spaceType: space.type,
        distinctSpacesDayCount: distinctSpacesDay.size,
        maxSpacesPerDayPerUser,
      }
    );
  }

  // --- 2) Límite por semana, por usuario y tipo ---
  const { weekStart, weekEnd } = getWeekRangeFromDate(dateOnly);

  const weekReservations = await prisma.reservation.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      ...excludeFilter,
      date: {
        gte: weekStart,
        lt: weekEnd,
      },
      space: {
        type: space.type,
      },
    },
    include: { space: true },
  });

  const usedWeekHours = weekReservations.reduce(
    (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
    0
  );

  if (usedWeekHours + newReservationHours > typeRules.maxHoursPerWeekPerUser) {
    throw new ReservationValidationError(
      `Superas el máximo de ${typeRules.maxHoursPerWeekPerUser} horas por semana para este tipo de espacio`,
      'WEEK_HOURS_LIMIT_EXCEEDED',
      {
        spaceType: space.type,
        usedWeekHours,
        newReservationHours,
        maxHoursPerWeekPerUser: typeRules.maxHoursPerWeekPerUser,
      }
    );
  }

  // --- 3) No ocupar demasiados espacios simultáneos del mismo tipo ---
  const overlappingSameType = await prisma.reservation.findMany({
    where: {
      userId,
      status: 'ACTIVE',
      ...excludeFilter,
      date: dateOnly,
      startTime: { lt: endDateTime },
      endTime: { gt: startDateTime },
      space: { type: space.type },
    },
    select: { spaceId: true },
  });

  const distinctSpaces = new Set(overlappingSameType.map((r) => r.spaceId));

  if (distinctSpaces.size >= typeRules.maxOverlappingSpacesPerUser) {
    throw new ReservationValidationError(
      'No puedes reservar más espacios de este tipo en el mismo horario.',
      'OVERLAPPING_SPACES_LIMIT_EXCEEDED',
      {
        spaceType: space.type,
        overlappingSpacesCount: distinctSpaces.size,
        maxOverlappingSpacesPerUser: typeRules.maxOverlappingSpacesPerUser,
      }
    );
  }

  // --- 4) Solapamiento en el mismo espacio ---
  const overlapping = await prisma.reservation.findFirst({
    where: {
      ...excludeFilter,
      spaceId: Number(spaceId),
      status: 'ACTIVE',
      date: dateOnly,
      startTime: { lt: endDateTime },
      endTime: { gt: startDateTime },
    },
  });

  if (overlapping) {
    throw new ReservationValidationError(
      'Ya existe una reserva en ese espacio para esa franja horaria',
      'SPACE_OVERLAP'
    );
  }

  return { dateOnly, startDateTime, endDateTime, space };
}

/* ------------------------------ ENDPOINTS ------------------------------ */

/**
 * GET /api/reservations/pending
 * Reservas pendientes (admin) — IMPORTANTE: antes de '/:id'
 */
router.get('/pending', authRequired, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reservations = await prisma.reservation.findMany({
      where: { status: 'PENDING', date: { gte: today } },
      include: { user: true, space: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations/pending', err);
    res.status(500).json({ message: 'Error al obtener reservas pendientes' });
  }
});

/**
 * PATCH /api/reservations/:id/approve
 */
router.patch('/:id/approve', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID de reserva inválido' });
    }

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { user: true, space: true },
    });

    if (!existing) return res.status(404).json({ message: 'Reserva no encontrada' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: 'Solo se pueden aprobar reservas pendientes' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: { user: true, space: true },
    });

    try {
      await notifyReservationApprovedToUser({
        reservation: updated,
        user: updated.user,
        space: updated.space,
      });
    } catch (e) {
      console.error('No se pudo enviar email de reserva aprobada al usuario:', e);
    }

    return res.json({ message: 'Reserva aprobada', reservation: updated });
  } catch (err) {
    console.error('ERROR PATCH /reservations/:id/approve', err);
    return res.status(500).json({ message: 'Error al aprobar la reserva' });
  }
});

/**
 * PATCH /api/reservations/:id/reject
 */
router.patch('/:id/reject', authRequired, requireAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { reason } = req.body || {};

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID de reserva inválido' });
    }

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { user: true, space: true },
    });

    if (!existing) return res.status(404).json({ message: 'Reserva no encontrada' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: 'Solo se pueden rechazar reservas pendientes' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { user: true, space: true },
    });

    try {
      const { notifyReservationRejectedToUser } = require('../services/alertNotificationService');
      await notifyReservationRejectedToUser({
        reservation: updated,
        user: updated.user,
        space: updated.space,
        reason,
      });
    } catch (e) {
      console.error('No se pudo enviar email de reserva rechazada al usuario:', e);
    }

    return res.json({ message: 'Reserva rechazada', reservation: updated });
  } catch (err) {
    console.error('ERROR PATCH /reservations/:id/reject', err);
    return res.status(500).json({ message: 'Error al rechazar la reserva' });
  }
});

/**
 * PATCH /api/reservations/:id/cancel
 */
router.patch('/:id/cancel', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.userId;
    const role = req.user.role;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID de reserva inválido' });
    }

    const reservation = await prisma.reservation.findUnique({ where: { id } });
    if (!reservation) return res.status(404).json({ message: 'Reserva no encontrada' });

    if (role !== 'ADMIN' && reservation.userId !== userId) {
      return res.status(403).json({ message: 'No puedes cancelar esta reserva' });
    }

    const now = new Date();
    if (reservation.startTime <= now) {
      return res.status(400).json({ message: 'No se puede cancelar una reserva pasada' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Reserva cancelada', reservation: updated });
  } catch (err) {
    console.error('ERROR PATCH /reservations/:id/cancel', err);
    res.status(500).json({ message: 'Error al cancelar la reserva' });
  }
});

/**
 * POST /api/reservations
 */
router.post('/', authRequired, async (req, res) => {
  try {
    const authUserId = req.user.userId;
    const role = req.user.role;
    const { spaceId, date, startTime, endTime, userId: bodyUserId } = req.body;

    const targetUserId =
      role === 'ADMIN' && bodyUserId ? Number(bodyUserId) : authUserId;

    const targetUser = await prisma.user.findUnique({
      where: { id: Number(targetUserId) },
      select: { id: true, classify: true, email: true, name: true },
    });

    if (!targetUser) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const { dateOnly, startDateTime, endDateTime, space } =
      await validateAndBuildReservation({
        userId: targetUserId,
        spaceId,
        date,
        startTime,
        endTime,
      });

    const initialStatus = resolveInitialStatus({
      actorRole: role,
      targetUserClassify: targetUser.classify,
    });

    if (initialStatus === 'BLOCKED') {
      return res.status(403).json({
        message: 'Por favor comunicarse con el administrador del Coworking.',
        code: 'USER_BLOCKED',
      });
    }

    const reservation = await prisma.reservation.create({
      data: {
        userId: targetUserId,
        spaceId: Number(spaceId),
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        status: initialStatus,
      },
      include: { space: true, user: true },
    });

    if (reservation.status === 'PENDING') {
      try {
        await notifyReservationPendingApproval({
          reservation,
          user: reservation.user,
          space: reservation.space,
        });
      } catch (e) {
        console.error('No se pudo enviar email de reserva pendiente:', e);
      }

      return res.status(201).json({
        reservation,
        status: 'PENDING',
        alertKey: 'reservation_pending_approval',
        message: 'Tu reserva quedó pendiente de confirmación por el administrador.',
      });
    }

    return res.status(201).json({
      reservation,
      status: 'ACTIVE',
      message: 'Reserva exitosa.',
    });
  } catch (err) {
    if (err instanceof ReservationValidationError) {
      return res.status(400).json({
        message: err.message,
        code: err.code,
        ...err.extra,
        canRequestOverride: true,
      });
    }

    console.error('ERROR POST /reservations', err);
    res.status(500).json({ message: 'Error al crear la reserva' });
  }
});

/**
 * GET /api/reservations/my
 */
router.get('/my', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;

    const reservations = await prisma.reservation.findMany({
      where: { userId },
      include: { space: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations/my', err);
    res.status(500).json({ message: 'Error al obtener tus reservas' });
  }
});

/**
 * GET /api/reservations/space/:spaceId?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
router.get('/space/:spaceId', authRequired, requireAdmin, async (req, res) => {
  try {
    const spaceId = Number(req.params.spaceId);
    const { from, to } = req.query;

    if (!from || !to) {
      return res.status(400).json({
        message: 'Debes indicar from y to en formato YYYY-MM-DD',
      });
    }

    const fromDate = new Date(`${from}T00:00:00`);
    const toDate = new Date(`${to}T23:59:59`);

    if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
      return res.status(400).json({ message: 'Fechas inválidas' });
    }

    const reservations = await prisma.reservation.findMany({
      where: { spaceId, date: { gte: fromDate, lte: toDate } },
      include: { user: true, space: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations/space/:spaceId', err);
    res.status(500).json({ message: 'Error al obtener el calendario del espacio' });
  }
});

/**
 * GET /api/reservations
 * Todas las reservas (admin)
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const reservations = await prisma.reservation.findMany({
      include: { user: true, space: true },
      orderBy: [{ date: 'desc' }, { startTime: 'desc' }],
    });

    res.json(reservations);
  } catch (err) {
    console.error('ERROR GET /reservations', err);
    res.status(500).json({ message: 'Error al obtener todas las reservas' });
  }
});

/**
 * GET /api/reservations/:id
 */
router.get('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.userId;
    const role = req.user.role;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID de reserva inválido' });
    }

    const reservation = await prisma.reservation.findUnique({
      where: { id },
      include: { space: true },
    });

    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (role !== 'ADMIN' && reservation.userId !== userId) {
      return res.status(403).json({ message: 'No puedes ver esta reserva' });
    }

    res.json(reservation);
  } catch (err) {
    console.error('ERROR GET /reservations/:id', err);
    res.status(500).json({ message: 'Error al obtener la reserva' });
  }
});

/**
 * PUT /api/reservations/:id
 * Editar una reserva (usuario → solo la suya; admin → cualquiera)
 */
router.put('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.userId;
    const role = req.user.role;
    const { spaceId, date, startTime, endTime } = req.body;

    if (Number.isNaN(id)) {
      return res.status(400).json({ message: 'ID de reserva inválido' });
    }

    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { space: true },
    });

    if (!existing) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (role !== 'ADMIN' && existing.userId !== userId) {
      return res.status(403).json({ message: 'No puedes editar esta reserva' });
    }

    if (existing.status === 'CANCELLED') {
      return res.status(400).json({ message: 'No se puede editar una reserva cancelada' });
    }

    const now = new Date();
    if (existing.startTime <= now) {
      return res.status(400).json({ message: 'No se puede editar una reserva pasada o en curso' });
    }

    // valida contra límites/horarios/solapes, excluyendo la propia reserva
    const { dateOnly, startDateTime, endDateTime } = await validateAndBuildReservation({
      userId: existing.userId,
      spaceId,
      date,
      startTime,
      endTime,
      reservationIdToExclude: id,
    });

    // Si edita un USER y su classify es BAD, bloqueamos (consistencia)
    if (role !== 'ADMIN') {
      const owner = await prisma.user.findUnique({
        where: { id: existing.userId },
        select: { classify: true },
      });

      const statusDecision = resolveInitialStatus({
        actorRole: role,
        targetUserClassify: owner?.classify ?? null,
      });

      if (statusDecision === 'BLOCKED') {
        return res.status(403).json({
          message: 'Por favor comunicarse con el administrador del Coworking.',
          code: 'USER_BLOCKED',
        });
      }
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        spaceId: Number(spaceId),
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
      },
      include: { space: true },
    });

    return res.json({
      message: 'Reserva actualizada correctamente',
      reservation: updated,
    });
  } catch (err) {
    if (err instanceof ReservationValidationError) {
      return res.status(400).json({
        message: err.message,
        code: err.code,
        ...err.extra,
        canRequestOverride: true,
      });
    }

    console.error('ERROR PUT /reservations/:id', err);
    return res.status(500).json({ message: 'Error al actualizar la reserva' });
  }
});

/**
 * DELETE /api/reservations/:id
 */
router.delete('/:id', authRequired, async (req, res) => {
  try {
    const id = Number(req.params.id);
    const userId = req.user.userId;
    const role = req.user.role;

    const reservation = await prisma.reservation.findUnique({ where: { id } });

    if (!reservation) {
      return res.status(404).json({ message: 'Reserva no encontrada' });
    }

    if (role !== 'ADMIN' && reservation.userId !== userId) {
      return res.status(403).json({ message: 'No puedes cancelar esta reserva' });
    }

    const now = new Date();
    if (reservation.startTime <= now) {
      return res.status(400).json({ message: 'No se puede cancelar una reserva pasada' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
    });

    res.json({ message: 'Reserva cancelada', reservation: updated });
  } catch (err) {
    console.error('ERROR DELETE /reservations/:id', err);
    res.status(500).json({ message: 'Error al cancelar la reserva' });
  }
});

/**
 * POST /api/reservations/limit-override-request
 */
router.post('/limit-override-request', authRequired, async (req, res) => {
  try {
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({ where: { id: userId } });

    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    const { spaceId, date, startTime, endTime, limitCode, limitMessage } = req.body;

    if (!spaceId || !date || !startTime || !endTime) {
      return res.status(400).json({ message: 'Faltan datos para la solicitud' });
    }

    const space = await prisma.space.findUnique({
      where: { id: Number(spaceId) },
    });

    if (!space) {
      return res.status(404).json({ message: 'Espacio no encontrado' });
    }

    const limitReason = limitMessage || `Código de límite: ${limitCode || 'DESCONOCIDO'}`;

    await notifyLimitExceeded({
      user,
      space,
      date,
      startTime,
      endTime,
      limitReason,
    });

    res.json({
      message:
        'Tu solicitud fue registrada. El administrador se pondrá en contacto contigo en breve.',
    });
  } catch (err) {
    console.error('ERROR POST /reservations/limit-override-request', err);
    res.status(500).json({ message: 'Error al registrar la solicitud' });
  }
});

module.exports = router;
