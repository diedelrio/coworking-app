const express = require('express');
const prisma = require('../prisma');
const { authRequired, requireAdmin } = require('../middlewares/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendMail } = require('../services/emailService');
const { getEmailTemplateByKey, renderEmailTemplate } = require('../services/emailTemplateService');
const { parseDelimitedText } = require('../utils/delimitedParser');
const { joinFrontendUrl } = require('../utils/frontendUrl');

const router = express.Router();
function slugify(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

async function getOrCreateTagBySlug({ slug, name }) {
  const cleanSlug = slugify(slug);
  if (!cleanSlug) return null;

  const existing = await prisma.tag.findUnique({ where: { slug: cleanSlug } });
  if (existing) return existing;

  return prisma.tag.create({
    data: {
      slug: cleanSlug,
      name: String(name || cleanSlug),
    },
  });
}


function parseMaybeInt(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseEndBefore(query) {
  if (query.endBefore) {
    const d = new Date(query.endBefore);
    if (!Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

/**
 * RF-OPER-01
 * GET /api/admin/operations/complete-preview
 * Preview de reservas ACTIVE que deberían pasar a COMPLETED (endTime <= endBefore)
 */
router.get('/complete-preview', authRequired, requireAdmin, async (req, res) => {
  try {
    const endBefore = parseEndBefore(req.query);
    const userId = parseMaybeInt(req.query.userId);
    const spaceId = parseMaybeInt(req.query.spaceId);

    const where = {
      status: 'ACTIVE',
      endTime: { lte: endBefore },
      ...(userId ? { userId } : {}),
      ...(spaceId ? { spaceId } : {}),
    };

    const [count, rows] = await Promise.all([
      prisma.reservation.count({ where }),
      prisma.reservation.findMany({
        where,
        orderBy: { endTime: 'asc' },
        take: 50,
        include: {
          user: { select: { id: true, name: true, lastName: true, email: true } },
          space: { select: { id: true, name: true, type: true } },
        },
      }),
    ]);

    return res.json({
      count,
      sample: rows,
      endBefore,
      note: count > rows.length ? `Mostrando 50 de ${count}` : null,
    });
  } catch (err) {
    console.error('complete-preview error:', err);
    return res.status(500).json({ message: 'Error generando preview de reservas' });
  }
});

/**
 * RF-OPER-02
 * GET /api/admin/operations/liquidations/eligible-users
 * Usuarios elegibles: role CLIENT + al menos 1 reserva facturable (COMPLETED/PENALIZED) sin liquidationItem
 */
router.get('/liquidations/eligible-users', authRequired, requireAdmin, async (req, res) => {
  try {
    const rows = await prisma.user.findMany({
      where: {
        role: 'CLIENT',
        active: true,
        reservations: {
          some: {
            status: { in: ['COMPLETED', 'PENALIZED'] },
            liquidationItem: { is: null },
          },
        },
      },
      select: { id: true, name: true, lastName: true, email: true, role: true, active: true },
      orderBy: [{ name: 'asc' }, { lastName: 'asc' }],
    });

    return res.json(rows);
  } catch (err) {
    console.error('eligible-users error:', err);
    return res.status(500).json({ message: 'Error cargando usuarios elegibles para facturación' });
  }
});

/**
 * RF-OPER-02
 * GET /api/admin/operations/liquidations/preview
 * Preview de reservas a facturar (COMPLETED/PENALIZED) sin liquidación.
 * Query: ?userId=number (opcional)
 */
router.get('/liquidations/preview', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = parseMaybeInt(req.query.userId);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ['COMPLETED', 'PENALIZED'] },
        ...(userId ? { userId } : {}),
        liquidationItem: { is: null },
      },
      orderBy: { endTime: 'asc' },
      include: {
        user: { select: { id: true, name: true, lastName: true, email: true } },
        space: { select: { id: true, name: true, type: true } },
      },
    });

    if (!reservations.length) {
      return res.json({ count: 0, totalAmount: 0, byUser: [] });
    }

    const map = new Map();
    for (const r of reservations) {
      const key = r.userId;
      if (!map.has(key)) {
        map.set(key, {
          user: r.user,
          count: 0,
          total: 0,
          reservations: [],
        });
      }
      const g = map.get(key);
      g.count += 1;
      g.total += Number(r.totalAmount ?? 0);
      g.reservations.push({
        id: r.id,
        endTime: r.endTime,
        status: r.status,
        totalAmount: r.totalAmount,
        space: r.space,
      });
    }

    const totalAmount = reservations.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);

    return res.json({
      count: reservations.length,
      totalAmount,
      byUser: Array.from(map.values()),
    });
  } catch (err) {
    console.error('liquidations/preview error:', err);
    return res.status(500).json({ message: 'Error generando preview de facturación' });
  }
});


