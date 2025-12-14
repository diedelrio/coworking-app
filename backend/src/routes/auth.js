const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { sendMail } = require('../services/emailService');
const { getEmailTemplateByKey, renderEmailTemplate } = require('../services/emailTemplateService');
const crypto = require('crypto');

const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, lastName, phone, email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son obligatorios' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(400).json({ message: 'El email ya está registrado' });
    }

    const hashed = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        lastName,
        phone,
        email,
        password: hashed,
        // rol CLIENT es por defecto
      },
    });

    res.status(201).json({ message: 'Usuario creado', user: { id: user.id, email: user.email } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(400).json({ message: 'Credenciales inválidas' });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ message: 'Credenciales inválidas' });

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Error en el servidor' });
  }
});

// helper: hash del token para guardar en DB (no guardamos token plano)
function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

// helper: respuesta genérica para evitar enumeración de emails
function genericForgotResponse(res) {
  return res.json({
    message:
      'Si el email existe, te enviaremos instrucciones para restablecer tu contraseña.',
  });
}

/**
 * POST /api/auth/forgot-password
 * Body: { email }
 */
router.post('/forgot-password', async (req, res) => {
  try {
    const emailRaw = req.body?.email;
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';

    if (!email) return genericForgotResponse(res);

    const user = await prisma.user.findUnique({ where: { email } });

    // Siempre respondemos igual (aunque no exista) para no filtrar usuarios
    if (!user || user.active === false) return genericForgotResponse(res);

    // invalidar tokens previos (opcional, recomendado)
    await prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const token = crypto.randomBytes(32).toString('hex'); // token "plano" (solo para el link)
    const tokenHash = hashToken(token);

    const ttlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60);
    const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

    await prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    });

    // Link al frontend
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    try {
      const tpl = await getEmailTemplateByKey('FORGOT_PASSWORD');

      const { subject, body } = renderEmailTemplate(tpl, {
        name: user.name || '',
        resetLink,
        ttlMinutes,
      });

      await sendMail({
        to: user.email,
        subject,
        text: body,
      });
    } catch (mailErr) {
      console.error('ERROR sending forgot-password email', mailErr);
      // Importante: no rompemos el flujo, devolvemos respuesta genérica igual
    }

    return genericForgotResponse(res);
  } catch (err) {
    console.error('ERROR POST /auth/forgot-password', err);
    return genericForgotResponse(res);
  }
});

/**
 * POST /api/auth/reset-password
 * Body: { token, password }
 */
router.post('/reset-password', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!token || !password) {
      return res.status(400).json({ message: 'Token y contraseña son obligatorios' });
    }

    if (password.length < 8) {
      return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const tokenHash = hashToken(token);

    const reset = await prisma.passwordResetToken.findFirst({
      where: {
        tokenHash,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      include: { user: true },
    });

    if (!reset) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: reset.userId },
        data: { password: passwordHash },
      });

      // Invalida todos los tokens activos del usuario (incluye el actual)
      await tx.passwordResetToken.updateMany({
        where: { userId: reset.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    // Datos “desde dónde”
    const userAgent = req.headers['user-agent'] || 'N/D';
    const ip =
      (req.headers['x-forwarded-for']?.toString().split(',')[0] || '').trim() ||
      req.ip ||
      'N/D';

    const dateTime = new Date().toLocaleString('es-ES');

    // ✅ Enviar email de control: PASSWORD_CHANGED
    try {
      const tpl = await getEmailTemplateByKey('PASSWORD_CHANGED');

      const { subject, body } = renderEmailTemplate(tpl, {
        name: reset.user.name || '',
        dateTime,
        ip,
        userAgent,
      });

      await sendMail({
        to: reset.user.email,
        subject,
        text: body,
      });
    } catch (mailErr) {
      console.error('ERROR sending password-changed email', mailErr);
      // no rompemos el reset si el mail falla
    }

    return res.json({ message: 'Contraseña actualizada correctamente' });
  } catch (err) {
    console.error('ERROR POST /auth/reset-password', err);
    return res.status(500).json({ message: 'Error al restablecer contraseña' });
  }
});


module.exports = router;
