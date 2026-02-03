const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const prisma = require('../prisma');
const { sendMail } = require('../services/emailService');
const { getEmailTemplateByKey, renderEmailTemplate } = require('../services/emailTemplateService');
const crypto = require('crypto');
const { joinFrontendUrl } = require('../utils/frontendUrl');

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

    if (user.active === false) {
      return res.status(403).json({ message: 'Tu cuenta aún no fue activada. Revisa tu email.' });
    }

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

/**
 * Activación de cuenta
 * - tokens de 60 minutos (configurable via ACTIVATE_TOKEN_TTL_MINUTES)
 * - si token expiró: frontend ofrece generar nuevo
 */

function getActivationTtlMinutes() {
  const n = Number(process.env.ACTIVATE_TOKEN_TTL_MINUTES || 60);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

async function createActivationTokenForUser(userId) {
  // invalidar tokens previos
  await prisma.activationToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + getActivationTtlMinutes() * 60 * 1000);

  await prisma.activationToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt };
}

async function sendActivationEmail({ user, token }) {
  const activationLink = joinFrontendUrl(`activate?token=${token}`);
  const ttlMinutes = getActivationTtlMinutes();

  try {
    const tpl = await getEmailTemplateByKey('CREATE_NEW_USER_BATCH');
    const { subject, body } = renderEmailTemplate(tpl, {
      name: user.name || '',
      activationLink,
      actionUrl: activationLink,
      ttlMinutes,
    });

    await sendMail({ to: user.email, subject, text: body });
  } catch (e) {
    // fallback simple
    await sendMail({
      to: user.email,
      subject: 'Activá tu cuenta',
      text: `Hola ${user.name || ''}\n\nActivá tu cuenta aquí: ${activationLink}\n\nEste link vence en ${ttlMinutes} minutos.`,
    });
  }
}

// GET /api/auth/activate/validate?token=...
router.get('/activate/validate', async (req, res) => {
  try {
    const token = typeof req.query?.token === 'string' ? req.query.token.trim() : '';
    if (!token) return res.status(400).json({ message: 'Token requerido' });

    const tokenHash = hashToken(token);
    const at = await prisma.activationToken.findFirst({
      where: { tokenHash, usedAt: null },
      include: { user: true },
    });

    if (!at || !at.user) return res.status(400).json({ message: 'Token inválido' });

    if (at.expiresAt <= new Date()) {
      return res.status(410).json({
        code: 'TOKEN_EXPIRED',
        message: 'Token expirado',
        email: at.user.email,
      });
    }

    if (at.user.active) {
      return res.json({ status: 'already_active', email: at.user.email });
    }

    return res.json({ status: 'ok', email: at.user.email, name: at.user.name });
  } catch (err) {
    console.error('ERROR GET /auth/activate/validate', err);
    return res.status(500).json({ message: 'Error validando token' });
  }
});

// POST /api/auth/activate/complete { token, password }
router.post('/activate/complete', async (req, res) => {
  try {
    const token = typeof req.body?.token === 'string' ? req.body.token.trim() : '';
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!token || !password) return res.status(400).json({ message: 'Token y contraseña son obligatorios' });
    if (password.length < 8) return res.status(400).json({ message: 'La contraseña debe tener al menos 8 caracteres' });

    const tokenHash = hashToken(token);
    const at = await prisma.activationToken.findFirst({
      where: { tokenHash, usedAt: null, expiresAt: { gt: new Date() } },
      include: { user: true },
    });

    if (!at || !at.user) {
      return res.status(400).json({ message: 'Token inválido o expirado' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    await prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: at.userId },
        data: { active: true, password: passwordHash },
      });

      await tx.activationToken.updateMany({
        where: { userId: at.userId, usedAt: null },
        data: { usedAt: new Date() },
      });
    });

    return res.json({ message: 'Cuenta activada correctamente' });
  } catch (err) {
    console.error('ERROR POST /auth/activate/complete', err);
    return res.status(500).json({ message: 'Error activando cuenta' });
  }
});

// POST /api/auth/activate/resend { email }
router.post('/activate/resend', async (req, res) => {
  try {
    const emailRaw = req.body?.email;
    const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
    if (!email) return res.status(400).json({ message: 'Email requerido' });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.json({ message: 'Si el email existe, enviaremos un nuevo enlace.' });
    }
    if (user.active) {
      return res.json({ message: 'La cuenta ya está activa. Puedes iniciar sesión.' });
    }

    const { token } = await createActivationTokenForUser(user.id);
    try {
      await sendActivationEmail({ user, token });
    } catch (mailErr) {
      console.error('ERROR sending activation email (resend)', mailErr);
    }

    return res.json({ message: 'Te enviamos un nuevo enlace de activación.' });
  } catch (err) {
    console.error('ERROR POST /auth/activate/resend', err);
    return res.status(500).json({ message: 'Error reenviando activación' });
  }
});

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
    const resetLink = joinFrontendUrl(`reset-password?token=${token}`);

    try {
      const tpl = await getEmailTemplateByKey('FORGOT_PASSWORD');

      const { subject, body } = renderEmailTemplate(tpl, {
        name: user.name || '',
        resetLink,
        actionUrl: resetLink,
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