/**
 * RF-OPER-01
 * POST /api/admin/operations/complete-execute
 * Ejecuta el cambio a COMPLETED.
 * Body:
 *  - ids: number[] (opcional)
 *  - userId?, spaceId?, endBefore? (opcionales, si no hay ids)
 */
router.post('/complete-execute', authRequired, requireAdmin, async (req, res) => {
  try {
    const { ids } = req.body || {};

    let where = {
      status: 'ACTIVE',
      endTime: { lte: new Date() },
    };

    if (Array.isArray(ids) && ids.length) {
      where = { ...where, id: { in: ids.map(Number).filter(Number.isFinite) } };
    } else {
      const endBefore = req.body?.endBefore ? new Date(req.body.endBefore) : new Date();
      const userId = parseMaybeInt(req.body?.userId);
      const spaceId = parseMaybeInt(req.body?.spaceId);
      where = {
        ...where,
        endTime: { lte: Number.isNaN(endBefore.getTime()) ? new Date() : endBefore },
        ...(userId ? { userId } : {}),
        ...(spaceId ? { spaceId } : {}),
      };
    }

    const result = await prisma.reservation.updateMany({
      where,
      data: { status: 'COMPLETED' },
    });

    return res.json({ updated: result.count ?? 0 });
  } catch (err) {
    console.error('complete-execute error:', err);
    return res.status(500).json({ message: 'Error ejecutando proceso de completado' });
  }
});

/**
 * RF-OPER-02
 * POST /api/admin/operations/liquidations/generate
 * Genera liquidaciones para reservas COMPLETED/PENALIZED sin liquidación.
 * Body: { userId?: number }
 */
router.post('/liquidations/generate', authRequired, requireAdmin, async (req, res) => {
  try {
    const userId = parseMaybeInt(req.body?.userId);

    const reservations = await prisma.reservation.findMany({
      where: {
        status: { in: ['COMPLETED', 'PENALIZED'] },
        ...(userId ? { userId } : {}),
        liquidationItem: { is: null },
      },
      orderBy: { endTime: 'asc' },
      include: {
        user: { select: { id: true, name: true, lastName: true, email: true } },
      },
    });

    if (!reservations.length) {
      return res.json({ createdLiquidations: 0, createdItems: 0, message: 'No hay reservas pendientes de facturación.' });
    }

    const byUser = new Map();
    for (const r of reservations) {
      if (!byUser.has(r.userId)) byUser.set(r.userId, []);
      byUser.get(r.userId).push(r);
    }

    const created = await prisma.$transaction(async (tx) => {
      let createdLiquidations = 0;
      let createdItems = 0;
      let updatedReservations = 0;

      for (const [uid, rows] of byUser.entries()) {
        const total = rows.reduce((acc, r) => acc + Number(r.totalAmount ?? 0), 0);

        const fromDate = rows[0]?.endTime ?? null;
        const toDate = rows[rows.length - 1]?.endTime ?? null;

        const liquidation = await tx.liquidation.create({
          data: {
            userId: uid,
            status: 'DRAFT',
            totalAmount: total,
            fromDate,
            toDate,
          },
        });
        createdLiquidations += 1;

        for (const r of rows) {
          await tx.liquidationItem.create({
            data: {
              liquidationId: liquidation.id,
              reservationId: r.id,
              amount: r.totalAmount,
            },
          });
          createdItems += 1;
        }

        // ✅ Al generar la liquidación, marcamos automáticamente como facturadas (INVOICED)
        const upd = await tx.reservation.updateMany({
          where: {
            id: { in: rows.map((r) => r.id) },
            status: { in: ['COMPLETED', 'PENALIZED'] },
          },
          data: { status: 'INVOICED' },
        });
        updatedReservations += upd.count ?? 0;
      }

      return { createdLiquidations, createdItems, updatedReservations };
    });

    return res.json({ ...created });
  } catch (err) {
    console.error('liquidations/generate error:', err);
    return res.status(500).json({ message: 'Error generando liquidaciones' });
  }
});

// -----------------------------
// Alta masiva de usuarios (Batch)
// -----------------------------

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function normalizeEmail(e) {
  return typeof e === 'string' ? e.trim().toLowerCase() : '';
}

