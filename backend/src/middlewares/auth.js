const jwt = require('jsonwebtoken');

function authRequired(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: 'No autorizado' });

  const [, token] = authHeader.split(' ');

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Token inválido o expirado' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ message: 'Solo admins' });
  }
  next();
}

module.exports = { authRequired, requireAdmin };
