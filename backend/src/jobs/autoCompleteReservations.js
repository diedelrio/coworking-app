const prisma = require('../prisma');
const { getActiveSettingsMap } = require('../services/settingsService');
const { madridDateTimeToUtc, utcToMadridYMD, addDaysYMD } = require('../utils/timezone');

const DEFAULT_HOUR = 2; // 02:00 AM (hora de Madrid)
const DEFAULT_MINUTE = 0;

async function getScheduleFromSettings() {
  const keys = ['AUTO_COMPLETE_HOUR', 'AUTO_COMPLETE_MINUTE'];
  const m = await getActiveSettingsMap(keys);

  const hour = Number(m.AUTO_COMPLETE_HOUR?.value ?? DEFAULT_HOUR);
  const minute = Number(m.AUTO_COMPLETE_MINUTE?.value ?? DEFAULT_MINUTE);

  return {
    hour: Number.isFinite(hour) ? Math.max(0, Math.min(23, hour)) : DEFAULT_HOUR,
    minute: Number.isFinite(minute) ? Math.max(0, Math.min(59, minute)) : DEFAULT_MINUTE,
  };
}

async function autoCompleteOnce(now = new Date()) {
  // Idempotente: sólo toca ACTIVE con endTime <= now
  const result = await prisma.reservation.updateMany({
    where: {
      status: 'ACTIVE',
      endTime: { lte: now },
    },
    data: { status: 'COMPLETED' },
  });

  return result.count ?? 0;
}

// La hora configurada es hora de Madrid (igual que el resto del sistema), no la del servidor.
function msUntilNextRun({ hour, minute }, now = new Date()) {
  const hhmm = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  const today = utcToMadridYMD(now);
  let next = madridDateTimeToUtc(today, hhmm);
  if (next <= now) next = madridDateTimeToUtc(addDaysYMD(today, 1), hhmm);
  return next.getTime() - now.getTime();
}

function startAutoCompleteJob() {
  let timer = null;

  const scheduleNext = async () => {
    try {
      const schedule = await getScheduleFromSettings();
      const delay = msUntilNextRun(schedule);

      timer = setTimeout(async () => {
        try {
          const count = await autoCompleteOnce(new Date());
          console.log(`[jobs] Auto-complete: ${count} reservas marcadas como COMPLETED.`);
        } catch (err) {
          console.error('[jobs] Auto-complete failed:', err);
        } finally {
          scheduleNext();
        }
      }, delay);

      // Evita que el timer mantenga vivo el proceso en entornos serverless
      if (typeof timer.unref === 'function') timer.unref();
    } catch (err) {
      console.error('[jobs] Auto-complete scheduler failed:', err);
      // fallback: reintentar en 1 hora
      timer = setTimeout(scheduleNext, 60 * 60 * 1000);
      if (typeof timer.unref === 'function') timer.unref();
    }
  };

  scheduleNext();

  return {
    stop: () => {
      if (timer) clearTimeout(timer);
    },
    runNow: () => autoCompleteOnce(new Date()),
  };
}

module.exports = {
  startAutoCompleteJob,
  autoCompleteOnce,
  msUntilNextRun,
};
