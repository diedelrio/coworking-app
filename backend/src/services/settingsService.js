// backend/src/services/settingsService.js
const prisma = require('../prisma');

/**
 * Defaults para TODAS las settings (globales, por tipo y alertas).
 * Si alguna no existe en DB, se crea sola con estos valores base.

 **Dejo el viejo código
const DEFAULT_SETTINGS = [
  // --- Reglas globales de reservas ---
  {
    key: 'min_hours_before',
    value: '2',
    valueType: 'NUMBER',
    description: 'Horas mínimas de antelación para hacer una reserva',
  },
  {
    key: 'max_hours_per_day',
    value: '8',
    valueType: 'NUMBER',
    description: 'Máximo de horas reservables por día (global)',
  },
  {
    key: 'max_hours_per_week',
    value: '40',
    valueType: 'NUMBER',
    description: 'Máximo de horas reservables por semana (global)',
  },

  // --- Reglas por tipo de espacio ---
  // Mapeo funcional sugerido:
  // FLEX_DESK → escritorios comunitarios
  // FIX_DESK  → despacho privado
  // MEETING_ROOM → sala de reuniones

  // Escritorio comunitario (FLEX_DESK)
  {
    key: 'FLEX_DESK_MAX_HOURS_PER_DAY_PER_USER',
    value: '4',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por día que un usuario puede reservar en escritorios comunitarios (FLEX_DESK)',
  },
  {
    key: 'FLEX_DESK_MAX_HOURS_PER_WEEK_PER_USER',
    value: '20',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por semana en escritorios comunitarios (FLEX_DESK)',
  },
  {
    key: 'FLEX_DESK_MAX_OVERLAPPING_SPACES_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de escritorios comunitarios simultáneos por usuario (FLEX_DESK)',
  },

  // Despacho privado (FIX_DESK)
  {
    key: 'FIX_DESK_MAX_HOURS_PER_DAY_PER_USER',
    value: '4',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por día que un usuario puede reservar el despacho (FIX_DESK)',
  },
  {
    key: 'FIX_DESK_MAX_HOURS_PER_WEEK_PER_USER',
    value: '15',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por semana que un usuario puede reservar el despacho (FIX_DESK)',
  },
  {
    key: 'FIX_DESK_MAX_OVERLAPPING_SPACES_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de despachos simultáneos por usuario (normalmente 1) (FIX_DESK)',
  },

  // Sala de reuniones (MEETING_ROOM)
  {
    key: 'MEETING_ROOM_MAX_HOURS_PER_DAY_PER_USER',
    value: '2',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por día que un usuario puede reservar la sala de reuniones',
  },
  {
    key: 'MEETING_ROOM_MAX_HOURS_PER_WEEK_PER_USER',
    value: '6',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por semana que un usuario puede reservar la sala de reuniones',
  },
  {
    key: 'MEETING_ROOM_MAX_OVERLAPPING_SPACES_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de salas de reuniones simultáneas por usuario',
  },

  // --- Alertas por límites superados ---
  {
    key: 'limit_alert_emails',
    value: 'admin@coworking.local',
    valueType: 'STRING',
    description:
      'Lista de correos para recibir alertas de límites, separados por ; o ,',
  },
  {
    key: 'limit_alert_subject',
    value: 'Solicitud extra de reserva en el coworking',
    valueType: 'STRING',
    description:
      'Asunto del correo cuando un usuario supera los límites de reserva',
  },
  {
    key: 'limit_alert_template_id',
    value: '1',
    valueType: 'NUMBER',
    description:
      'ID del template de EmailTemplate que se usa para el cuerpo del mensaje',
  },
]; */

