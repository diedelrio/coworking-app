// backend/src/services/spaceCapacity.js

function isSharedSpaceType(spaceType) {
  const t = String(spaceType || '').toUpperCase();
  return t === 'FLEX' || t === 'SHARED_TABLE';
}

function effectiveCapacity(space) {
  const t = String(space?.type || '').toUpperCase();

  // Tipos unitarios: cualquier reserva ocupa todo
  if (t === 'MEETING' || t === 'OFFICE' || t === 'FIX') return 1;

  // Compartidos: usar capacity real (mínimo 1)
  const cap = Number(space?.capacity);
  return Number.isFinite(cap) && cap > 0 ? cap : 1;
}

module.exports = { isSharedSpaceType, effectiveCapacity };
