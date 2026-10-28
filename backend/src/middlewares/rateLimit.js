// backend/src/middlewares/rateLimit.js
// Limitador simple en memoria (ventana fija). Suficiente para una sola instancia;
// con varias instancias conviene moverlo a Redis o al proxy.

function rateLimit({ windowMs, max, keyFn, message = 'Demasiados intentos. Intentá de nuevo más tarde.' }) {
  const hits = new Map();

  // Limpieza periódica para que el Map no crezca sin límite
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [k, v] of hits) if (v.resetAt <= now) hits.delete(k);
  }, Math.max(windowMs, 60_000));
  if (typeof timer.unref === 'function') timer.unref();

  return (req, res, next) => {
    const key = keyFn ? keyFn(req) : req.ip;
    const now = Date.now();
    let entry = hits.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      hits.set(key, entry);
    }
    entry.count += 1;

    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return res.status(429).json({ message });
    }
    next();
  };
}

// IP + email (si viene) para no bloquear a toda una oficina por un solo usuario
const byIpAndEmail = (req) =>
  `${req.ip}|${String(req.body?.email || '').toLowerCase().trim()}`;

const loginLimiter = rateLimit({ windowMs: 15 * 60_000, max: 10, keyFn: byIpAndEmail });
const sensitiveLimiter = rateLimit({ windowMs: 60 * 60_000, max: 10, keyFn: byIpAndEmail });

module.exports = { rateLimit, loginLimiter, sensitiveLimiter };