function getActivationTtlMinutes() {
  const n = Number(process.env.ACTIVATE_TOKEN_TTL_MINUTES || 60);
  return Number.isFinite(n) && n > 0 ? n : 60;
}

async function createActivationTokenForUser(userId) {
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
    const { subject, body } = renderEmailTemplate(tpl, { name: user.name || '', activationLink, actionUrl: activationLink, ttlMinutes });
    await sendMail({ to: user.email, subject, text: body });
  } catch (e) {
    await sendMail({
      to: user.email,
      subject: 'Activá tu cuenta',
      text: `Hola ${user.name || ''}\n\nActivá tu cuenta aquí: ${activationLink}\n\nEste link vence en ${ttlMinutes} minutos.`,
    });
  }
}

function normalizeUserRow(raw) {
  const name = (raw.name || raw.nombre || '').trim();
  const lastName = (raw.lastname || raw.apellido || raw['last_name'] || '').trim();
  const email = normalizeEmail(raw.email || raw.mail);
  const phone = (raw.phone || raw.telefono || raw.tel || '').trim() || null;
  const roleRaw = String(raw.role || '').trim().toUpperCase();
  const role = roleRaw === 'ADMIN' ? 'ADMIN' : 'CLIENT';

  return { name, lastName, email, phone, role };
}

function validateUserRow(model) {
  const errors = [];
  if (!model.name) errors.push('name requerido');
  if (!model.lastName) errors.push('lastname requerido');
  if (!model.email) errors.push('email requerido');
  if (model.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(model.email)) errors.push('email inválido');
  if (model.role !== 'CLIENT') errors.push('role no permitido (solo CLIENT)');
  return errors;
}

/**
 * POST /api/admin/operations/users-batch/preview
 * Body: { fileName, content }
 */
router.post('/users-batch/preview', authRequired, requireAdmin, async (req, res) => {
  try {
    const fileName = typeof req.body?.fileName === 'string' ? req.body.fileName : null;
    const content = typeof req.body?.content === 'string' ? req.body.content : '';

    const parsed = parseDelimitedText(content);
    if (parsed.error) return res.status(400).json({ message: parsed.error });

    const { separator, headers, rows } = parsed;

    const validRows = [];
    const invalidRows = [];

    const seenEmails = new Set();
    for (const r of rows) {
      const model = normalizeUserRow(r.raw);
      const errors = validateUserRow(model);

      if (model.email) {
        if (seenEmails.has(model.email)) errors.push('email duplicado en archivo');
        else seenEmails.add(model.email);
      }

      if (errors.length) {
        invalidRows.push({ rowNumber: r.rowNumber, raw: r.raw, normalized: model, errors });
      } else {
        validRows.push({ rowNumber: r.rowNumber, raw: r.raw, normalized: model });
      }
    }

    return res.json({
      fileMeta: { fileName, separator, headers, total: rows.length },
      validRows,
      invalidRows,
    });
  } catch (err) {
    console.error('users-batch/preview error:', err);
    return res.status(500).json({ message: 'Error generando preview' });
  }
});

/**
 * POST /api/admin/operations/users-batch/execute
 * Body: { fileMeta, validRows, options }
 */
