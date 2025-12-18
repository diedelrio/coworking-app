const prisma = require('../prisma'); // ajusta si tu prisma client está en otro path

let cache = { ts: 0, map: null };
const TTL_MS = 60_000;

function toTyped(value, valueType, fallback) {
  if (value == null) return fallback;

  switch (valueType) {
    case 'INT':
    case 'NUMBER': {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    }
    case 'BOOL':
    case 'BOOLEAN': {
      if (typeof value === 'boolean') return value;
      const v = String(value).toLowerCase().trim();
      if (['true', '1', 'yes', 'y', 'on'].includes(v)) return true;
      if (['false', '0', 'no', 'n', 'off'].includes(v)) return false;
      return fallback;
    }
    case 'JSON': {
      try {
        return JSON.parse(value);
      } catch {
        return fallback;
      }
    }
    case 'STRING':
    default:
      return String(value);
  }
}

async function getActiveSettingsMap(keys) {
  const now = Date.now();
  if (cache.map && now - cache.ts < TTL_MS) return cache.map;

  const rows = await prisma.setting.findMany({
    where: {
      key: { in: keys },
      status: 'ACTIVE',
    },
    select: { key: true, value: true, valueType: true },
  });

  const map = {};
  for (const r of rows) {
    map[r.key] = { value: r.value, valueType: r.valueType };
  }

  cache = { ts: now, map };
  return map;
}

function invalidateSettingsCache() {
  cache = { ts: 0, map: null };
}

// ✅ Reglas de reservas desde Settings
async function getReservationRules() {
  const keys = [
    'OFFICE_OPEN_HOUR',
    'OFFICE_CLOSE_HOUR',
    'RESERVATION_MIN_MINUTES',
    'RESERVATION_STEP_MINUTES',
  ];

  const m = await getActiveSettingsMap(keys);

  // defaults seguros
  const openHour = toTyped(m.OFFICE_OPEN_HOUR?.value, m.OFFICE_OPEN_HOUR?.valueType, 9);
  const closeHour = toTyped(m.OFFICE_CLOSE_HOUR?.value, m.OFFICE_CLOSE_HOUR?.valueType, 18);
  const minMinutes = toTyped(m.RESERVATION_MIN_MINUTES?.value, m.RESERVATION_MIN_MINUTES?.valueType, 60);
  const stepMinutes = toTyped(m.RESERVATION_STEP_MINUTES?.value, m.RESERVATION_STEP_MINUTES?.valueType, 30);

  return {
    openHour: Number(openHour),
    closeHour: Number(closeHour),
    minMinutes: Number(minMinutes),
    stepMinutes: Number(stepMinutes),
  };
}

/**
 * ✅ Lista settings (por defecto sólo ACTIVE)
 * Se usa en la pantalla "Reglas de negocio"
 */
async function listSettings({ includeInactive = false } = {}) {
  return prisma.setting.findMany({
    where: includeInactive ? {} : { status: 'ACTIVE' },
    orderBy: { key: 'asc' },
  });
}

/**
 * ✅ Historial de un setting
 * GET /api/settings/:id/history
 */
async function getSettingHistory(settingId) {
  const id = Number(settingId);
  if (Number.isNaN(id)) throw new Error('ID de setting inválido');

  return prisma.settingHistory.findMany({
    where: { settingId: id },
    include: {
      changedBy: { select: { id: true, name: true, email: true } },
    },
    orderBy: { createdAt: 'desc' },
  });
}

/**
 * ✅ Crear setting + history
 */
async function createSetting({ key, value, valueType, description, userId }) {
  if (!key || value == null || !valueType) {
    throw new Error('Faltan datos para crear setting');
  }

  // Prisma schema: value es String, valueType enum: NUMBER | STRING | BOOLEAN
  const created = await prisma.setting.create({
    data: {
      key: String(key).trim(),
      value: String(value),
      valueType,
      description: description ?? null,
      status: 'ACTIVE',
    },
  });

  await prisma.settingHistory.create({
    data: {
      settingId: created.id,
      oldValue: null,
      newValue: created.value,
      action: 'CREATED',
      changedByUserId: userId ?? null,
    },
  });

  invalidateSettingsCache();
  return created;
}

/**
 * ✅ Actualizar setting + history
 * - Si pasa a INACTIVE => action DEACTIVATED
 * - Si no => UPDATED
 */
async function updateSetting({ id, value, status, description, userId }) {
  const settingId = Number(id);
  if (Number.isNaN(settingId)) throw new Error('ID de setting inválido');

  const existing = await prisma.setting.findUnique({
    where: { id: settingId },
  });

  if (!existing) {
    const err = new Error('Setting no encontrado');
    err.code = 'NOT_FOUND';
    throw err;
  }

  // Mantener valores actuales si no vienen en payload
  const nextValue = value !== undefined ? String(value) : existing.value;
  const nextStatus = status !== undefined ? status : existing.status;
  const nextDescription = description !== undefined ? description : existing.description;

  // Definir action
  const action =
    existing.status !== 'INACTIVE' && nextStatus === 'INACTIVE'
      ? 'DEACTIVATED'
      : 'UPDATED';

  const updated = await prisma.setting.update({
    where: { id: settingId },
    data: {
      value: nextValue,
      status: nextStatus,
      description: nextDescription ?? null,
    },
  });

  await prisma.settingHistory.create({
    data: {
      settingId: updated.id,
      oldValue: existing.value,
      newValue: updated.value,
      action,
      changedByUserId: userId ?? null,
    },
  });

  invalidateSettingsCache();
  return updated;
}

module.exports = {
  // tus funciones existentes
  getReservationRules,
  invalidateSettingsCache,
  getActiveSettingsMap,

  // las que usa routes/settings.js
  listSettings,
  getSettingHistory,
  createSetting,
  updateSetting,
};
