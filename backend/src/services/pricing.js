// backend/src/services/pricing.js
// Utilidades para calcular duración y total de una reserva,
// manteniendo consistencia entre CREATE y UPDATE.
//
// Reglas:
// - startTime y endTime vienen como "HH:MM" (24h)
// - endTime debe ser > startTime (mismo día)
// - total = hourlyRate * (durationMinutes / 60) * multiplier
//   - multiplier = attendees si shared=true, sino 1
// - redondeo a 2 decimales

const { Prisma } = require("@prisma/client");

/**
 * Convierte "HH:MM" a minutos desde 00:00
 */
function hhmmToMinutes(hhmm) {
  if (typeof hhmm !== "string") throw new Error("Time must be a string HH:MM");
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) throw new Error(`Invalid time format "${hhmm}" (expected HH:MM)`);
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (Number.isNaN(h) || Number.isNaN(min)) throw new Error(`Invalid time "${hhmm}"`);
  if (h < 0 || h > 23) throw new Error(`Invalid hour in "${hhmm}"`);
  if (min < 0 || min > 59) throw new Error(`Invalid minutes in "${hhmm}"`);
  return h * 60 + min;
}

/**
 * Calcula minutos de duración entre start y end.
 * Lanza error si end <= start.
 */
function calcDurationMinutes(startTime, endTime) {
  const start = hhmmToMinutes(startTime);
  const end = hhmmToMinutes(endTime);
  const diff = end - start;

  if (diff <= 0) {
    throw new Error("End time must be after start time");
  }
  return diff;
}

/**
 * Redondeo seguro a 2 decimales usando Decimal de Prisma.
 * Devuelve Prisma.Decimal
 */
function roundMoneyDecimal(decimal) {
  const d = new Prisma.Decimal(decimal || 0);
  return new Prisma.Decimal(d.toFixed(2));
}

/**
 * Calcula total en base a hourlyRate (Decimal|number|string),
 * duración en minutos (int) y multiplier (attendees o 1).
 * Devuelve Prisma.Decimal con 2 decimales.
 */
function calcTotalAmount(hourlyRate, durationMinutes, multiplier = 1) {
  const mins = Number(durationMinutes || 0);
  if (!Number.isFinite(mins) || mins <= 0) {
    return new Prisma.Decimal("0.00");
  }

  const multNum = Number(multiplier ?? 1);
  const safeMult = Number.isFinite(multNum) && multNum > 0 ? multNum : 1;

  const rate = new Prisma.Decimal(hourlyRate || 0);
  const hours = new Prisma.Decimal(mins).div(60);
  const total = rate.mul(hours).mul(new Prisma.Decimal(safeMult));

  return roundMoneyDecimal(total);
}

/**
 * Calcula un "pricing snapshot" consistente para guardar en Reservation.
 *
 * - Si hourlyRateSnapshot no viene, usa spaceHourlyRate.
 * - Siempre recalcula durationMinutes y totalAmount.
 * - Si shared=true, total se multiplica por attendees (>=1).
 *
 * Params:
 *  - startTime: "HH:MM"
 *  - endTime: "HH:MM"
 *  - spaceHourlyRate: Decimal|number|string (CREATE)
 *  - hourlyRateSnapshot: Decimal|number|string (EDIT)
 *  - shared: boolean (si el espacio es compartido)
 *  - attendees: number (cantidad de personas/cupos)
 */
function buildPricingSnapshot({
  startTime,
  endTime,
  spaceHourlyRate,
  hourlyRateSnapshot, // para EDIT: usar el snapshot existente
  shared = false,
  attendees = 1,
}) {
  const durationMinutes = calcDurationMinutes(startTime, endTime);

  const rateToUse =
    hourlyRateSnapshot !== undefined && hourlyRateSnapshot !== null
      ? hourlyRateSnapshot
      : spaceHourlyRate;

  const multiplier = shared ? Math.max(1, Number(attendees || 1)) : 1;

  const totalAmount = calcTotalAmount(rateToUse, durationMinutes, multiplier);

  return {
    hourlyRateSnapshot: roundMoneyDecimal(rateToUse),
    durationMinutes,
    totalAmount,
  };
}

module.exports = {
  hhmmToMinutes,
  calcDurationMinutes,
  calcTotalAmount,
  buildPricingSnapshot,
  roundMoneyDecimal,
};
