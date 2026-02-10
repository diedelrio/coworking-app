// src/utils/timeUtils.js
// Helpers reutilizables para manejo de horas / reservas

function pad2(n) {
  return String(n).padStart(2, "0");
}

/** Convierte "HH:mm" a minutos desde 00:00. */
export function hhmmToMinutes(hhmm) {
  if (!hhmm) return 0;
  const [h, m] = String(hhmm).split(":").map(Number);
  return (Number(h) || 0) * 60 + (Number(m) || 0);
}

/** Convierte minutos desde 00:00 a "HH:mm". */
export function minutesToHHMM(totalMin) {
  const safe = Math.max(0, Math.floor(Number(totalMin) || 0));
  const h = Math.floor(safe / 60);
  const m = safe % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

/**
 * Parse de setting horario.
 * Acepta:
 * - "9" / "09" => 09:00
 * - "09:00" / "9:00" => 09:00
 * - "09:00:00" => 09:00
 */
export function parseHourSettingToMinutes(v, fallbackMinutes) {
  if (v === null || v === undefined || v === "") return fallbackMinutes;
  const s = String(v).trim();
  if (/^\d{1,2}$/.test(s)) return Number(s) * 60;
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").slice(0, 2).map(Number);
    return h * 60 + m;
  }
  return fallbackMinutes;
}

export function toIntMinutes(v, fallbackMinutes) {
  if (v === null || v === undefined || v === "") return fallbackMinutes;
  const num = Number(String(v).trim());
  if (Number.isNaN(num)) return fallbackMinutes;
  return Math.floor(num);
}

export function ceilToStep(minutes, step) {
  const s = Math.max(1, Number(step) || 1);
  return Math.ceil((Number(minutes) || 0) / s) * s;
}

