// backend/src/routes/operations/bulkTokens.js
// Regeneración masiva de tokens
const express = require('express');
const prisma = require('../../prisma');
const { authRequired, requireAdmin } = require('../../middlewares/auth');
const { joinFrontendUrl } = require('../../utils/frontendUrl');
const { getActivationTtlMinutes, createActivationTokenForUser, resolveAudienceUsers, createResetTokenForUser, sendTemplateEmail } = require('./helpers');

const router = express.Router();

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
