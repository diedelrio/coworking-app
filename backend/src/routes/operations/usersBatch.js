// backend/src/routes/operations/usersBatch.js
// Alta masiva de usuarios
const express = require('express');
const prisma = require('../../prisma');
const { authRequired, requireAdmin } = require('../../middlewares/auth');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { parseDelimitedText } = require('../../utils/delimitedParser');
const { getOrCreateTagBySlug, createActivationTokenForUser, sendActivationEmail, normalizeUserRow, validateUserRow } = require('./helpers');

const router = express.Router();

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

module.exports = router;
