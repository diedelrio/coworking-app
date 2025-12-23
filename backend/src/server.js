require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const reservationsRoutes = require('./routes/reservations');
const usersRoutes = require('./routes/users');
const publicRoutes = require('./routes/public');

const settingsRouter = require('./routes/settings');
const adminEmailTemplates = require('./routes/adminEmailTemplates');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/auth', authRoutes);
app.use('/api/spaces', spacesRoutes);
app.use('/api/reservations', reservationsRoutes);
app.use('/api/users', usersRoutes); 
app.use('/api/settings', settingsRouter);
app.use('/api/admin/email-templates', adminEmailTemplates);
app.use('/api/public', publicRoutes);


const { bootstrapMasterAdmin } = require("./utils/bootstrapAdmin");

bootstrapMasterAdmin().catch((err) => {
  console.error("[bootstrap] Failed to create master admin:", err);
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});

