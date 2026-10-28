// backend/src/services/recurrence.js
// Generación de fechas para reservas recurrentes (DAILY | WEEKLY | MONTHLY).
const crypto = require('crypto');
const { ReservationValidationError } = require('./reservationErrors');
const { utcToMadridYMD, madridDateYMDToUtcMidnight } = require('../utils/timezone');

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
  for (let i = 0; i < 101; i++) {
    if (endDate && current > endDate) break;
    out.push(new Date(current));
    if (out.length > 100) {
      throw new ReservationValidationError('La recurrencia no puede generar más de 100 reservas. Acortá la fecha de fin.', 'INVALID_RECURRENCE');
    }
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


async function buildOccurrenceDates({ date, isRecurring, pattern, recurrenceEndDate, recurrenceCount, db }) {
  db = db || require('../prisma'); // carga perezosa: permite testear las funciones puras sin Prisma
  const hasEndDate = Boolean(recurrenceEndDate);
  const hasCount = recurrenceCount != null;
  if (isRecurring && (!['DAILY', 'WEEKLY', 'MONTHLY'].includes(pattern) || hasEndDate === hasCount)) {
    throw new ReservationValidationError('Indicá un patrón válido y una sola regla de fin.', 'INVALID_RECURRENCE');
  }
  if (hasCount && (!Number.isInteger(recurrenceCount) || recurrenceCount < 1 || recurrenceCount > 100)) throw new ReservationValidationError('La cantidad debe ser un entero entre 1 y 100.', 'INVALID_RECURRENCE');
  if (hasEndDate && (!/^\d{4}-\d{2}-\d{2}$/.test(recurrenceEndDate) || recurrenceEndDate < date)) throw new ReservationValidationError('La fecha final debe ser igual o posterior al inicio.', 'INVALID_RECURRENCE');
    // ---- Ocurrencias (con ajuste de feriados/cierres para MONTHLY) ----
    let occurrenceDates;

    if (!isRecurring) {
      occurrenceDates = [new Date(`${date}T00:00:00`)];
    } else if (pattern !== 'MONTHLY') {
      // DAILY: excluir cierres/feriados (OfficeClosure)
      let closedYMDSet = null;
      if (pattern === 'DAILY') {
        const startDate = new Date(`${date}T00:00:00`);
        let rangeEnd;
        if (hasEndDate) rangeEnd = new Date(`${recurrenceEndDate}T00:00:00`);
        else if (hasCount) {
          // aprox: count días hábiles pueden estirarse por finde/cierres; damos margen
          rangeEnd = addDays(startDate, Math.max(0, Number(recurrenceCount) - 1) + 60);
        } else {
          rangeEnd = addDays(startDate, 120);
        }

        // Los cierres se guardan como medianoche Madrid (en UTC); ampliamos 1 día cada lado
        // y comparamos por fecha Madrid para no depender de la TZ del servidor.
        const closures = await db.officeClosure.findMany({
          where: {
            active: true,
            date: {
              gte: madridDateYMDToUtcMidnight(toDateOnlyYMD(addDays(startDate, -1))),
              lte: madridDateYMDToUtcMidnight(toDateOnlyYMD(addDays(rangeEnd, 1))),
            },
          },
          select: { date: true },
        });

        closedYMDSet = new Set(closures.map((c) => utcToMadridYMD(c.date)));
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

      const closures = db.officeClosure
        ? await db.officeClosure.findMany({
            where: {
              active: true,
              date: {
                gte: madridDateYMDToUtcMidnight(toDateOnlyYMD(addDays(startDate, -1))),
                lte: madridDateYMDToUtcMidnight(toDateOnlyYMD(addDays(rangeEnd, 1))),
              },
            },
            select: { date: true },
          })
        : [];

      const closedYMDSet = new Set(closures.map((c) => utcToMadridYMD(c.date)));

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


  if (!occurrenceDates.length) throw new ReservationValidationError('La regla no genera fechas de reserva.', 'INVALID_RECURRENCE');
  return occurrenceDates;
}

module.exports = {
  safeRandomId,
  toDateOnlyYMD,
  addDays,
  addMonthsSameDay,
  isoWeekday,
  isWeekend,
  generateOccurrenceDates,
  addMonthsMonthlyBusinessWeekday,
  buildOccurrenceDates,
};
