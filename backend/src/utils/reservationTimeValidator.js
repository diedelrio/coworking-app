const { getReservationRules } = require('../services/settingsService');

function minutesSinceMidnight(date) {
  return date.getHours() * 60 + date.getMinutes();
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

  // Step (30 min)
  if (start.getMinutes() % stepMinutes !== 0 || end.getMinutes() % stepMinutes !== 0) {
    throw buildRuleError(
      'INVALID_STEP',
      `Las reservas deben comenzar y terminar en intervalos de ${stepMinutes} minutos (ej: 10:00, 10:30).`
    );
  }

  // Horario oficina
  const openMin = openHour * 60;
  const closeMin = closeHour * 60;

  const startMin = minutesSinceMidnight(start);
  const endMin = minutesSinceMidnight(end);

  if (startMin < openMin || endMin > closeMin) {
    throw buildRuleError(
      'OUT_OF_OPENING_HOURS',
      `El horario de reservas es de ${String(openHour).padStart(2, '0')}:00 a ${String(closeHour).padStart(2, '0')}:00.`
    );
  }

  const durationMin = Math.round((end - start) / 60000);

  // Min 1h
  if (durationMin < minMinutes) {
    throw buildRuleError('MIN_DURATION', `La reserva debe durar al menos ${minMinutes / 60} hora(s).`);
  }

  // múltiplos de step
  if (durationMin % stepMinutes !== 0) {
    throw buildRuleError(
      'INVALID_DURATION',
      `La duración debe ser múltiplo de ${stepMinutes} minutos (1:00, 1:30, 2:00...).`
    );
  }

  return true;
}

module.exports = { validateReservationTimes };
