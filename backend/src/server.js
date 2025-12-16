require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const spacesRoutes = require('./routes/spaces');
const reservationsRoutes = require('./routes/reservations');
const usersRoutes = require('./routes/users');

const settingsRouter = require('./routes/settings');

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

const { bootstrapMasterAdmin } = require("./utils/bootstrapAdmin");

bootstrapMasterAdmin().catch((err) => {
  console.error("[bootstrap] Failed to create master admin:", err);
});

app.listen(PORT, () => {
  console.log(`API escuchando en http://localhost:${PORT}`);
});

