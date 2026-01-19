// backend/src/services/spaceCapacity.js

/**
 * Devuelve true si el tipo de espacio es compartido
 * (permite solapamiento controlado por attendees)
 */
function isSharedSpaceType(spaceType) {
  return spaceType === "FLEX_DESK" || spaceType === "SHARED_TABLE";
}

/**
 * Capacidad efectiva del espacio
 * - Compartidos: usan space.capacity (personas)
 * - No compartidos: capacidad fija = 1
 */
function effectiveCapacity(space) {
  if (!space || !space.type) return 1;
  return isSharedSpaceType(space.type) ? Number(space.capacity || 0) : 1;
}

module.exports = {
  isSharedSpaceType,
  effectiveCapacity,
};
