// backend/src/routes/reservations.js
const { isSharedSpaceType, effectiveCapacity } = require('../services/spaceCapacity');
const { countOverlappingReservations } = require('../services/reservationOccupancy');
const { computeReservationStatus } = require('../services/reservationStatus');

const express = require('express');
const crypto = require('crypto');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');

const reservationValidationService = require('../services/reservationValidationService');
const { buildPricingSnapshot } = require('../services/pricing');

const { getTypeReservationRules } = reservationValidationService;

const { getReservationRules } = require('../services/settingsService');

const { notifyLimitExceeded } = require('../services/limitAlertService');
const {
  notifyReservationPendingApproval,
  notifyReservationApprovedToUser,
} = require('../services/alertNotificationService');

// ✅ Validador de horario/min/step (usa settings DB por dentro)
const { validateReservationTimes } = require('../utils/reservationTimeValidator');
const { madridDateTimeToUtc, madridDateYMDToUtcMidnight } = require('../utils/timezone');

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

/* ------------------------------ Recurrencia ------------------------------ */

function safeRandomId() {
  try {
    if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch (_) {}
  return crypto.randomBytes(16).toString('hex');
}

function toDateOnlyYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function addMonthsSameDay(date, months) {
  const base = new Date(date);
  const day = base.getDate();

  const d = new Date(base);
  d.setDate(1);
  d.setMonth(d.getMonth() + months);

  // Clamp al último día del mes
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return d;
}

function isoWeekday(date) {
  // JS: 0=Sun..6=Sat  | ISO: 1=Mon..7=Sun
  const d = date.getDay();
  return d === 0 ? 7 : d;
}

function isWeekend(date) {
  const d = date.getDay();
  return d === 0 || d === 6;
}

function ymd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * MONTHLY ("Mismo día todos los meses") con ajuste a día hábil:
 * - Se toma el "día del mes" ancla (p.ej. 29) y el "día de semana" ancla (p.ej. jueves).
 * - Para cada mes:
 *    1) Se arma una fecha base = min(díaAncla, últimoDíaDelMes)
 *    2) Se busca el mismo día de semana ancla dentro de la MISMA semana ISO (lun-dom)
 *       que la fecha base (puede ser hacia adelante o hacia atrás).
 *    3) Si cae fuera del mes, se retrocede 7 días (semana anterior).
 *    4) Si cae en fin de semana o feriado/cierre, se retrocede 7 días hasta un día hábil.
 */
function addMonthsMonthlyBusinessWeekday({
  startDate,
  monthsToAdd,
  anchorDay,
  anchorIsoWeekday,
  closedYMDSet,
}) {
  const d = new Date(startDate);
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  d.setMonth(d.getMonth() + monthsToAdd);

  const year = d.getFullYear();
  const month = d.getMonth();
  const lastDay = new Date(year, month + 1, 0).getDate();
  const baseDay = Math.min(anchorDay, lastDay);
  let candidate = new Date(year, month, baseDay);

  // Ajuste al mismo weekday ancla dentro de la misma semana ISO (lun-dom)
  const candIso = isoWeekday(candidate);
  const diff = anchorIsoWeekday - candIso; // positivo => avanzar, negativo => retroceder
  candidate = addDays(candidate, diff);

  // Si nos pasamos de mes, retroceder una semana
  if (candidate.getMonth() !== month) {
    candidate = addDays(candidate, -7);
  }

  // Si cae en fin de semana o feriado/cierre, retroceder una semana (mismo weekday)
  while (isWeekend(candidate) || (closedYMDSet && closedYMDSet.has(ymd(candidate)))) {
    candidate = addDays(candidate, -7);
  }

  return candidate;
}

/**
 * Genera fechas (Date) para ocurrencias recurrentes.
 * - pattern: DAILY | WEEKLY | MONTHLY
 * - endDate: YYYY-MM-DD (inclusive)
 * - count: cantidad total de ocurrencias (incluye la primera)
 *
 * DAILY:
 *  - Solo lun-vie
 *  - Excluye cierres/feriados (OfficeClosures)
 */