router.post('/users-batch/execute', authRequired, requireAdmin, async (req, res) => {
  const adminUserId = req.user?.userId;
  if (!adminUserId) return res.status(401).json({ message: 'No autorizado' });

  const fileMeta = req.body?.fileMeta || {};
  const options = req.body?.options || {};
  const onExistingEmail = String(options.onExistingEmail || 'ERROR').toUpperCase(); // ERROR | SKIP
  const rows = Array.isArray(req.body?.validRows) ? req.body.validRows : [];

  if (!rows.length) return res.status(400).json({ message: 'No hay registros válidos para procesar' });

  const processRun = await prisma.processRun.create({
    data: {
      processName: 'Alta masiva de usuarios',
      processCode: 'USER_BATCH_IMPORT',
      executedByUserId: adminUserId,
      inputFileName: typeof fileMeta.fileName === 'string' ? fileMeta.fileName : null,
      inputFileType: 'csv',
      totalRecords: rows.length,
      status: 'RUNNING',
    },
  });

  // Opcional: asignar Tag a todos los usuarios creados en este batch (para segmentación y trazabilidad)
  const assignTagSlug = typeof options.assignTagSlug === 'string' ? options.assignTagSlug : '';
  const assignTagName = typeof options.assignTagName === 'string' ? options.assignTagName : '';
  const batchTag = assignTagSlug ? await getOrCreateTagBySlug({ slug: assignTagSlug, name: assignTagName }) : null;


  const successRows = [];
  const errorRows = [];
  let successCount = 0;
  let errorCount = 0;
  let skippedCount = 0;

  try {
    for (const r of rows) {
      const rowNumber = r.rowNumber;
      const raw = r.raw || {};
      const model = r.normalized || normalizeUserRow(raw);

      try {
        const existing = await prisma.user.findUnique({ where: { email: model.email } });
        if (existing) {
          if (onExistingEmail === 'SKIP') {
            skippedCount++;
            successRows.push({ rowNumber, raw, normalized: model, observacion: 'SKIP - email ya existía' });
            continue;
          }
          throw new Error('Email ya existe');
        }

        const tempPassword = crypto.randomBytes(24).toString('hex');
        const passwordHash = await bcrypt.hash(tempPassword, 10);

        const user = await prisma.user.create({
          data: {
            name: model.name,
            lastName: model.lastName,
            phone: model.phone,
            email: model.email,
            password: passwordHash,
            role: 'CLIENT',
            active: false,
            ...(batchTag ? { userTags: { create: [{ tagId: batchTag.id }] } } : {}),
          },
        });

        const { token } = await createActivationTokenForUser(user.id);

        try {
          await sendActivationEmail({ user, token });
        } catch (mailErr) {
          console.error('users-batch: email error:', mailErr);
          // no frenamos el usuario creado; marcamos como éxito con warning
          successCount++;
          successRows.push({ rowNumber, raw, normalized: model, observacion: 'OK - usuario creado; error enviando mail' });
          continue;
        }

        successCount++;
        successRows.push({ rowNumber, raw, normalized: model, observacion: 'OK - usuario creado; mail enviado' });
      } catch (e) {
        errorCount++;
        errorRows.push({ rowNumber, raw, normalized: model, observacion: `ERROR - ${e.message}` });
      }
    }

    const status = errorCount === 0 ? 'SUCCESS' : successCount > 0 ? 'PARTIAL' : 'ERROR';
    await prisma.processRun.update({
      where: { id: processRun.id },
      data: {
        finishedAt: new Date(),
        status,
        successRecords: successCount,
        errorRecords: errorCount,
        skippedRecords: skippedCount,
        resultSummary: `Usuarios: ok=${successCount} err=${errorCount} skip=${skippedCount}`,
      },
    });

    return res.json({
      processRunId: processRun.id,
      summary: { created: successCount, errors: errorCount, skipped: skippedCount, total: rows.length },
      successRows,
      errorRows,
    });
  } catch (err) {
    console.error('users-batch/execute fatal error:', err);
    await prisma.processRun.update({
      where: { id: processRun.id },
      data: {
        finishedAt: new Date(),
        status: 'ERROR',
        errorSummary: String(err.message || err),
        successRecords: successCount,
        errorRecords: errorCount,
        skippedRecords: skippedCount,
      },
    });
    return res.status(500).json({ message: 'Error ejecutando alta masiva' });
  }
});


/**
 * GET /api/admin/operations/email-templates
 * Devuelve lista corta de templates para UI de operaciones.
 */
router.get('/email-templates', authRequired, requireAdmin, async (req, res) => {
  try {
    const templates = await prisma.emailTemplate.findMany({
      select: { key: true, name: true, subject: true, updatedAt: true },
      orderBy: { key: 'asc' },
    });
    return res.json({ templates });
  } catch (err) {
    console.error('email-templates error:', err);
    return res.status(500).json({ message: 'Error obteniendo templates' });
  }
});

/**
 * GET /api/admin/operations/tags
 * Lista de tags para segmentación.
 */
router.get('/tags', authRequired, requireAdmin, async (req, res) => {
  try {
    const tags = await prisma.tag.findMany({
      select: { id: true, name: true, slug: true, description: true, updatedAt: true },
      orderBy: { slug: 'asc' },
    });
    return res.json({ tags });
  } catch (err) {
    console.error('tags list error:', err);
    return res.status(500).json({ message: 'Error obteniendo tags' });
  }
});

/**
 * POST /api/admin/operations/tags
 * Body: { name, slug?, description? }
 */
