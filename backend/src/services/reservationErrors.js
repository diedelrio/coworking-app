// backend/src/services/reservationErrors.js
/**
 * Error tipado para validaciones de negocio de reservas.
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

module.exports = { ReservationValidationError };
