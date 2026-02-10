// backend/src/utils/reservationTimeValidator.js
const { getReservationRules } = require('../services/settingsService');
const { getPartsInTZ, TZ } = require('./timezone');

// ✅ minutos desde medianoche pero en Europe/Madrid (NO depende del TZ del server)
function minutesSinceMidnightMadrid(date) {
  const p = getPartsInTZ(date, TZ);
  return p.hour * 60 + p.minute;
}

function buildRuleError(code, message) {
  const err = new Error(message);
  err.status = 400;
  err.code = code;
  return err;
}

async function validateReservationTimes({ startTime, endTime }) {
  const { openHour, closeHour, minMinutes, stepMinutes } = await getReservationRules();

  const start = new Date(startTime);
  const end = new Date(endTime);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    throw buildRuleError('INVALID_DATETIME', 'Fecha u hora inválida.');
  }

  if (end <= start) {
    throw buildRuleError('END_BEFORE_START', 'La hora de fin debe ser posterior a la hora de inicio.');
  }

  // ✅ Step validado en hora Madrid (no en TZ del server)
  const startP = getPartsInTZ(start, TZ);
  const endP = getPartsInTZ(end, TZ);

  if (startP.minute % stepMinutes !== 0 || endP.minute % stepMinutes !== 0) {
    throw buildRuleError(
      'INVALID_STEP',
      `Las reservas deben comenzar y terminar en intervalos de ${stepMinutes} minutos (ej: 10:00, 10:30).`
    );
  }

  // Horario oficina (configurado como horas Madrid)
  const openMin = Number(openHour) * 60;
  const closeMin = Number(closeHour) * 60;

  const startMin = minutesSinceMidnightMadrid(start);
  const endMin = minutesSinceMidnightMadrid(end);

  if (startMin < openMin || endMin > closeMin) {
    throw buildRuleError(
      'OUT_OF_OPENING_HOURS',
      `El horario de reservas es de ${String(openHour).padStart(2, '0')}:00 a ${String(closeHour).padStart(2, '0')}:00.`
    );
  }

  const durationMin = Math.round((end - start) / 60000);

  if (durationMin < minMinutes) {
    throw buildRuleError('MIN_DURATION', `La reserva debe durar al menos ${minMinutes / 60} hora(s).`);
  }

  if (durationMin % stepMinutes !== 0) {
    throw buildRuleError(
      'INVALID_DURATION',
      `La duración debe ser múltiplo de ${stepMinutes} minutos (1:00, 1:30, 2:00...).`
    );
  }

  return true;
}

module.exports = { validateReservationTimes };
