// backend/src/routes/operations/bulkEmail.js
// Envío masivo de emails
const express = require('express');
const prisma = require('../../prisma');
const { authRequired, requireAdmin } = require('../../middlewares/auth');
const { getEmailTemplateByKey } = require('../../services/emailTemplateService');
const { displayUser, filterUsersByTemplateConsent, resolveAudienceUsers, sendTemplateEmail } = require('./helpers');

const router = express.Router();

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
    const template = await getEmailTemplateByKey(templateKey);
    const users = await resolveAudienceUsers(audience);
    const consentFilter = await filterUsersByTemplateConsent(users, template);
    const usersToSend = consentFilter.allowedUsers;
    const blockedRows = consentFilter.blockedRows || [];

    processRun = await prisma.processRun.create({
      data: {
        processName: 'Envío masivo de emails',
        processCode: 'OPS_BULK_EMAIL_SEND',
        executedByUserId: adminUserId,
        totalRecords: users.length,
        status: 'RUNNING',
        resultSummary: JSON.stringify({
          templateKey,
          templateMessageType: consentFilter.messageType,
          audience,
          totalAudience: users.length,
          consentBlocked: blockedRows.length,
        }),
      },
    });

    let successCount = 0;
    let sendErrorCount = 0;
    const successRows = [];
    const sendErrorRows = [];

    for (const u of usersToSend) {
      try {
        await sendTemplateEmail({
          templateKey,
          template,
          user: u,
          vars: {
            name: u.name || '',
            userName: displayUser(u),
            userEmail: u.email,
            ...variables,
          },
        });
        successCount++;
        successRows.push({ userId: u.id, email: u.email, name: displayUser(u), observacion: 'OK - enviado' });
      } catch (e) {
        sendErrorCount++;
        const reason = e?.message || 'Error enviando email';
        sendErrorRows.push({ userId: u.id, email: u.email, name: displayUser(u), reason: `ERROR - ${reason}` });
        console.error('bulk-email item error:', u.email, e);
      }
    }

    const errorRows = [
      ...blockedRows.map((row) => ({ ...row, reason: `NO ENVIADO - ${row.reason}` })),
      ...sendErrorRows,
    ];

    const errorCount = errorRows.length;
    const status =
      errorCount === 0
        ? 'SUCCESS'
        : successCount > 0
          ? 'PARTIAL'
          : 'ERROR';

    const consentErrorSummary = blockedRows.length
      ? `No enviados por falta de consentimiento (${blockedRows.length}): ${blockedRows.map((r) => `${r.email} (${r.reason})`).join('; ')}`
      : null;

    const sendErrorSummary = sendErrorRows.length
      ? `Errores de envío (${sendErrorRows.length}): ${sendErrorRows.map((r) => `${r.email} (${r.reason})`).join('; ')}`
      : null;

    processRun = await prisma.processRun.update({
      where: { id: processRun.id },
      data: {
        finishedAt: new Date(),
        status,
        successRecords: successCount,
        errorRecords: errorCount,
        skippedRecords: 0,
        resultSummary: JSON.stringify({
          templateKey,
          templateMessageType: consentFilter.messageType,
          audience,
          totalAudience: users.length,
          sent: successCount,
          blockedByConsent: blockedRows.length,
          sendErrors: sendErrorRows.length,
          requiredConsents: consentFilter.requiredConsents,
        }),
        errorSummary: [consentErrorSummary, sendErrorSummary].filter(Boolean).join('\n') || null,
      },
    });

    return res.json({
      processRun,
      successRows,
      errorRows,
      consentFilter: {
        messageType: consentFilter.messageType,
        consentType: consentFilter.consentType,
        blocked: blockedRows.length,
        requiredConsents: consentFilter.requiredConsents,
      },
    });
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

module.exports = router;
