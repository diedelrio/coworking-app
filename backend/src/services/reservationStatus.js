// backend/src/services/reservationStatus.js

function normalize(v) {
  const s = String(v ?? '').trim();
  return s ? s.toUpperCase() : '';
}

/**
 * Dado un objeto user, intenta obtener su "classify" sin asumir el nombre del campo.
 * Soporta: classify | classification | segment | tier
 */
function getUserClassify(user) {
  if (!user) return '';
  return normalize(user.classify ?? user.classification ?? user.segment ?? user.tier ?? '');
}

/**
 * Regla de negocio:
 * - Si el actor (req.user) es ADMIN => ACTIVE
 * - Si actor NO es ADMIN:
 *    - si classify vacío o REGULAR => PENDING
 *    - si no => ACTIVE
 */
function computeReservationStatus({ actorRole, user }) {
  const role = normalize(actorRole);
  const classify = getUserClassify(user);

  if (role === 'ADMIN') return 'ACTIVE';
  if (!classify || classify === 'REGULAR') return 'PENDING';
  return 'ACTIVE';
}

module.exports = { computeReservationStatus, getUserClassify };