router.post('/tags', authRequired, requireAdmin, async (req, res) => {
  try {
    const name = String(req.body?.name || '').trim();
    const slug = slugify(String(req.body?.slug || name));
    const description = req.body?.description ? String(req.body.description) : null;

    if (!name) return res.status(400).json({ message: 'name requerido' });
    if (!slug) return res.status(400).json({ message: 'slug inválido' });

    const tag = await prisma.tag.upsert({
      where: { slug },
      update: { name, description },
      create: { name, slug, description },
    });
    return res.json({ tag });
  } catch (err) {
    console.error('tags create error:', err);
    return res.status(500).json({ message: 'Error creando tag' });
  }
});

async function resolveAudienceUsers(audience) {
  const type = String(audience?.type || 'CLIENT').toUpperCase();

  // Por defecto: activos. Caller puede forzar active=false.
  const activeFilter = audience?.active;
  const activeWhere = (activeFilter === true || activeFilter === false) ? activeFilter : true;

  if (type === 'CLIENT') {
    return prisma.user.findMany({
      where: { role: 'CLIENT', active: activeWhere },
      select: { id: true, name: true, email: true },
      orderBy: { id: 'asc' },
    });
  }

  if (type === 'CLASSIFY') {
    const classify = String(audience?.classify || '').toUpperCase();
    if (!['GOOD', 'REGULAR', 'BAD'].includes(classify)) throw new Error('classify inválido');
    return prisma.user.findMany({
      where: { role: 'CLIENT', classify, active: activeWhere },
      select: { id: true, name: true, email: true },
      orderBy: { id: 'asc' },
    });
  }

  if (type === 'TAG') {
    const slug = String(audience?.tagSlug || '').trim();
    if (!slug) throw new Error('tagSlug requerido');

    return prisma.user.findMany({
      where: {
        role: 'CLIENT',
        active: activeWhere,
        userTags: { some: { tag: { slug } } },
      },
      select: { id: true, name: true, email: true },
      orderBy: { id: 'asc' },
    });
  }

  throw new Error('audience.type inválido');
}


async function createResetTokenForUser(userId) {
  await prisma.passwordResetToken.updateMany({
    where: { userId, usedAt: null },
    data: { usedAt: new Date() },
  });

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = hashToken(token);
  const ttlMinutes = Number(process.env.RESET_TOKEN_TTL_MINUTES || 60);
  const expiresAt = new Date(Date.now() + ttlMinutes * 60 * 1000);

  await prisma.passwordResetToken.create({
    data: { userId, tokenHash, expiresAt },
  });

  return { token, expiresAt, ttlMinutes };
}

async function sendTemplateEmail({ templateKey, user, vars }) {
  const tpl = await getEmailTemplateByKey(templateKey);
  const { subject, body } = renderEmailTemplate(tpl, vars);
  await sendMail({ to: user.email, subject, text: body });
}

/**
 * POST /api/admin/operations/bulk-email/execute
 * Body: { templateKey, audience, variables? }
 */
