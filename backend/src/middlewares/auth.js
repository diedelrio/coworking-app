const jwt = require('jsonwebtoken');
const prisma = require('../prisma');

// Un token vale 8 h: sin esta comprobación, un usuario desactivado seguiría operando.
const ACTIVE_TTL_MS = 60_000;
const activeCache = new Map(); // userId -> { active, ts }

async function isUserActive(userId) {
  const cached = activeCache.get(userId);
  if (cached && Date.now() - cached.ts < ACTIVE_TTL_MS) return cached.active;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { active: true } });
  const active = Boolean(user) && user.active !== false;
  activeCache.set(userId, { active, ts: Date.now() });
  return active;
}

function invalidateUserActiveCache(userId) {
  if (userId == null) activeCache.clear();
  else activeCache.delete(Number(userId));
}

async function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No autorizado' });

  const [, token] = authHeader.split(' ');

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }

  try {
    const userId = payload.userId ?? payload.id;
    if (userId != null && !(await isUserActive(Number(userId)))) {
      return res.status(401).json({ message: 'Tu cuenta está desactivada' });
    }
  } catch (err) {
    console.error('[auth] No se pudo comprobar el estado del usuario:', err);
    return res.status(503).json({ message: 'Servicio no disponible, intentá de nuevo' });
  }

  req.user = payload;
  next();
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Solo admins' });
  }
  next();
}

module.exports = { authRequired, requireAdmin, invalidateUserActiveCache };