const DEFAULT_SETTINGS = [
  // --- Reglas globales de reservas ---
  {
    key: 'min_hours_before',
    value: '2',
    valueType: 'NUMBER',
    description: 'Horas mínimas de antelación para hacer una reserva',
  },
  {
    key: 'max_hours_per_day',
    value: '8',
    valueType: 'NUMBER',
    description: 'Máximo de horas reservables por día (global)',
  },
  {
    key: 'max_hours_per_week',
    value: '40',
    valueType: 'NUMBER',
    description: 'Máximo de horas reservables por semana (global)',
  },

  // --- Reglas por tipo de espacio ---
  // FLEX_DESK → escritorios comunitarios
  // FIX_DESK  → despacho privado
  // MEETING_ROOM → sala de reuniones

  // Escritorio comunitario (FLEX_DESK)
  {
    key: 'FLEX_DESK_MAX_HOURS_PER_DAY_PER_USER',
    value: '4',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por día que un usuario puede reservar en escritorios comunitarios (FLEX_DESK)',
  },
  {
    key: 'FLEX_DESK_MAX_HOURS_PER_WEEK_PER_USER',
    value: '20',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por semana en escritorios comunitarios (FLEX_DESK)',
  },
  {
    key: 'FLEX_DESK_MAX_OVERLAPPING_SPACES_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de escritorios comunitarios simultáneos por usuario (FLEX_DESK)',
  },
  {
    key: 'FLEX_DESK_MAX_SPACES_PER_DAY_PER_USER',
    value: '2',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de escritorios comunitarios distintos que un usuario puede usar en el mismo día (FLEX_DESK)',
  },

  // Despacho privado (FIX_DESK)
  {
    key: 'FIX_DESK_MAX_HOURS_PER_DAY_PER_USER',
    value: '4',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por día que un usuario puede reservar el despacho (FIX_DESK)',
  },
  {
    key: 'FIX_DESK_MAX_HOURS_PER_WEEK_PER_USER',
    value: '15',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por semana que un usuario puede reservar el despacho (FIX_DESK)',
  },
  {
    key: 'FIX_DESK_MAX_OVERLAPPING_SPACES_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de despachos simultáneos por usuario (normalmente 1) (FIX_DESK)',
  },
  {
    key: 'FIX_DESK_MAX_SPACES_PER_DAY_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de despachos distintos que un usuario puede usar en el mismo día (FIX_DESK)',
  },

  // Sala de reuniones (MEETING_ROOM)
  {
    key: 'MEETING_ROOM_MAX_HOURS_PER_DAY_PER_USER',
    value: '2',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por día que un usuario puede reservar la sala de reuniones',
  },
  {
    key: 'MEETING_ROOM_MAX_HOURS_PER_WEEK_PER_USER',
    value: '6',
    valueType: 'NUMBER',
    description:
      'Máximo de horas por semana que un usuario puede reservar la sala de reuniones',
  },
  {
    key: 'MEETING_ROOM_MAX_OVERLAPPING_SPACES_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de salas de reuniones simultáneas por usuario',
  },
  {
    key: 'MEETING_ROOM_MAX_SPACES_PER_DAY_PER_USER',
    value: '1',
    valueType: 'NUMBER',
    description:
      'Cantidad máxima de salas de reuniones distintas que un usuario puede usar en el mismo día (MEETING_ROOM)',
  },

  // --- Alertas por límites superados ---
  {
    key: 'limit_alert_emails',
    value: 'admin@coworking.local',
    valueType: 'STRING',
    description:
      'Lista de correos para recibir alertas de límites, separados por ; o ,',
  },
  {
    key: 'limit_alert_subject',
    value: 'Solicitud extra de reserva en el coworking',
    valueType: 'STRING',
    description:
      'Asunto del correo cuando un usuario supera los límites de reserva',
  },
  {
    key: 'limit_alert_template_id',
    value: '1',
    valueType: 'NUMBER',
    description:
      'ID del template de EmailTemplate que se usa para el cuerpo del mensaje',
  },
];


function parseSettingValue(setting) {
  if (!setting) return null;
  switch (setting.valueType) {
    case 'NUMBER':
      return Number(setting.value);
    case 'BOOLEAN':
      return setting.value === 'true';
    case 'STRING':
    default:
      return setting.value;
  }
}

/**
 * Asegura que todas las DEFAULT_SETTINGS existen al menos una vez.
 */
async function ensureDefaultSettings(userIdForHistory = null) {
  for (const def of DEFAULT_SETTINGS) {
    let setting = await prisma.setting.findUnique({
      where: { key: def.key },
    });

    if (!setting) {
      setting = await prisma.setting.create({
        data: {
          key: def.key,
          value: def.value,
          valueType: def.valueType,
          description: def.description,
          status: 'ACTIVE',
        },
      });

      await prisma.settingHistory.create({
        data: {
          settingId: setting.id,
          oldValue: null,
          newValue: def.value,
          action: 'CREATED',
          changedByUserId: userIdForHistory, // puede ser null (sistema)
        },
      });
    }
  }
}

/**
 * Devuelve todas las settings activas como mapa: { key: parsedValue }
 */
async function getAllActiveSettingsMap() {
  await ensureDefaultSettings();

  const settings = await prisma.setting.findMany({
    where: { status: 'ACTIVE' },
  });

  const map = {};
  for (const s of settings) {
    map[s.key] = parseSettingValue(s);
  }
  return map;
}

/**
 * Reglas globales (las que ya teníamos antes).
 */
async function getReservationSettings() {
  const map = await getAllActiveSettingsMap();

  function getDefaultValue(key) {
    const def = DEFAULT_SETTINGS.find((d) => d.key === key);
    return def ? parseSettingValue(def) : null;
  }

  return {
    min_hours_before:
      map.min_hours_before ?? getDefaultValue('min_hours_before'),
    max_hours_per_day:
      map.max_hours_per_day ?? getDefaultValue('max_hours_per_day'),
    max_hours_per_week:
      map.max_hours_per_week ?? getDefaultValue('max_hours_per_week'),
  };
}

/**
 * Defaults por tipo de espacio si falta alguna setting en DB.
 */