router.post('/bulk-email/execute', authRequired, requireAdmin, async (req, res) => {
  const adminUserId = req.user?.userId;
  if (!adminUserId) return res.status(401).json({ message: 'No autorizado' });

  const templateKey = String(req.body?.templateKey || '').trim();
  const audience = req.body?.audience || { type: 'CLIENT' };
  const variables = req.body?.variables || {};

  if (!templateKey) return res.status(400).json({ message: 'templateKey requerido' });

  let processRun = null;
  try {
    const users = await resolveAudienceUsers(audience);

    processRun = await prisma.processRun.create({
      data: {
        processName: 'Envío masivo de emails',
        processCode: 'OPS_BULK_EMAIL_SEND',
        executedByUserId: adminUserId,
        totalRecords: users.length,
        status: 'RUNNING',
        resultSummary: JSON.stringify({ templateKey, audience }),
      },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const u of users) {
      try {
        await sendTemplateEmail({
          templateKey,
          user: u,
          vars: {
            name: u.name || '',
            userEmail: u.email,
            ...variables,
          },
        });
        successCount++;
      } catch (e) {
        errorCount++;
        console.error('bulk-email item error:', u.email, e);
      }
    }

    const status =
      errorCount === 0
        ? 'SUCCESS'
        : successCount > 0
          ? 'PARTIAL'
          : 'ERROR';


    processRun = await prisma.processRun.update({
      where: { id: processRun.id },
      data: {
        finishedAt: new Date(),
        status,
        successRecords: successCount,
        errorRecords: errorCount,
        resultSummary: JSON.stringify({ templateKey, audience, successCount, errorCount }),
        errorSummary: errorCount ? 'Algunos envíos fallaron. Revisar logs del servidor.' : null,
      },
    });

    return res.json({ processRun });
  } catch (err) {
    console.error('bulk-email execute error:', err);
    if (processRun) {
      await prisma.processRun.update({
        where: { id: processRun.id },
        data: {
          finishedAt: new Date(),
          status: 'ERROR',
          errorRecords: processRun.totalRecords || 0,
          errorSummary: String(err?.message || err),
        },
      });
    }
    return res.status(500).json({ message: 'Error ejecutando envío masivo' });
  }
});

/**
 * POST /api/admin/operations/bulk-token-regenerate/execute
 * Body: { tokenType: 'ACTIVATION'|'RESET', templateKey, audience }
 */
router.post('/bulk-token-regenerate/execute', authRequired, requireAdmin, async (req, res) => {
  const adminUserId = req.user?.userId;
  if (!adminUserId) return res.status(401).json({ message: 'No autorizado' });

  const tokenType = String(req.body?.tokenType || 'ACTIVATION').toUpperCase();
  const templateKey = String(req.body?.templateKey || '').trim();
  const audience = req.body?.audience || { type: 'CLIENT' };

  const audienceWithDefaults = {
    ...audience,
    active:
      (audience && Object.prototype.hasOwnProperty.call(audience, 'active'))
        ? audience.active
        : (tokenType === 'ACTIVATION' ? false : true),
  };

  if (!templateKey) return res.status(400).json({ message: 'templateKey requerido' });
  if (!['ACTIVATION', 'RESET'].includes(tokenType)) return res.status(400).json({ message: 'tokenType inválido' });

  let processRun = null;
  try {
    const users = await resolveAudienceUsers(audienceWithDefaults);

    processRun = await prisma.processRun.create({
      data: {
        processName: tokenType === 'ACTIVATION' ? 'Regenerar token de activación + enviar' : 'Regenerar token de reset + enviar',
        processCode: 'OPS_BULK_TOKEN_REGEN_SEND',
        executedByUserId: adminUserId,
        totalRecords: users.length,
        status: 'RUNNING',
        resultSummary: JSON.stringify({ tokenType, templateKey, audience: audienceWithDefaults }),
      },
    });

    let successCount = 0;
    let errorCount = 0;

    for (const u of users) {
      try {
        if (tokenType === 'ACTIVATION') {
          const { token } = await createActivationTokenForUser(u.id);
          const actionUrl = joinFrontendUrl(`activate?token=${token}`);
          const ttlMinutes = getActivationTtlMinutes();

          await sendTemplateEmail({
            templateKey,
            user: u,
            vars: {
              name: u.name || '',
              userEmail: u.email,
              actionUrl,
              activationLink: actionUrl, // compat
              ttlMinutes,
            },
          });
        } else {
          const { token, ttlMinutes } = await createResetTokenForUser(u.id);
          const actionUrl = joinFrontendUrl(`reset-password?token=${token}`);

          await sendTemplateEmail({
            templateKey,
            user: u,
            vars: {
              name: u.name || '',
              userEmail: u.email,
              actionUrl,
              resetLink: actionUrl, // compat
              ttlMinutes,
            },
          });
        }

        successCount++;
      } catch (e) {
        errorCount++;
        console.error('bulk-token item error:', u.email, e);
      }
    }

    const status =
      errorCount === 0
        ? 'SUCCESS'
        : successCount > 0
          ? 'PARTIAL'
          : 'ERROR';


    processRun = await prisma.processRun.update({
      where: { id: processRun.id },
      data: {
        finishedAt: new Date(),
        status,
        successRecords: successCount,
        errorRecords: errorCount,
        resultSummary: JSON.stringify({ tokenType, templateKey, audience: audienceWithDefaults, successCount, errorCount }),
        errorSummary: errorCount ? 'Algunos envíos fallaron. Revisar logs del servidor.' : null,
      },
    });

    return res.json({ processRun });
  } catch (err) {
    console.error('bulk-token execute error:', err);
    if (processRun) {
      await prisma.processRun.update({
        where: { id: processRun.id },
        data: {
          finishedAt: new Date(),
          status: 'ERROR',
          errorRecords: processRun.totalRecords || 0,
          errorSummary: String(err?.message || err),
        },
      });
    }
    return res.status(500).json({ message: 'Error ejecutando regeneración + envío' });
  }
});

module.exports = router;
