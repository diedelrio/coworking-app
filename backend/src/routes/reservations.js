// backend/src/routes/reservations.js
const { isSharedSpaceType, effectiveCapacity } = require('../services/spaceCapacity');
const { countOverlappingReservations } = require('../services/reservationOccupancy');
const { computeReservationStatus } = require('../services/reservationStatus');

const express = require('express');
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
  notifyReservationCancelledToAdmins,
} = require('../services/alertNotificationService');

// ✅ Validador de horario/min/step (usa settings DB por dentro)
const { validateReservationTimes } = require('../utils/reservationTimeValidator');
const {
  madridDateTimeToUtc,
  madridDateYMDToUtcMidnight,
  utcToMadridYMD,
  addDaysYMD,
  isoWeekdayYMD,
  getPartsInTZ,
  TZ,
} = require('../utils/timezone');
const { ReservationValidationError } = require('../services/reservationErrors');
const { safeRandomId, toDateOnlyYMD, buildOccurrenceDates } = require('../services/recurrence');

const { DeskError, deskInclude, lockSpaces, allocationData } = require('../services/deskAllocation');
const router = express.Router();

/* ------------------------------ Helpers fechas ------------------------------ */
// Todas las fechas de reserva se guardan como medianoche Europe/Madrid (en UTC).
// Los rangos de día/semana se calculan en calendario Madrid para no depender de la TZ del servidor.

function getDayRange(dateOnly) {
  const ymd = utcToMadridYMD(dateOnly);
  return {
    start: madridDateYMDToUtcMidnight(ymd),
    end: madridDateYMDToUtcMidnight(addDaysYMD(ymd, 1)),
  };
}

// 'HH:MM' en hora Madrid de un instante UTC
function toHHMM(date) {
  const p = getPartsInTZ(new Date(date), TZ);
  return `${String(p.hour).padStart(2, '0')}:${String(p.minute).padStart(2, '0')}`;
}

