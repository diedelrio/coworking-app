// backend/src/services/reservationValidationService.js
// Reglas de reserva por tipo de espacio.
// (La validación completa de una reserva vive en routes/reservations.js: validateAndBuildReservation.)
const settingsService = require('./settingsService');

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

  const rules = getDefaultTypeRules(spaceType);

  // Overrides opcionales desde Settings (si existen y son números válidos), p.ej.:
  // MAX_HOURS_PER_DAY_MEETING_ROOM, MAX_HOURS_PER_WEEK_MEETING_ROOM,
  // MAX_OVERLAPPING_SPACES_MEETING_ROOM, MAX_SPACES_PER_DAY_MEETING_ROOM
  const overrides = {
    maxHoursPerDayPerUser: `MAX_HOURS_PER_DAY_${spaceType}`,
    maxHoursPerWeekPerUser: `MAX_HOURS_PER_WEEK_${spaceType}`,
    maxOverlappingSpacesPerUser: `MAX_OVERLAPPING_SPACES_${spaceType}`,
    maxSpacesPerDayPerUser: `MAX_SPACES_PER_DAY_${spaceType}`,
  };
  const settings = await settingsService.getActiveSettingsMap(Object.values(overrides));
  for (const [field, key] of Object.entries(overrides)) {
    const n = Number(settings[key]?.value);
    if (settings[key] && Number.isFinite(n) && n >= 0) rules[field] = n;
  }
  return rules;
}

module.exports = {
  getTypeReservationRules: getTypeReservationRulesSafe,
};