function getDefaultTypeRules(spaceType) {
  const defaults = {
    FLEX_DESK: {
      maxHoursPerDayPerUser: 4,
      maxHoursPerWeekPerUser: 20,
      maxOverlappingSpacesPerUser: 1,
      maxSpacesPerDayPerUser: 2,
    },
    FIX_DESK: {
      maxHoursPerDayPerUser: 4,
      maxHoursPerWeekPerUser: 15,
      maxOverlappingSpacesPerUser: 1,
      maxSpacesPerDayPerUser: 1,
    },
    MEETING_ROOM: {
      maxHoursPerDayPerUser: 2,
      maxHoursPerWeekPerUser: 6,
      maxOverlappingSpacesPerUser: 1,
      maxSpacesPerDayPerUser: 1,
    },
  };

  return (
    defaults[spaceType] ?? {
      maxHoursPerDayPerUser: 8,
      maxHoursPerWeekPerUser: 40,
      maxOverlappingSpacesPerUser: 1,
      maxSpacesPerDayPerUser: 99,
    }
  );
}


/**
 * Reglas para un tipo de espacio concreto (por ej. FLEX_DESK, FIX_DESK, MEETING_ROOM)
 */
async function getTypeReservationRules(spaceType) {
  const map = await getAllActiveSettingsMap();

  const prefix = spaceType; // usamos el enum tal cual: FLEX_DESK_...

  const dayKey = `${prefix}_MAX_HOURS_PER_DAY_PER_USER`;
  const weekKey = `${prefix}_MAX_HOURS_PER_WEEK_PER_USER`;
  const overlapKey = `${prefix}_MAX_OVERLAPPING_SPACES_PER_USER`;
  const spacesPerDayKey = `${prefix}_MAX_SPACES_PER_DAY_PER_USER`;

  const defaults = getDefaultTypeRules(spaceType);

  return {
    maxHoursPerDayPerUser:
      map[dayKey] != null ? Number(map[dayKey]) : defaults.maxHoursPerDayPerUser,
    maxHoursPerWeekPerUser:
      map[weekKey] != null
        ? Number(map[weekKey])
        : defaults.maxHoursPerWeekPerUser,
    maxOverlappingSpacesPerUser:
      map[overlapKey] != null
        ? Number(map[overlapKey])
        : defaults.maxOverlappingSpacesPerUser,
    maxSpacesPerDayPerUser:
      map[spacesPerDayKey] != null
        ? Number(map[spacesPerDayKey])
        : defaults.maxSpacesPerDayPerUser,
  };
}


/**
 * Admin: listar settings
 */
async function listSettings() {
  return prisma.setting.findMany({
    orderBy: { key: 'asc' },
  });
}

/**
 * Admin: historial de una setting
 */
async function getSettingHistory(settingId) {
  return prisma.settingHistory.findMany({
    where: { settingId: Number(settingId) },
    orderBy: { createdAt: 'desc' },
    include: {
      changedBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
  });
}

async function createSetting({ key, value, valueType, description, userId }) {
  const setting = await prisma.setting.create({
    data: {
      key,
      value,
      valueType,
      description,
      status: 'ACTIVE',
    },
  });

  await prisma.settingHistory.create({
    data: {
      settingId: setting.id,
      oldValue: null,
      newValue: value,
      action: 'CREATED',
      changedByUserId: userId ?? null,
    },
  });

  return setting;
}

async function updateSetting({ id, value, status, description, userId }) {
  const existing = await prisma.setting.findUnique({
    where: { id: Number(id) },
  });

  if (!existing) {
    throw new Error('Setting no encontrada');
  }

  const updated = await prisma.setting.update({
    where: { id: Number(id) },
    data: {
      value: value ?? existing.value,
      status: status ?? existing.status,
      description: description ?? existing.description,
    },
  });

  const action =
    status && status !== existing.status ? 'DEACTIVATED' : 'UPDATED';

  await prisma.settingHistory.create({
    data: {
      settingId: updated.id,
      oldValue: existing.value,
      newValue: updated.value,
      action,
      changedByUserId: userId ?? null,
    },
  });

  return updated;
}

/**
 * Utils para alertas de límites
 */
function parseEmailList(emailsString) {
  if (!emailsString) return [];
  return emailsString
    .split(/[;,]/)
    .map((e) => e.trim())
    .filter((e) => e.length > 0);
}

async function getLimitAlertSettings() {
  const map = await getAllActiveSettingsMap();

  function getDefault(key) {
    const def = DEFAULT_SETTINGS.find((d) => d.key === key);
    return def ? def.value : null;
  }

  const emailsRaw = map.limit_alert_emails ?? getDefault('limit_alert_emails');
  const subject =
    map.limit_alert_subject ?? getDefault('limit_alert_subject');
  const templateIdRaw =
    map.limit_alert_template_id ?? getDefault('limit_alert_template_id');

  return {
    emails: parseEmailList(emailsRaw),
    subject,
    templateId: Number(templateIdRaw),
  };
}

module.exports = {
  getReservationSettings,
  getTypeReservationRules,
  getLimitAlertSettings,
  listSettings,
  getSettingHistory,
  createSetting,
  updateSetting,
};