export function isSameDay(a, b) {
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

export function minutesBetween(startHHMM, endHHMM) {
  return hhmmToMinutes(endHHMM) - hhmmToMinutes(startHHMM);
}

/** Devuelve un Date con fecha (YYYY-MM-DD) + hora (HH:mm) en horario local. */
export function composeLocalDateTime(dateYMD, hhmm) {
  const [y, m, d] = String(dateYMD).split("-").map(Number);
  const [hh, mm] = String(hhmm || "00:00").split(":").map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
}

/** Devuelve ISO UTC (con Z) a partir de fecha (YYYY-MM-DD) + hora (HH:mm) local. */
export function composeLocalDateTimeToISO(dateYMD, hhmm) {
  const dt = composeLocalDateTime(dateYMD, hhmm);
  return Number.isNaN(dt.getTime()) ? null : dt.toISOString();
}


function pickSetting(settings, keys, fallback) {
  for (const k of keys) {
    const v = settings?.[k];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return fallback;
}

/**
 * Construye opciones de Hora de Inicio.
 * Reglas:
 * - General: OPEN -> CLOSE - MIN_RESERVATION
 * - Create hoy: desde ceil(now + MIN_HOURS_BEFORE) (y >= OPEN)
 * - Edit: si es editable (diff >= MIN_HOURS_BEFORE), desde hora inicio original
 */
export function buildStartTimeOptions({
  mode, // "create" | "edit"
  selectedDateYMD,
  now = new Date(),
  settings,
  originalStartTime, // "HH:mm" (solo edit)
}) {
  const openMin = parseHourSettingToMinutes(
    pickSetting(settings, ["OFFICE_OPEN_HOUR", "office_open_hour"], "9"),
    9 * 60
  );
  const closeMin = parseHourSettingToMinutes(
    pickSetting(settings, ["OFFICE_CLOSE_HOUR", "office_close_hour"], "18"),
    18 * 60
  );
  const stepMin = toIntMinutes(
    pickSetting(settings, ["RESERVATION_STEP_MINUTES", "reservation_step_minutes"], "30"),
    30
  );

  // ✅ Duración mínima: si no viene, default 60 (por tu regla actual)
  const minDur = toIntMinutes(
    pickSetting(
      settings,
      ["RESERVATION_MIN_MINUTES", "reservation_min_minutes", "MIN_RESERVATION_MINUTES"],
      60
    ),
    60
  );

  // ✅ Antelación mínima: si no viene, 0 (hasta que backend la exponga)
  const minHoursBefore = toIntMinutes(
    pickSetting(settings, ["MIN_HOURS_BEFORE", "min_hours_before"], 0),
    0
  );

  const safeOpen = Math.max(0, openMin);
  const safeClose = Math.max(safeOpen + stepMin, closeMin);
  const latestStart = safeClose - minDur;

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const sameDay = isSameDay(selectedDateYMD, now);

  // EDIT: solo si faltan al menos MIN_HOURS_BEFORE horas
  if (mode === "edit" && originalStartTime && selectedDateYMD) {
    const startDT = composeLocalDateTime(selectedDateYMD, originalStartTime);
    const diffMs = startDT.getTime() - now.getTime();
    const diffMin = Math.floor(diffMs / 60000);

    if (diffMin < minHoursBefore * 60) {
      return {
        options: [],
        editable: false,
        error: `Esta reserva ya no puede modificarse porque faltan menos de ${minHoursBefore} horas para el inicio.`,
        meta: { openMin: safeOpen, closeMin: safeClose, stepMin, minDur, minHoursBefore },
      };
    }

    const baseStart = hhmmToMinutes(originalStartTime);
    if (baseStart > latestStart) {
      return {
        options: [],
        editable: false,
        error: "No hay horarios disponibles para editar con la configuración actual.",
        meta: { openMin: safeOpen, closeMin: safeClose, stepMin, minDur, minHoursBefore },
      };
    }

    const opts = [];
    for (let t = baseStart; t <= latestStart; t += stepMin) opts.push(minutesToHHMM(t));
    return {
      options: opts,
      editable: true,
      error: null,
      warning: null,
      meta: { openMin: safeOpen, closeMin: safeClose, stepMin, minDur, minHoursBefore },
    };
  }

  // CREATE
  let baseStart = safeOpen;

  // si es hoy: mover hacia adelante por antelación mínima
  if (sameDay) {
    const minAllowed = nowMin + minHoursBefore * 60;
    baseStart = Math.max(ceilToStep(minAllowed, stepMin), safeOpen);
  }

  if (baseStart > latestStart) {
    return {
      options: [],
      editable: false,
      error: sameDay
        ? "Ya no es posible reservar para hoy. Seleccioná una fecha futura."
        : "No hay horarios disponibles para la fecha seleccionada.",
      meta: { openMin: safeOpen, closeMin: safeClose, stepMin, minDur, minHoursBefore },
    };
  }

  const opts = [];
  for (let t = baseStart; t <= latestStart; t += stepMin) opts.push(minutesToHHMM(t));
  return {
    options: opts,
    editable: true,
    error: null,
    warning: null,
    meta: { openMin: safeOpen, closeMin: safeClose, stepMin, minDur, minHoursBefore },
  };
}

/**
 * Construye opciones de Hora de Fin.
 * Regla general: desde start + MIN_RESERVATION hasta CLOSE.
 */
export function buildEndTimeOptions({ startTime, settings }) {
  if (!startTime) return [];

  const closeMin = parseHourSettingToMinutes(
    pickSetting(settings, ["OFFICE_CLOSE_HOUR", "office_close_hour"], "18"),
    18 * 60
  );
  const stepMin = toIntMinutes(
    pickSetting(settings, ["RESERVATION_STEP_MINUTES", "reservation_step_minutes"], "30"),
    30
  );

  // ✅ Duración mínima: si no viene, default 60 (por tu regla actual)
  const minDur = toIntMinutes(
    pickSetting(
      settings,
      ["RESERVATION_MIN_MINUTES", "reservation_min_minutes", "MIN_RESERVATION_MINUTES"],
      60
    ),
    60
  );

  const sMin = hhmmToMinutes(startTime);
  const firstEnd = sMin + minDur;

  const opts = [];
  for (let t = firstEnd; t <= closeMin; t += stepMin) opts.push(minutesToHHMM(t));
  return opts;
}

/** Elige la opción más cercana >= target (si no existe, devuelve la última). */
export function pickClosestEndOption(endOptions, targetHHMM) {
  if (!Array.isArray(endOptions) || endOptions.length === 0) return "";
  const target = hhmmToMinutes(targetHHMM);
  for (const opt of endOptions) {
    if (hhmmToMinutes(opt) >= target) return opt;
  }
  return endOptions[endOptions.length - 1];
}
