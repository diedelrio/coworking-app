require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const reservationsRoutes = require('./routes/reservations');
const officeClosuresRoutes = require('./routes/officeClosures');
const usersRoutes = require('./routes/users');
const publicRoutes = require('./routes/public');

const settingsRouter = require('./routes/settings');
const adminEmailTemplates = require('./routes/adminEmailTemplates');
const adminOperations = require('./routes/adminOperations');
const adminTags = require('./routes/adminTags');
const consentsRoutes = require('./routes/consents');
const popupMessagesRoutes = require('./routes/popupMessages');

if (!process.env.JWT_SECRET) {
  console.error('[config] Falta JWT_SECRET. Definilo en el .env antes de iniciar el servidor.');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('[config] Falta DATABASE_URL. Definila en el .env antes de iniciar el servidor.');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 4000;

// Detrás de un proxy (Render, Nginx, etc.) para que req.ip sea la IP real del cliente
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY) || 1);
app.disable('x-powered-by');

// CORS: lista separada por comas en CORS_ORIGIN. Sin definir => abierto (solo desarrollo).
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);
if (!corsOrigins.length) {
  console.warn('[config] CORS_ORIGIN no definido: se acepta cualquier origen. Definilo en producción.');
}
app.use(cors(corsOrigins.length ? { origin: corsOrigins } : undefined));

// Cabeceras de seguridad básicas
app.use((req, res, next) => {
  res.set({
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
  });
  next();
});

// Límite de body: 12 MB solo donde se suben imágenes/ficheros; 1 MB en el resto.
const BIG_BODY_PREFIXES = ['/api/spaces', '/api/admin'];
const bigJson = express.json({ limit: '12mb' });
const smallJson = express.json({ limit: '1mb' });
app.use((req, res, next) =>
  (BIG_BODY_PREFIXES.some((p) => req.path.startsWith(p)) ? bigJson : smallJson)(req, res, next)
);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/office-closures', officeClosuresRoutes);
app.use('/api/users', usersRoutes);

app.use('/api/settings', settingsRouter);
app.use('/api/admin/email-templates', adminEmailTemplates);
app.use('/api/admin/operations', adminOperations);
app.use('/api/admin/tags', adminTags);
app.use('/api', consentsRoutes);
app.use('/api', popupMessagesRoutes);

// ✅ Public routes (login/register screens)
app.use('/api/public', publicRoutes);

// ✅ Backoffice jobs
const { startAutoCompleteJob } = require('./jobs/autoCompleteReservations');
startAutoCompleteJob();

const { bootstrapMasterAdmin } = require('./utils/bootstrapAdmin');
bootstrapMasterAdmin().catch((err) => {
  console.error('[bootstrap] Failed to create master admin:', err);
});

// Errores no controlados (p.ej. JSON inválido, body demasiado grande)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') return res.status(413).json({ message: 'El contenido enviado es demasiado grande' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ message: 'JSON inválido' });
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json({ message: 'Error interno del servidor' });
});

process.on('unhandledRejection', (reason) => {
  console.error('[process] unhandledRejection:', reason);
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});