function generateOccurrenceDates({ startYMD, pattern, endDateYMD, count, closedYMDSet }) {
  const start = new Date(`${startYMD}T00:00:00`);
  if (Number.isNaN(start.getTime())) throw new Error('Fecha inicial inválida');

  let limitCount = count != null ? Number(count) : null;
  if (limitCount != null) {
    if (!Number.isInteger(limitCount) || limitCount < 1 || limitCount > 100) {
      throw new Error('recurrenceCount debe ser un entero entre 1 y 100');
    }
  }

  let endDate = null;
  if (endDateYMD) {
    endDate = new Date(`${endDateYMD}T00:00:00`);
    if (Number.isNaN(endDate.getTime())) throw new Error('Fecha fin inválida');
  }

  const out = [];
  let current = new Date(start);
  

  // DAILY: solo días hábiles (lun-vie) y excluye feriados/cierres.
  // Si la fecha inicial cae en finde o cierre, se corre al próximo día hábil.
  if (pattern === 'DAILY') {
    while (isWeekend(current) || (closedYMDSet && closedYMDSet.has(ymd(current)))) {
      current = addDays(current, 1);
    }
  }

  // Siempre incluye la primera
  for (let i = 0; i < 100; i++) {
    if (endDate && current > endDate) break;
    out.push(new Date(current));
    if (limitCount && out.length >= limitCount) break;

    if (pattern === 'DAILY') {
      // avanzar al próximo día hábil
      do {
        current = addDays(current, 1);
      } while (isWeekend(current) || (closedYMDSet && closedYMDSet.has(ymd(current))));
    } else if (pattern === 'WEEKLY') current = addDays(current, 7);
    else if (pattern === 'MONTHLY') current = addMonthsSameDay(current, 1);
    else throw new Error('Patrón de recurrencia inválido');
  }

  return out;
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

  // ✅ nombre nuevo recomendado (lo usás en PUT)
  excludeReservationId = null,

  // ✅ compat: nombre viejo por si en algún lugar quedó
  reservationIdToExclude = null,
}) {
  // Si viene el viejo, lo usamos
  const reservationIdToExcludeFinal =
    excludeReservationId ?? reservationIdToExclude ?? null;

  if (!spaceId || !date || !startTime || !endTime) {
    throw new ReservationValidationError('Faltan datos de la reserva');
  }

  // Interpretar date+time como hora local del coworking (Europe/Madrid) y convertir a UTC real.
  const dateOnly = madridDateYMDToUtcMidnight(date);
  const startDateTime = madridDateTimeToUtc(date, startTime);
  const endDateTime = madridDateTimeToUtc(date, endTime);

  if (
    Number.isNaN(dateOnly.getTime()) ||
    Number.isNaN(startDateTime.getTime()) ||
    Number.isNaN(endDateTime.getTime())
  ) {
    throw new ReservationValidationError('Fecha u horas inválidas');
  }

  // ✅ Bloqueo por cierres del coworking (OfficeClosure)
  // Se evalúa por fecha (día completo). Si hay cierre activo, no se permite reservar.
  try {
    const closure = await prisma.officeClosure.findFirst({
      where: { date: dateOnly, active: true },
      select: { reason: true },
    });
    if (closure) {
      const ymd = toDateOnlyYMD(dateOnly);
      throw new ReservationValidationError(
        closure.reason
          ? `El coworking está cerrado el ${ymd}. Motivo: ${closure.reason}`
          : `El coworking está cerrado el ${ymd}.`,
        'OFFICE_CLOSED',
        { date: ymd, reason: closure.reason || null }
      );
    }
  } catch (e) {
    if (e instanceof ReservationValidationError) throw e;
    // Si algo falla consultando cierres, no bloqueamos la reserva, pero lo logueamos.
    console.warn('[office-closures] No se pudo validar cierres:', e?.message || e);
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

  const excludeFilter = reservationIdToExcludeFinal
    ? { id: { not: reservationIdToExcludeFinal } }
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
  // En espacios compartidos permitimos solapes (capacidad se valida luego por attendees)
  if (!isSharedSpaceType(space.type)) {
    const overlapping = await prisma.reservation.findFirst({
      where: {
        ...excludeFilter,
        spaceId: Number(spaceId),
        status: { in: ['ACTIVE', 'PENDING'] }, // ✅ alineado con el resto del flujo
        date: dateOnly,
        startTime: { lt: endDateTime },
        endTime: { gt: startDateTime },
      },
      select: { id: true },
    });

    if (overlapping) {
      throw new ReservationValidationError(
        'Ya existe una reserva en ese espacio para esa franja horaria',
        'SPACE_OVERLAP'
      );
    }
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
 * GET /api/reservations/pending-groups
 * Pendientes agrupadas por seriesId (para que el admin apruebe/rechace toda la serie).
 * - SERIES: 1 fila por seriesId (usa la primera ocurrencia futura como "padre" visual)
 * - ONE: reservas no recurrentes
 */
router.get('/pending-groups', authRequired, requireAdmin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const pending = await prisma.reservation.findMany({
      where: { status: 'PENDING', date: { gte: today } },
      include: { user: true, space: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    const map = new Map();

    for (const r of pending) {
      const key = r.seriesId ? `S:${r.seriesId}` : `O:${r.id}`;

      if (!map.has(key)) {
        map.set(key, {
          type: r.seriesId ? 'SERIES' : 'ONE',
          seriesId: r.seriesId || null,
          reservationId: r.seriesId ? null : r.id,
          pattern: r.recurrencePattern || null,
          occurrences: 0,
          firstReservation: null,
        });
      }

      const g = map.get(key);
      g.occurrences += 1;
      if (!g.firstReservation) g.firstReservation = r;
    }

    return res.json(Array.from(map.values()));
  } catch (err) {
    console.error('ERROR GET /reservations/pending-groups', err);
    return res.status(500).json({ message: 'Error al obtener reservas pendientes' });
  }
});

/**
 * PATCH /api/reservations/series/:seriesId/approve
 * Aprueba TODAS las ocurrencias pendientes de una serie.
 */
router.patch('/series/:seriesId/approve', authRequired, requireAdmin, async (req, res) => {
  try {
    const { seriesId } = req.params;
    if (!seriesId) return res.status(400).json({ message: 'seriesId inválido' });

    const result = await prisma.reservation.updateMany({
      where: { seriesId, status: 'PENDING' },
      data: { status: 'ACTIVE' },
    });

    // Enviamos email usando la primera ocurrencia (si existe)
    const first = await prisma.reservation.findFirst({
      where: { seriesId },
      include: { user: true, space: true },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    if (first) {
      try {
        await notifyReservationApprovedToUser({
          reservation: first,
          user: first.user,
          space: first.space,
        });
      } catch (e) {
        console.error('No se pudo enviar email de serie aprobada al usuario:', e);
      }
    }

    return res.json({ ok: true, seriesId, approvedCount: result.count });
  } catch (err) {
    console.error('ERROR PATCH /reservations/series/:seriesId/approve', err);
    return res.status(500).json({ message: 'Error al aprobar la serie' });
  }
});

/**
 * PATCH /api/reservations/series/:seriesId/reject
 * Rechaza TODAS las ocurrencias pendientes de una serie.
 */
router.patch('/series/:seriesId/reject', authRequired, requireAdmin, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const { reason } = req.body || {};
    if (!seriesId) return res.status(400).json({ message: 'seriesId inválido' });

    const result = await prisma.reservation.updateMany({
      where: { seriesId, status: 'PENDING' },
      data: { status: 'REJECTED' },
    });

    // (Opcional) email de rechazo por serie. Lo dejamos fuera para no romper servicios.
    return res.json({ ok: true, seriesId, rejectedCount: result.count, reason: reason || null });
  } catch (err) {
    console.error('ERROR PATCH /reservations/series/:seriesId/reject', err);
    return res.status(500).json({ message: 'Error al rechazar la serie' });
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
    const actor = req.user || {};
    const actorId = actor.id ?? actor.userId; // soporta ambos
    const actorRole = actor.role || actor.userRole || 'USER';

    // ✅ BUG-0001: un ADMIN puede crear una reserva "en nombre" de otro usuario.
    // Soporta userId (frontend admin) y targetUserId (alias).
    const requestedUserIdRaw = (req.body || {}).userId ?? (req.body || {}).targetUserId;
    const requestedUserId = requestedUserIdRaw != null && requestedUserIdRaw !== ''
      ? Number(requestedUserIdRaw)
      : null;

    if (requestedUserId != null && Number.isNaN(requestedUserId)) {
      return res.status(400).json({ ok: false, message: 'userId inválido' });
    }

    // Por defecto, el usuario destino es el actor.
    let targetUserId = actorId;

    // Si actor es ADMIN y viene userId, usamos ese como usuario destino.
    if (String(actorRole).toUpperCase() === 'ADMIN' && requestedUserId) {
      targetUserId = requestedUserId;
    }

    // Si NO es ADMIN y viene userId distinto al actor => prohibido.
    if (String(actorRole).toUpperCase() !== 'ADMIN' && requestedUserId && requestedUserId !== actorId) {
      return res.status(403).json({ ok: false, message: 'No puedes crear reservas para otro usuario' });
    }

    const {
      spaceId,
      date,
      startTime,
      endTime,
      attendees,
      purpose,
      notes,
      // recurrencia
      recurrenceEnabled,
      recurrencePattern,
      recurrenceEndDate,
      recurrenceCount,
    } = req.body || {};

    if (!actorId) {
      return res
        .status(401)
        .json({ ok: false, error: 'Unauthorized: missing user id in token' });
    }

    if (!targetUserId) {
      return res
        .status(401)
        .json({ ok: false, error: 'Unauthorized: missing target user id' });
    }

    // Prepara ocurrencias (si aplica)
    const isRecurring = Boolean(recurrenceEnabled);
    const pattern = (recurrencePattern || 'WEEKLY').toString().toUpperCase();
    const hasEndDate = Boolean(recurrenceEndDate);
    const hasCount = recurrenceCount != null && recurrenceCount !== '';

    if (isRecurring) {
      if (hasEndDate && hasCount) {
        throw new ReservationValidationError(
          'Solo puedes elegir una regla de fin (fecha o cantidad)',
          'RECURRENCE_END_RULE'
        );
      }
      if (!hasEndDate && !hasCount) {
        throw new ReservationValidationError(
          'Debes elegir una regla de fin para la recurrencia',
          'RECURRENCE_END_RULE'
        );
      }
    }

    // ---- Ocurrencias (con ajuste de feriados/cierres para MONTHLY) ----
    let occurrenceDates;

    if (!isRecurring) {
      occurrenceDates = [new Date(`${date}T00:00:00`)];
    } else if (pattern !== 'MONTHLY') {
      // DAILY: excluir cierres/feriados (OfficeClosure)
      let closedYMDSet = null;
      if (pattern === 'DAILY') {
        try {
          const startDate = new Date(`${date}T00:00:00`);
          let rangeEnd = null;
          if (hasEndDate) rangeEnd = new Date(`${recurrenceEndDate}T00:00:00`);
          else if (hasCount) {
            // aprox: count días hábiles pueden estirarse por finde/cierres; damos margen
            rangeEnd = addDays(startDate, Math.max(0, Number(recurrenceCount) - 1) + 60);
          } else {
            rangeEnd = addDays(startDate, 120);
          }

          const closures = await prisma.officeClosure.findMany({
            where: {
              active: true,
              date: { gte: startDate, lte: rangeEnd },
            },
            select: { date: true },
          });

          closedYMDSet = new Set(closures.map((c) => toDateOnlyYMD(new Date(c.date))));
        } catch (e) {
          console.warn('[office-closures] No se pudo cargar cierres para DAILY recurrence:', e?.message || e);
          closedYMDSet = null;
        }
      }

      occurrenceDates = generateOccurrenceDates({
        startYMD: date,
        pattern,
        endDateYMD: hasEndDate ? recurrenceEndDate : null,
        count: hasCount ? Number(recurrenceCount) : null,
        closedYMDSet,
      });
    } else {
      // MONTHLY: “último <weekday>” del mes cuando falta el día o cae en finde/feriado.
      const startDate = new Date(`${date}T00:00:00`);
      const anchorDay = startDate.getDate();
      const anchorIsoWeekday = isoWeekday(startDate);

      // rango estimado para traer cierres/feriados
      let rangeEnd = null;
      if (hasEndDate) {
        rangeEnd = new Date(`${recurrenceEndDate}T00:00:00`);
      } else if (hasCount) {
        // aprox: (count-1) meses adelante, +35d de margen por ajustes
        const tmp = addMonthsSameDay(startDate, Math.max(0, Number(recurrenceCount) - 1));
        rangeEnd = addDays(tmp, 35);
      } else {
        rangeEnd = addDays(addMonthsSameDay(startDate, 12), 35);
      }

const closures = prisma.officeClosure
  ? await prisma.officeClosure.findMany({
      where: {
        date: {
          gte: startDate,
          lte: rangeEnd,
        },
        active: true,
      },
      select: { date: true },
    })
  : [];


      const closedYMDSet = new Set(closures.map((c) => toDateOnlyYMD(new Date(c.date))));

      // generar ocurrencias
      const out = [];
      const limitCount = hasCount ? Math.max(1, Number(recurrenceCount)) : null;
      const endDateObj = hasEndDate ? new Date(`${recurrenceEndDate}T00:00:00`) : null;

      for (let i = 0; i < 100; i++) {
        if (limitCount && out.length >= limitCount) break;

        const occ =
          i === 0
            ? startDate
            : addMonthsMonthlyBusinessWeekday({
                startDate,
                monthsToAdd: i,
                anchorDay,
                anchorIsoWeekday,
                closedYMDSet,
              });

        if (endDateObj && occ > endDateObj) break;
        out.push(new Date(occ));
      }

      occurrenceDates = out;
    }

    // Traer user para decidir PENDING/ACTIVE
    const user = await prisma.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, role: true, classify: true },
    });

    if (!user) {
      return res.status(401).json({ ok: false, error: 'Unauthorized user' });
    }

    const status = computeReservationStatus({ actorRole, user });

    // attendees (solo shared)
    let requestedAttendees = 1;
    const rawAtt = Number(attendees ?? 1);
    if (!Number.isInteger(rawAtt) || rawAtt < 1) {
      return res.status(400).json({
        ok: false,
        code: 'INVALID_ATTENDEES',
        message: 'attendees debe ser un entero >= 1',
      });
    }
    requestedAttendees = rawAtt;

    // ----- Validar fuera de transacción (mejor rendimiento) -----
    const seriesId = isRecurring ? safeRandomId() : null;
    const preparedRows = [];

    for (let i = 0; i < occurrenceDates.length; i++) {
      const occDate = occurrenceDates[i];
      const occYMD = toDateOnlyYMD(occDate);

      const { dateOnly, startDateTime, endDateTime, space } = await validateAndBuildReservation({
        userId: targetUserId,
        spaceId,
        date: occYMD,
        startTime,
        endTime,
      });

      const shared = isSharedSpaceType(space.type);
      const cap = effectiveCapacity(space);
      const occAttendees = shared ? requestedAttendees : 1;

      // Validación de disponibilidad (fuera de tx)
      const { start: dayStart, end: dayEnd } = getDayRange(dateOnly);

      if (shared) {
        const agg = await prisma.reservation.aggregate({
          where: {
            spaceId: space.id,
            status: { in: ['ACTIVE', 'PENDING'] },
            AND: [
              { startTime: { gte: dayStart, lt: dayEnd } },
              { startTime: { lt: endDateTime } },
              { endTime: { gt: startDateTime } },
            ],
          },
          _sum: { attendees: true },
        });

        const occupiedAttendees = Number(agg?._sum?.attendees ?? 0);
        if (occupiedAttendees + occAttendees > cap) {
          throw new ReservationValidationError(
            `No hay disponibilidad. ${space.name} está completo para ese horario (${occupiedAttendees}/${cap}).`,
            'CAPACITY_FULL',
            { occurrenceIndex: i + 1, date: occYMD }
          );
        }
      } else {
        const overlapping = await prisma.reservation.findFirst({
          where: {
            spaceId: space.id,
            status: { in: ['ACTIVE', 'PENDING'] },
            date: dateOnly,
            startTime: { lt: endDateTime },
            endTime: { gt: startDateTime },
          },
          select: { id: true },
        });

        if (overlapping) {
          throw new ReservationValidationError(
            `El espacio ${space.name} ya está reservado en ese horario.`,
            'SPACE_UNAVAILABLE',
            { occurrenceIndex: i + 1, date: occYMD }
          );
        }
      }

      const pricing = buildPricingSnapshot({
        startTime,
        endTime,
        spaceHourlyRate: space.hourlyRate,
        hourlyRateSnapshot: null,
        shared,
        attendees: occAttendees,
      });

      preparedRows.push({
        userId: targetUserId,
        spaceId: Number(spaceId),
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        status,
        attendees: occAttendees,

        // recurrencia
        seriesId,
        recurrencePattern: isRecurring ? pattern : null,
        recurrenceEndDate: isRecurring && hasEndDate ? new Date(`${recurrenceEndDate}T00:00:00`) : null,
        recurrenceCount: isRecurring && hasCount ? Number(recurrenceCount) : null,

        // snapshot + cálculo
        hourlyRateSnapshot: pricing.hourlyRateSnapshot,
        durationMinutes: pricing.durationMinutes,
        totalAmount: pricing.totalAmount,

        purpose: purpose ? String(purpose).trim() : null,
        notes: notes ? String(notes).trim() : null,
      });
    }

    // ----- Crear en transacción corta (createMany) -----
    await prisma.$transaction(
      async (tx) => {
        if (preparedRows.length === 1) {
          // createMany no devuelve el registro; para single usamos create.
          await tx.reservation.create({ data: preparedRows[0] });
        } else {
          await tx.reservation.createMany({ data: preparedRows });
        }
      },
      { timeout: 20000, maxWait: 20000 }
    );

    // Recuperar reservas creadas (con include) para respuesta
    const createdReservations = isRecurring
      ? await prisma.reservation.findMany({
          where: { seriesId },
          orderBy: { startTime: 'asc' },
          include: { user: true, space: true },
        })
      : await prisma.reservation.findMany({
          where: {
            userId: targetUserId,
            spaceId: Number(spaceId),
            date: preparedRows[0].date,
            startTime: preparedRows[0].startTime,
            endTime: preparedRows[0].endTime,
          },
          take: 1,
          include: { user: true, space: true },
        });

    // Si es recurrente devolvemos resumen + primera
    if (isRecurring) {
      return res.status(201).json({
        ok: true,
        seriesId,
        createdCount: createdReservations.length,
        first: createdReservations[0],
      });
    }

    return res.status(201).json(createdReservations[0]);
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
    return res
      .status(500)
      .json({ ok: false, error: 'Internal error creating reservation' });
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
      include: { space: true, user: true },
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
 * Edita una reserva del usuario (fecha/hora/attendees/purpose/notes)
 * Recalcula durationMinutes + totalAmount usando hourlyRateSnapshot (NO space.hourlyRate)
 */
router.put('/:id', authRequired, async (req, res) => {
  try {
    const actor = req.user || {};
    const actorId = actor.id ?? actor.userId;
    const actorRole = actor.role || actor.userRole || 'USER';

    if (!actorId) {
      return res
        .status(401)
        .json({ ok: false, error: 'Unauthorized: missing user id in token' });
    }

    const id = Number(req.params.id);
    if (!Number.isInteger(id)) {
      return res.status(400).json({ ok: false, error: 'Invalid reservation id' });
    }

    const {
      spaceId, // opcional: permitir cambiar de espacio (si querés bloquearlo, ignóralo)
      date,
      startTime,
      endTime,
      attendees,
      purpose,
      notes,
      // recurrencia
      applyTo, // ONE | SERIES
    } = req.body || {};

    // 1) Traer reserva actual
    const existing = await prisma.reservation.findUnique({
      where: { id },
      include: { space: true },
    });

    if (!existing) {
      return res.status(404).json({ ok: false, error: 'Reservation not found' });
    }

    // 2) Permisos: dueño o admin
    const isOwner = existing.userId === actorId;
    const isAdmin = actorRole === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return res.status(403).json({ ok: false, error: 'Forbidden' });
    }

    // 3) Estados editables (ajusta si tu negocio permite más)
    if (!['ACTIVE', 'PENDING'].includes(existing.status)) {
      return res.status(400).json({
        ok: false,
        code: 'RESERVATION_NOT_EDITABLE',
        message: 'Solo se pueden editar reservas ACTIVAS o PENDIENTES.',
      });
    }

    // 4) Preparar "valores objetivo" (si algo no viene, mantener lo existente)
    const targetSpaceId = Number(spaceId ?? existing.spaceId);

    // existing.date es Date → convertimos a YYYY-MM-DD para no romper validateAndBuildReservation
    const existingDateYMD = (() => {
      const d = new Date(existing.date);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    })();

    const targetDate = date ?? existingDateYMD;
    const targetStartTime = startTime ?? toHHMM(existing.startTime);
    const targetEndTime = endTime ?? toHHMM(existing.endTime);

    const scope = (applyTo || 'ONE').toString().toUpperCase();

    // ------------------------------
    // Edición serie recurrente
    // ------------------------------
    if (existing.seriesId && scope === 'SERIES') {
      // Por simplicidad (y para evitar efectos inesperados), no permitimos mover la fecha de toda la serie.
      if (date && date !== existingDateYMD) {
        return res.status(400).json({
          ok: false,
          code: 'RECURRENCE_SERIES_DATE_NOT_SUPPORTED',
          message: 'Para editar toda la serie, la fecha debe mantenerse. Cambios de fecha por serie no están soportados.',
        });
      }

      const now = new Date();

      const updatedSeries = await prisma.$transaction(async (tx) => {
        const seriesReservations = await tx.reservation.findMany({
          where: {
            seriesId: existing.seriesId,
            status: { in: ['ACTIVE', 'PENDING'] },
            startTime: { gte: existing.startTime },
          },
          include: { space: true },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        const out = [];

        for (const r of seriesReservations) {
          // Mantener fecha por ocurrencia
          const ymd = toDateOnlyYMD(new Date(r.date));

          const nextStart = startTime ?? toHHMM(r.startTime);
          const nextEnd = endTime ?? toHHMM(r.endTime);

          // Validar reglas (excluye la propia ocurrencia)
          const { dateOnly, startDateTime, endDateTime, space } = await validateAndBuildReservation({
            userId: r.userId,
            spaceId: r.spaceId,
            date: ymd,
            startTime: nextStart,
            endTime: nextEnd,
            excludeReservationId: r.id,
          });

          if (startDateTime <= now) {
            throw new ReservationValidationError(
              'No se puede editar una reserva que ya comenzó o está en el pasado.',
              'PAST_RESERVATION',
              { id: r.id, date: ymd }
            );
          }

          const shared = isSharedSpaceType(space.type);
          const cap = effectiveCapacity(space);
          const occAttendees = shared
            ? Number(attendees ?? r.attendees ?? 1)
            : 1;

          if (shared) {
            if (!Number.isInteger(occAttendees) || occAttendees < 1) {
              throw new ReservationValidationError('attendees debe ser un entero >= 1', 'INVALID_ATTENDEES', {
                id: r.id,
                date: ymd,
              });
            }

            const { start: dayStart, end: dayEnd } = getDayRange(dateOnly);
            const agg = await tx.reservation.aggregate({
              where: {
                id: { not: r.id },
                spaceId: r.spaceId,
                status: { in: ['ACTIVE', 'PENDING'] },
                AND: [
                  { startTime: { gte: dayStart, lt: dayEnd } },
                  { startTime: { lt: endDateTime } },
                  { endTime: { gt: startDateTime } },
                ],
              },
              _sum: { attendees: true },
            });
            const occupiedAttendees = Number(agg?._sum?.attendees ?? 0);
            if (occupiedAttendees + occAttendees > cap) {
              throw new ReservationValidationError(
                `No hay disponibilidad. ${space.name} está completo para ese horario (${occupiedAttendees}/${cap}).`,
                'CAPACITY_FULL',
                { id: r.id, date: ymd }
              );
            }
          } else {
            const overlapping = await tx.reservation.findFirst({
              where: {
                id: { not: r.id },
                spaceId: r.spaceId,
                status: { in: ['ACTIVE', 'PENDING'] },
                date: dateOnly,
                startTime: { lt: endDateTime },
                endTime: { gt: startDateTime },
              },
              select: { id: true },
            });
            if (overlapping) {
              throw new ReservationValidationError(
                `El espacio ${space.name} ya está reservado en ese horario.`,
                'SPACE_UNAVAILABLE',
                { id: r.id, date: ymd }
              );
            }
          }

          const pricing = buildPricingSnapshot({
            startTime: nextStart,
            endTime: nextEnd,
            spaceHourlyRate: null,
            hourlyRateSnapshot: r.hourlyRateSnapshot,
            shared,
            attendees: shared ? occAttendees : 1,
          });

          const updated = await tx.reservation.update({
            where: { id: r.id },
            data: {
              // No cambiamos date ni spaceId en edición por serie (solo horario + info)
              startTime: startDateTime,
              endTime: endDateTime,
              attendees: shared ? occAttendees : 1,
              hourlyRateSnapshot: pricing.hourlyRateSnapshot,
              durationMinutes: pricing.durationMinutes,
              totalAmount: pricing.totalAmount,
              purpose:
                purpose !== undefined ? (purpose ? String(purpose).trim() : null) : r.purpose,
              notes: notes !== undefined ? (notes ? String(notes).trim() : null) : r.notes,
            },
            include: { user: true, space: true },
          });

          out.push(updated);
        }

        return out;
      });

      return res.json({
        ok: true,
        seriesId: existing.seriesId,
        updatedCount: updatedSeries.length,
        first: updatedSeries[0] ?? null,
      });
    }

    // 5) Validar reglas base y obtener space / datetimes
    const { dateOnly, startDateTime, endDateTime, space } =
      await validateAndBuildReservation({
        userId: existing.userId,
        spaceId: targetSpaceId,
        date: targetDate,
        startTime: targetStartTime,
        endTime: targetEndTime,
        excludeReservationId: id,
      });

    const shared = isSharedSpaceType(space.type);
    let requestedAttendees = existing.attendees ?? 1;

    if (shared) {
      requestedAttendees = Number(attendees ?? existing.attendees ?? 1);
      if (!Number.isInteger(requestedAttendees) || requestedAttendees < 1) {
        return res.status(400).json({
          ok: false,
          code: 'INVALID_ATTENDEES',
          message: 'attendees debe ser un entero >= 1',
        });
      }
    } else {
      requestedAttendees = 1; // unitarios
    }

    const cap = effectiveCapacity(space);

    // 6) No permitir editar reservas en el pasado
    const now = new Date();
    if (startDateTime <= now) {
      return res.status(400).json({
        ok: false,
        code: 'PAST_RESERVATION',
        message: 'No se puede editar una reserva que ya comenzó o está en el pasado.',
      });
    }

    // 7) Validación de disponibilidad (excluyendo esta reserva)
    const { start: dayStart, end: dayEnd } = getDayRange(dateOnly);

    if (shared) {
      const agg = await prisma.reservation.aggregate({
        where: {
          id: { not: id },
          spaceId: space.id,
          status: { in: ['ACTIVE', 'PENDING'] },
          AND: [
            { startTime: { gte: dayStart, lt: dayEnd } },
            { startTime: { lt: endDateTime } },
            { endTime: { gt: startDateTime } },
          ],
        },
        _sum: { attendees: true },
      });

      const occupiedAttendees = Number(agg?._sum?.attendees ?? 0);

      if (occupiedAttendees + requestedAttendees > cap) {
        return res.status(409).json({
          ok: false,
          code: 'CAPACITY_FULL',
          message: `No hay disponibilidad. ${space.name} está completo para ese horario (${occupiedAttendees}/${cap}).`,
          meta: {
            occupiedAttendees,
            requestedAttendees,
            capacity: cap,
          },
        });
      }
    } else {
      const overlapping = await prisma.reservation.findFirst({
        where: {
          id: { not: id },
          spaceId: space.id,
          status: { in: ['ACTIVE', 'PENDING'] },
          date: dateOnly,
          startTime: { lt: endDateTime },
          endTime: { gt: startDateTime },
        },
        select: { id: true },
      });

      if (overlapping) {
        return res.status(409).json({
          ok: false,
          code: 'SPACE_UNAVAILABLE',
          message: `El espacio ${space.name} ya está reservado en ese horario.`,
        });
      }
    }

    // 8) Pricing: recalcular SIEMPRE usando snapshot existente (NO space.hourlyRate)
    const pricing = buildPricingSnapshot({
      startTime: targetStartTime,
      endTime: targetEndTime,
      spaceHourlyRate: null,
      hourlyRateSnapshot: existing.hourlyRateSnapshot,
      shared,
      attendees: shared ? requestedAttendees : 1,
    });

    // 9) Persistir cambios
    const updated = await prisma.reservation.update({
      where: { id },
      data: {
        spaceId: targetSpaceId,
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,

        attendees: shared ? requestedAttendees : 1,

        hourlyRateSnapshot: pricing.hourlyRateSnapshot,
        durationMinutes: pricing.durationMinutes,
        totalAmount: pricing.totalAmount,

        purpose:
          purpose !== undefined
            ? (purpose ? String(purpose).trim() : null)
            : existing.purpose,
        notes:
          notes !== undefined
            ? (notes ? String(notes).trim() : null)
            : existing.notes,
      },
      include: { user: true, space: true },
    });

    return res.json(updated);
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
    return res
      .status(500)
      .json({ ok: false, error: 'Internal error updating reservation' });
  }
});

/**
 * helper local: convierte Date a "HH:MM"
 */
function toHHMM(dateOrString) {
  if (typeof dateOrString === 'string') {
    if (/^\d{2}:\d{2}$/.test(dateOrString)) return dateOrString;
    const d = new Date(dateOrString);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    }
    return dateOrString;
  }
  const d = new Date(dateOrString);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

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
