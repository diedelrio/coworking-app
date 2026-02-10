// backend/src/services/reservationValidationService.js
const prisma = require('../prisma');
const settingsService = require('./settingsService');

// Helpers de tiempo / fechas
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

/**
 * Error tipado para validaciones de negocio.
 * El router lo convierte a HTTP 400 incluyendo code + extra.
 */
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
 * ✅ Reglas default por tipo (fallback si settingsService no tiene getTypeReservationRules)
 * Ajustalas a tus valores reales.
 */
function getDefaultTypeRules(spaceType) {
  const base = {
    maxHoursPerDayPerUser: 12,
    maxHoursPerWeekPerUser: 60,
    maxOverlappingSpacesPerUser: 1,
    maxSpacesPerDayPerUser: 1,
  };

  switch (spaceType) {
    case 'MEETING_ROOM':
      return {
        ...base,
        maxHoursPerDayPerUser: 4,
        maxHoursPerWeekPerUser: 8,
        maxSpacesPerDayPerUser: 1,
      };
    case 'OFFICE_ROOM':
      return {
        ...base,
        maxHoursPerDayPerUser: 9,
        maxHoursPerWeekPerUser: 30,
        maxSpacesPerDayPerUser: 1,
      };
    case 'FIX_DESK':
    case 'FLEX_DESK':
    default:
      return base;
  }
}

/**
 * ✅ Wrapper seguro: si settingsService.getTypeReservationRules existe, se usa.
 * Si no, fallback a defaults.
 */
async function getTypeReservationRulesSafe(spaceType) {
  if (typeof settingsService.getTypeReservationRules === 'function') {
    return settingsService.getTypeReservationRules(spaceType);
  }
  return getDefaultTypeRules(spaceType);
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

  const now = new Date();

  // ✅ settingsService.getReservationSettings debe existir (si no, también podemos fallback)
  if (typeof settingsService.getReservationSettings !== 'function') {
    throw new ReservationValidationError(
      'No se pudo cargar la configuración de reservas (getReservationSettings)',
      'SETTINGS_MISSING'
    );
  }

  const { min_hours_before } = await settingsService.getReservationSettings();

  const diffHours = (startDateTime - now) / MS_PER_HOUR;
  if (diffHours < min_hours_before) {
    throw new ReservationValidationError(
      `Debes reservar con al menos ${min_hours_before} horas de antelación`,
      'MIN_HOURS_BEFORE_EXCEEDED',
      { minHoursBefore: min_hours_before }
    );
  }

  // --- Cargamos el espacio para conocer su tipo ---
  const space = await prisma.space.findUnique({
    where: { id: Number(spaceId) },
  });

  if (!space || !space.active) {
    throw new ReservationValidationError('El espacio no existe o está inactivo');
  }

  const typeRules = await getTypeReservationRulesSafe(space.type);

  const newReservationHours = getReservationDurationHours(startDateTime, endDateTime);

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
    include: {
      space: true,
    },
  });

  const usedDayHours = dayReservations.reduce(
    (sum, r) => sum + getReservationDurationHours(r.startTime, r.endTime),
    0
  );
  console.log('usedDayHours:', usedDayHours);
  console.log('newReservationHours:', newReservationHours);
  console.log('typeRules.maxHoursPerDayPerUser:', typeRules.maxHoursPerDayPerUser);
  
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
    include: {
      space: true,
    },
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
      space: {
        type: space.type,
      },
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
  const overlappingFilter = reservationIdToExclude ? { id: { not: reservationIdToExclude } } : {};

  const overlapping = await prisma.reservation.findFirst({
    where: {
      ...overlappingFilter,
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

module.exports = {
  ReservationValidationError,
  validateAndBuildReservation,
  getTypeReservationRules: getTypeReservationRulesSafe, // opcional pero seguro
};