function getWeekRangeFromDate(dateOnly) {
  const ymd = utcToMadridYMD(dateOnly);
  const monday = addDaysYMD(ymd, 1 - isoWeekdayYMD(ymd));
  return {
    weekStart: madridDateYMDToUtcMidnight(monday),
    weekEnd: madridDateYMDToUtcMidnight(addDaysYMD(monday, 7)),
  };
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

/* ------------------------------ Contexto de validación ------------------------------ */

/**
 * Precarga de datos para validar muchas fechas (series) sin repetir consultas.
 * - Siempre carga espacios, reglas por tipo y cierres del rango.
 * - Con { withReservations: true } también carga las reservas del usuario (ACTIVE) y del
 *   espacio (ACTIVE/PENDING) del rango, y las validaciones se resuelven en memoria.
 */
async function createValidationContext({ db = prisma, userId, spaceIds, ymds, withReservations = false }) {
  const sorted = [...ymds].sort();
  const from = madridDateYMDToUtcMidnight(addDaysYMD(sorted[0], -7));
  const to = madridDateYMDToUtcMidnight(addDaysYMD(sorted[sorted.length - 1], 8));
  const ids = [...new Set(spaceIds.map(Number))];

  const [spaces, closures] = await Promise.all([
    db.space.findMany({ where: { id: { in: ids } } }),
    db.officeClosure.findMany({ where: { active: true, date: { gte: from, lte: to } }, select: { date: true } }),
  ]);

  const ctx = {
    spaces: new Map(spaces.map((s) => [s.id, s])),
    typeRules: new Map(),
    closedYMDs: new Set(closures.map((c) => utcToMadridYMD(c.date))),
    userRes: null,
    spaceRes: null,
  };

  for (const type of new Set(spaces.map((s) => s.type))) {
    ctx.typeRules.set(type, await getTypeReservationRules(type));
  }

  if (withReservations) {
    const [userRes, spaceRes] = await Promise.all([
      db.reservation.findMany({
        where: { userId, status: 'ACTIVE', date: { gte: from, lt: to } },
        select: { id: true, spaceId: true, date: true, startTime: true, endTime: true, space: { select: { type: true } } },
      }),
      db.reservation.findMany({
        where: { spaceId: { in: ids }, status: { in: ['ACTIVE', 'PENDING'] }, date: { gte: from, lt: to } },
        select: { id: true, spaceId: true, date: true, startTime: true, endTime: true, attendees: true },
      }),
    ]);
    ctx.userRes = userRes.map((r) => ({ ...r, spaceType: r.space?.type }));
    ctx.spaceRes = spaceRes;
  }

  return ctx;
}

/** Refleja en el contexto una reserva guardada (nueva o editada) para las validaciones siguientes. */
function updateValidationContextRow(ctx, saved, spaceType) {
  if (!ctx) return;
  const row = {
    id: saved.id,
    spaceId: saved.spaceId,
    date: saved.date,
    startTime: saved.startTime,
    endTime: saved.endTime,
    attendees: saved.attendees,
  };
  const replace = (list, item) => {
    const i = list.findIndex((o) => o.id === saved.id);
    if (item) {
      if (i >= 0) list[i] = item;
      else list.push(item);
    } else if (i >= 0) {
      list.splice(i, 1);
    }
  };
  const blocks = ['ACTIVE', 'PENDING'].includes(saved.status);
  if (ctx.spaceRes) replace(ctx.spaceRes, blocks ? row : null);
  if (ctx.userRes) replace(ctx.userRes, saved.status === 'ACTIVE' ? { ...row, spaceType } : null);
}

/** Suma al contexto una reserva ya validada para que cuente en las siguientes fechas de la serie. */
function addToValidationContext(ctx, { spaceId, spaceType, date, startTime, endTime, attendees, countsForLimits }) {
  if (!ctx) return;
  const row = { id: null, spaceId, date, startTime, endTime, attendees };
  if (ctx.spaceRes) ctx.spaceRes.push(row);
  if (ctx.userRes && countsForLimits) ctx.userRes.push({ ...row, spaceType });
}

/**
 * Valida reglas de negocio y devuelve los objetos Date construidos.
 * Lanza ReservationValidationError si algo no cumple.
 * `ctx` (opcional) evita consultas repetidas al validar series.
 */
async function validateAndBuildReservation({
  db = prisma,
  ctx = null,
  userId,
  actorRole ='USER',
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

  // ✅ Bloqueo por cierres del coworking (OfficeClosure), por fecha (día completo).
  // Si falla la consulta se propaga el error (500): nunca se reserva "a ciegas" un día cerrado.
  let closure = null;
  if (ctx?.closedYMDs) {
    if (ctx.closedYMDs.has(date)) closure = { reason: null };
  } else {
    closure = await db.officeClosure.findFirst({
      where: {
        active: true,
        OR: [
          { date: dateOnly },
          { date: new Date(`${date}T00:00:00.000Z`) },
        ],
      },
      select: { reason: true },
    });
  }

  if (closure) {
    throw new ReservationValidationError(
      closure.reason
        ? `El coworking está cerrado el ${date}. Motivo: ${closure.reason}`
        : `El coworking está cerrado el ${date}.`,
      'OFFICE_CLOSED',
      { date, reason: closure.reason || null }
    );
  }

  if (endDateTime <= startDateTime) {
    throw new ReservationValidationError(
      'La hora de fin debe ser posterior a la de inicio'
    );
  }

  // ✅ Validación única (sin duplicar): horario + step + minDuration
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

  // ✅ Antelación mínima (settings)
  const now = new Date();
  let minHoursBefore = 0;

  try {
    const rules = await getReservationRules();
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
  const space = ctx?.spaces?.has(Number(spaceId))
    ? ctx.spaces.get(Number(spaceId))
    : await db.space.findUnique({ where: { id: Number(spaceId) } });

  if (!space || !space.active) {
    throw new ReservationValidationError('El espacio no existe o está inactivo');
  }

  // Reglas por tipo (viene desde reservationValidationService.js)
  const typeRules = ctx?.typeRules?.get(space.type) ?? (await getTypeReservationRules(space.type));

  const newReservationHours = getReservationDurationHours(
    startDateTime,
    endDateTime
  );

  const excludeFilter = reservationIdToExcludeFinal
    ? { id: { not: reservationIdToExcludeFinal } }
    : {};

  // Reservas ACTIVE del usuario para este tipo de espacio en [from, to): en memoria (series) o BD.
  const findUserReservations = async (from, to) => {
    if (ctx?.userRes) {
      return ctx.userRes.filter(
        (r) =>
          r.spaceType === space.type &&
          (reservationIdToExcludeFinal == null || r.id !== reservationIdToExcludeFinal) &&
          r.date >= from &&
          r.date < to
      );
    }
    return db.reservation.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        ...excludeFilter,
        date: { gte: from, lt: to },
        space: { type: space.type },
      },
      select: { spaceId: true, startTime: true, endTime: true },
    });
  };

  // --- 1) Límite por día, por usuario y tipo de espacio ---
  const { start: startOfDay, end: endOfDay } = getDayRange(dateOnly);
  const dayReservations = await findUserReservations(startOfDay, endOfDay);

  const usedDayHours = dayReservations.reduce(
    (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
    0
  );

  const isAdmin = String(actorRole).toUpperCase() === 'ADMIN';
  if (
      !isAdmin &&
      usedDayHours + newReservationHours > typeRules.maxHoursPerDayPerUser
    ) {
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
  const weekReservations = await findUserReservations(weekStart, weekEnd);

  const usedWeekHours = weekReservations.reduce(
    (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
    0
  );

  if (
    !isAdmin &&
    usedWeekHours + newReservationHours > typeRules.maxHoursPerWeekPerUser
  ) {
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
  // (las reservas del día ya están cargadas: filtramos las que se solapan en horario)
  const overlappingSameType = dayReservations.filter(
    (r) => r.startTime < endDateTime && r.endTime > startDateTime
  );
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
    let overlapping;
    if (ctx?.spaceRes) {
      overlapping = ctx.spaceRes.find(
        (r) =>
          r.spaceId === Number(spaceId) &&
          (reservationIdToExcludeFinal == null || r.id !== reservationIdToExcludeFinal) &&
          r.date.getTime() === dateOnly.getTime() &&
          r.startTime < endDateTime &&
          r.endTime > startDateTime
      );
    } else {
      overlapping = await db.reservation.findFirst({
        where: {
          ...excludeFilter,
          spaceId: Number(spaceId),
          status: { in: ['ACTIVE', 'PENDING'] },
          date: dateOnly,
          startTime: { lt: endDateTime },
          endTime: { gt: startDateTime },
        },
        select: { id: true },
      });
    }

    if (overlapping) {
      throw new ReservationValidationError(
        'Ya existe una reserva en ese espacio para esa franja horaria',
        'SPACE_OVERLAP'
      );
    }
  }

  return { dateOnly, startDateTime, endDateTime, space };
}

/**
 * Re-chequea solapes/capacidad con el espacio bloqueado (FOR UPDATE), en UNA consulta para
 * todas las filas. La validación previa se hace fuera de la transacción y dos peticiones
 * simultáneas podían pasarla a la vez (sobreventa).
 * Los espacios con mesas numeradas se validan en allocationData.
 */
async function assertNoConflictsUnderLock(tx, rows, space) {
  if (!rows.length || !space || space.numberedDesks) return;
  const minStart = new Date(Math.min(...rows.map((r) => r.startTime.getTime())));
  const maxEnd = new Date(Math.max(...rows.map((r) => r.endTime.getTime())));
  const existing = await tx.reservation.findMany({
    where: {
      spaceId: space.id,
      status: { in: ['ACTIVE', 'PENDING'] },
      startTime: { lt: maxEnd },
      endTime: { gt: minStart },
    },
    select: { startTime: true, endTime: true, attendees: true },
  });
  const shared = isSharedSpaceType(space.type);
  const cap = effectiveCapacity(space);
  rows.forEach((row, i) => {
    const overlapping = existing.filter((r) => r.startTime < row.endTime && r.endTime > row.startTime);
    if (shared) {
      const occupied = overlapping.reduce((sum, r) => sum + Number(r.attendees ?? 1), 0);
      if (occupied + row.attendees > cap) {
        throw new ReservationValidationError(
          `No hay disponibilidad. ${space.name} está completo para ese horario (${occupied}/${cap}).`,
          'CAPACITY_FULL',
          { occurrenceIndex: i + 1 }
        );
      }
    } else if (overlapping.length) {
      throw new ReservationValidationError(
        `El espacio ${space.name} ya está reservado en ese horario.`,
        'SPACE_UNAVAILABLE',
        { occurrenceIndex: i + 1 }
      );
    }
  });
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
      include: { user: true, space: true, desks: deskInclude },
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
      include: { user: true, space: true, desks: deskInclude },
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
      include: { user: true, space: true, desks: deskInclude },
      orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
    });

    if (first) {
      // Sin await: el SMTP puede tardar hasta 20 s y no debe retrasar la respuesta.
      notifyReservationApprovedToUser({
        reservation: first,
        user: first.user,
        space: first.space,
      }).catch((e) => {
        console.error('No se pudo enviar email de serie aprobada al usuario:', e);
      });
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
      include: { user: true, space: true, desks: deskInclude },
    });

    if (!existing) return res.status(404).json({ message: 'Reserva no encontrada' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: 'Solo se pueden aprobar reservas pendientes' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'ACTIVE' },
      include: { user: true, space: true, desks: deskInclude },
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
      include: { user: true, space: true, desks: deskInclude },
    });

    if (!existing) return res.status(404).json({ message: 'Reserva no encontrada' });
    if (existing.status !== 'PENDING') {
      return res.status(400).json({ message: 'Solo se pueden rechazar reservas pendientes' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'REJECTED' },
      include: { user: true, space: true, desks: deskInclude },
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
 * Avisa a los admins (email + popup) cuando un NO admin cancela una reserva.
 * Sin await: no debe demorar ni romper la respuesta al usuario.
 */
function notifyAdminsOfCancellation({ role, reservation }) {
  if (String(role).toUpperCase() === 'ADMIN') return;
  notifyReservationCancelledToAdmins({
    reservation,
    user: reservation.user,
    space: reservation.space,
  }).catch((e) => console.error('No se pudo notificar la cancelación a los admins:', e));
}

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

    if (!['ACTIVE', 'PENDING'].includes(reservation.status)) {
      return res.status(400).json({ message: 'Solo se pueden cancelar reservas activas o pendientes' });
    }

    const now = new Date();
    if (reservation.startTime <= now) {
      return res.status(400).json({ message: 'No se puede cancelar una reserva pasada' });
    }

    const updated = await prisma.reservation.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: { user: true, space: true },
    });
    notifyAdminsOfCancellation({ role, reservation: updated });

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

    const occurrenceDates = await buildOccurrenceDates({ date, isRecurring, pattern, recurrenceEndDate: hasEndDate ? recurrenceEndDate : null, recurrenceCount: hasCount ? Number(recurrenceCount) : null });

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

    // Una sola ronda de consultas para toda la serie (antes: ~8 consultas por fecha).
    const ctx = await createValidationContext({
      userId: targetUserId,
      spaceIds: [spaceId],
      ymds: occurrenceDates.map(toDateOnlyYMD),
      withReservations: true,
    });

    for (let i = 0; i < occurrenceDates.length; i++) {
      const occDate = occurrenceDates[i];
      const occYMD = toDateOnlyYMD(occDate);

      const { dateOnly, startDateTime, endDateTime, space } = await validateAndBuildReservation({
        ctx,
        userId: targetUserId,
        actorRole,
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

      if (space.numberedDesks) {
        // Individual desks are checked and assigned under the space lock below.
      } else if (shared) {
        const agg = {
          _sum: {
            attendees: ctx.spaceRes
              .filter(
                (r) =>
                  r.spaceId === space.id &&
                  r.startTime >= dayStart &&
                  r.startTime < dayEnd &&
                  r.startTime < endDateTime &&
                  r.endTime > startDateTime
              )
              .reduce((sum, r) => sum + Number(r.attendees ?? 1), 0),
          },
        };
        const occupiedAttendees = Number(agg?._sum?.attendees ?? 0);
        if (occupiedAttendees + occAttendees > cap) {
          throw new ReservationValidationError(
            `No hay disponibilidad. ${space.name} está completo para ese horario (${occupiedAttendees}/${cap}).`,
            'CAPACITY_FULL',
            { occurrenceIndex: i + 1, date: occYMD }
          );
        }
      } else {
        const overlapping = ctx.spaceRes.find(
          (r) =>
            r.spaceId === space.id &&
            r.date.getTime() === dateOnly.getTime() &&
            r.startTime < endDateTime &&
            r.endTime > startDateTime
        );

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

      addToValidationContext(ctx, {
        spaceId: Number(spaceId),
        spaceType: space.type,
        date: dateOnly,
        startTime: startDateTime,
        endTime: endDateTime,
        attendees: occAttendees,
        countsForLimits: status === 'ACTIVE',
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
        recurrenceEndDate: isRecurring && hasEndDate ? madridDateYMDToUtcMidnight(recurrenceEndDate) : null,
        recurrenceCount: isRecurring && hasCount ? Number(recurrenceCount) : null,

        // snapshot + cálculo
        hourlyRateSnapshot: pricing.hourlyRateSnapshot,
        durationMinutes: pricing.durationMinutes,
        totalAmount: pricing.totalAmount,

        purpose: purpose ? String(purpose).trim() : null,
        notes: notes ? String(notes).trim() : null,
      });
    }

    const createdReservations = await prisma.$transaction(async (tx) => {
      await lockSpaces(tx, preparedRows.map(row => row.spaceId));
      await assertNoConflictsUnderLock(tx, preparedRows, ctx.spaces.get(Number(spaceId)));
      const created = [];
      for (const row of preparedRows) {
        const desks = await allocationData(tx, row, { admin: actorRole === 'ADMIN', deskIds: req.body.deskIds, space: ctx.spaces.get(row.spaceId) });
        created.push(await tx.reservation.create({ data: { ...row, ...desks }, include: { user: true, space: true, desks: deskInclude } }));
      }
      return created;
    }, { timeout: 60000, maxWait: 20000 });

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
    if (err instanceof DeskError) return res.status(err.status).json({ message: err.message, code: err.code });
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
      include: { space: true, desks: deskInclude },
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
      include: { user: true, space: true, desks: deskInclude },
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
 * Todas las reservas (admin) con filtros opcionales
 */
router.get('/', authRequired, requireAdmin, async (req, res) => {
  try {
    const { userId, spaceId, status } = req.query || {};

    const where = {};

    const parsedUserId = Number(userId);
    if (!Number.isNaN(parsedUserId) && parsedUserId > 0) {
      where.userId = parsedUserId;
    }

    const parsedSpaceId = Number(spaceId);
    if (!Number.isNaN(parsedSpaceId) && parsedSpaceId > 0) {
      where.spaceId = parsedSpaceId;
    }

    if (typeof status === 'string' && status && status !== 'ALL') {
      where.status = status;
    }

    const reservations = await prisma.reservation.findMany({
      where,
      include: {
        user: true,
        space: true,
        desks: deskInclude,
      },
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
      include: { space: true, user: true, desks: deskInclude },
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
      include: { space: true, desks: deskInclude },
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
    const existingDateYMD = utcToMadridYMD(existing.date);

    const targetDate = date ?? existingDateYMD;
    const targetStartTime = startTime ?? toHHMM(existing.startTime);
    const targetEndTime = endTime ?? toHHMM(existing.endTime);

    const scope = (applyTo || 'ONE').toString().toUpperCase();
    const body = req.body || {};
    const nextPattern = String(body.recurrencePattern ?? existing.recurrencePattern ?? 'WEEKLY').toUpperCase();
    const hasNewEnd = body.recurrenceEndDate != null;
    const hasNewCount = body.recurrenceCount != null;
    if (hasNewEnd && hasNewCount) throw new ReservationValidationError('Elegí una sola regla de fin.', 'INVALID_RECURRENCE');
    const nextEnd = hasNewEnd ? body.recurrenceEndDate : hasNewCount ? null : existing.recurrenceEndDate ? utcToMadridYMD(existing.recurrenceEndDate) : null;
    const nextCount = hasNewCount ? Number(body.recurrenceCount) : hasNewEnd ? null : existing.recurrenceCount;
    const recurrenceChanged = Boolean(existing.seriesId) && (
      nextPattern !== existing.recurrencePattern || nextCount !== existing.recurrenceCount ||
      nextEnd !== (existing.recurrenceEndDate ? utcToMadridYMD(existing.recurrenceEndDate) : null)
    );
    if (recurrenceChanged && scope !== 'SERIES') throw new ReservationValidationError('Para cambiar la repetición, aplicá los cambios a la serie.', 'RECURRENCE_REQUIRES_SERIES');


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

      const seriesSpaceRows = await prisma.reservation.findMany({ where: { seriesId: existing.seriesId }, select: { spaceId: true } });
      const lockedSpaceIds = [...new Set(seriesSpaceRows.map(r => r.spaceId))];
      const updatedSeries = await prisma.$transaction(async (tx) => {
        await lockSpaces(tx, lockedSpaceIds);
        let seriesReservations = await tx.reservation.findMany({
          where: {
            seriesId: existing.seriesId,
            status: { in: ['ACTIVE', 'PENDING'] },
            startTime: { gte: existing.startTime },
          },
          include: { space: true, desks: deskInclude },
          orderBy: [{ date: 'asc' }, { startTime: 'asc' }],
        });

        if (seriesReservations.some(r => !lockedSpaceIds.includes(r.spaceId))) throw new DeskError('La serie cambió de espacio. Recargá los datos antes de editar.');
        if (!seriesReservations.length || seriesReservations.some(r => r.startTime <= now)) throw new DeskError('La serie ya comenzó o cambió. Recargá los datos antes de editar.');
        let recurrenceData = {};
        if (recurrenceChanged) {
          const ids = seriesReservations.map(r => r.id);
          if (await tx.liquidationItem.count({ where: { reservationId: { in: ids } } })) throw new DeskError('La serie contiene reservas liquidadas y no puede reprogramarse.');
          const dates = await buildOccurrenceDates({ date: targetDate, isRecurring: true, pattern: nextPattern, recurrenceEndDate: nextEnd, recurrenceCount: nextCount, db: tx });
          recurrenceData = { recurrencePattern: nextPattern, recurrenceEndDate: nextEnd ? madridDateYMDToUtcMidnight(nextEnd) : null, recurrenceCount: nextCount };
          // Release the old dates inside this transaction; failures roll back the entire change.
          await tx.reservation.updateMany({ where: { id: { in: ids } }, data: { status: 'CANCELLED' } });
          const previous = seriesReservations;
          seriesReservations = dates.map((day, index) => ({
            ...(previous[index] || previous[0]),
            id: previous[index]?.id ?? null,
            date: madridDateYMDToUtcMidnight(toDateOnlyYMD(day)),
          }));
        }

        // Una sola ronda de consultas para toda la serie; las filas ya actualizadas se
        // reflejan en el contexto (updateValidationContextRow) para que las siguientes las vean.
        const staticCtx = await createValidationContext({
          db: tx,
          userId: seriesReservations[0].userId,
          spaceIds: lockedSpaceIds,
          ymds: seriesReservations.map((r) => utcToMadridYMD(r.date)),
          withReservations: true,
        });
        const out = [];

        for (const r of seriesReservations) {
          // Mantener fecha por ocurrencia
          const ymd = utcToMadridYMD(r.date);

          const nextStart = startTime ?? toHHMM(r.startTime);
          const nextEnd = endTime ?? toHHMM(r.endTime);

          // Validar reglas (excluye la propia ocurrencia)
          const { dateOnly, startDateTime, endDateTime, space } = await validateAndBuildReservation({
            db: tx,
            ctx: staticCtx,
            userId: r.userId,
            actorRole,
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

          if (space.numberedDesks) {
            // allocationData validates the count and complete interval under the lock.
          } else if (shared) {
            if (!Number.isInteger(occAttendees) || occAttendees < 1) {
              throw new ReservationValidationError('attendees debe ser un entero >= 1', 'INVALID_ATTENDEES', {
                id: r.id,
                date: ymd,
              });
            }

            const { start: dayStart, end: dayEnd } = getDayRange(dateOnly);
            const occupiedAttendees = staticCtx.spaceRes
              .filter(
                (o) =>
                  (r.id == null || o.id !== r.id) &&
                  o.spaceId === r.spaceId &&
                  o.startTime >= dayStart &&
                  o.startTime < dayEnd &&
                  o.startTime < endDateTime &&
                  o.endTime > startDateTime
              )
              .reduce((sum, o) => sum + Number(o.attendees ?? 1), 0);
            if (occupiedAttendees + occAttendees > cap) {
              throw new ReservationValidationError(
                `No hay disponibilidad. ${space.name} está completo para ese horario (${occupiedAttendees}/${cap}).`,
                'CAPACITY_FULL',
                { id: r.id, date: ymd }
              );
            }
          } else {
            const overlapping = staticCtx.spaceRes.find(
              (o) =>
                (r.id == null || o.id !== r.id) &&
                o.spaceId === r.spaceId &&
                o.date.getTime() === dateOnly.getTime() &&
                o.startTime < endDateTime &&
                o.endTime > startDateTime
            );
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

          const deskData = await allocationData(tx, { spaceId: r.spaceId, startTime: startDateTime, endTime: endDateTime, attendees: occAttendees }, { admin: isAdmin, deskIds: req.body.deskIds, excludeId: r.id, space });
          const updatedData = {
              ...deskData,
              ...recurrenceData,
              status: r.status,
              date: dateOnly,
              startTime: startDateTime,
              endTime: endDateTime,
              attendees: shared ? occAttendees : 1,
              hourlyRateSnapshot: pricing.hourlyRateSnapshot,
              durationMinutes: pricing.durationMinutes,
              totalAmount: pricing.totalAmount,
              purpose:
                purpose !== undefined ? (purpose ? String(purpose).trim() : null) : r.purpose,
              notes: notes !== undefined ? (notes ? String(notes).trim() : null) : r.notes,
          };
          const include = { user: true, space: true, desks: deskInclude };
          const updated = r.id
            ? await tx.reservation.update({ where: { id: r.id }, data: updatedData, include })
            : await tx.reservation.create({ data: { ...updatedData, userId: r.userId, spaceId: r.spaceId, seriesId: existing.seriesId }, include });
          updateValidationContextRow(staticCtx, updated, space.type);
          out.push(updated);
        }

        return out;
      }, { timeout: 20000, maxWait: 20000 });

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
        actorRole,
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

    if (space.numberedDesks) {
      // Rechecked when persisting under the space lock.
    } else if (shared) {
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

    // Allocation and reservation changes commit together under the same space lock.
    const updated = await prisma.$transaction(async (tx) => {
      await lockSpaces(tx, [existing.spaceId, targetSpaceId]);
      const current = await tx.reservation.findUnique({ where: { id } });
      if (!current || !['ACTIVE', 'PENDING'].includes(current.status) || current.spaceId !== existing.spaceId) throw new DeskError('La reserva cambió. Recargá sus datos antes de editar.');
      const deskData = await allocationData(tx, { spaceId: targetSpaceId, startTime: startDateTime, endTime: endDateTime, attendees: shared ? requestedAttendees : 1 }, { admin: isAdmin, deskIds: req.body.deskIds, excludeId: id });
      return tx.reservation.update({
      where: { id },
      data: {
        ...deskData,
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
      include: { user: true, space: true, desks: deskInclude },
    });

    }, { timeout: 20000, maxWait: 20000 });
    return res.json(updated);
  } catch (err) {
    if (err instanceof DeskError) return res.status(err.status).json({ message: err.message, code: err.code });
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
      include: { user: true, space: true },
    });
    notifyAdminsOfCancellation({ role, reservation: updated });

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
