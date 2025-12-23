// backend/src/services/reservationOccupancy.js
const prisma = require('../prisma');

/**
 * Convierte:
 * - dateStr: "YYYY-MM-DD"
 * - timeStr: "HH:MM" (o "HH:MM:SS")
 * en un Date válido (hora local).
 */
function toDateTime(dateStr, timeStr) {
  const d = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${dateStr}`);
  }

  const t = String(timeStr || '').trim();
  if (!/^\d{1,2}:\d{2}(:\d{2})?$/.test(t)) {
    throw new Error(`Invalid time format. Expected HH:MM or HH:MM:SS, got: ${timeStr}`);
  }

  const [hh, mm, ss] = t.split(':').map(Number);
  const [y, m, day] = d.split('-').map(Number);

  return new Date(y, m - 1, day, hh, mm, Number.isFinite(ss) ? ss : 0, 0);
}

/**
 * Devuelve rango del día [startOfDay, nextDay)
 * (hora local del servidor).
 */
function dayRange(dateStr) {
  const d = String(dateStr || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    throw new Error(`Invalid date format. Expected YYYY-MM-DD, got: ${dateStr}`);
  }

  const [y, m, day] = d.split('-').map(Number);
  const start = new Date(y, m - 1, day, 0, 0, 0, 0);
  const end = new Date(y, m - 1, day + 1, 0, 0, 0, 0);
  return { start, end };
}

/**
 * Cuenta reservas solapadas para un espacio en una franja horaria del día.
 *
 * Asume que en tu Prisma:
 * - Reservation.date es DateTime
 * - Reservation.startTime y endTime son DateTime
 *
 * overlap: (startTime < rangeEnd) AND (endTime > rangeStart)
 */
async function countOverlappingReservations({
  spaceId,
  date,       // "YYYY-MM-DD"
  startTime,  // "HH:MM"
  endTime,    // "HH:MM"
  excludeReservationId,
}) {
  const { start: dayStart, end: dayEnd } = dayRange(date);
  const rangeStart = toDateTime(date, startTime);
  const rangeEnd = toDateTime(date, endTime);

  // seguridad: si rango inválido
  if (rangeEnd <= rangeStart) {
    throw new Error(`Invalid time range: endTime must be > startTime (${startTime} - ${endTime})`);
  }

  const where = {
    spaceId,
    status: { in: ['ACTIVE', 'PENDING'] },
    ...(excludeReservationId ? { NOT: { id: excludeReservationId } } : {}),
    // que la reserva pertenezca al mismo día (por startTime en rango del día)
    AND: [
      { startTime: { gte: dayStart, lt: dayEnd } },
      { startTime: { lt: rangeEnd } },
      { endTime: { gt: rangeStart } },
    ],
  };

  // Usamos aggregate (compatibilidad total)
  const result = await prisma.reservation.aggregate({
    where,
    _count: { _all: true },
  });

  return result?._count?._all ?? 0;
}

module.exports = { countOverlappingReservations };
