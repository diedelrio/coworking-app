import { useEffect, useMemo, useState } from "react";
import api from "../api/axiosClient";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Parse settings that represent an HOUR or TIME.
 * Accepts:
 * - "9" / "09"  => 9:00 (hours)
 * - "09:00"      => 09:00
 * - "09:00:00"   => 09:00
 */
function toMinutesFromHour(v, fallbackMinutes) {
  if (v === null || v === undefined || v === "") return fallbackMinutes;
  const s = String(v).trim();
  // "9" or "09" -> hours
  if (/^\d{1,2}$/.test(s)) return Number(s) * 60;
  // "09:00" or "9:00"
  if (/^\d{1,2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").map(Number);
    return h * 60 + m;
  }
  // "09:00:00"
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) {
    const [h, m] = s.split(":").slice(0, 2).map(Number);
    return h * 60 + m;
  }
  return fallbackMinutes;
}

/**
 * Parse settings that represent MINUTES.
 * Accepts numeric or numeric strings (e.g. "30", 30).
 */
function toIntMinutes(v, fallbackMinutes) {
  if (v === null || v === undefined || v === "") return fallbackMinutes;
  const num = Number(String(v).trim());
  if (Number.isNaN(num)) return fallbackMinutes;
  return Math.floor(num);
}

function toHHMM(totalMin) {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${pad2(h)}:${pad2(m)}`;
}

function minutesBetween(startHHMM, endHHMM) {
  const [sh, sm] = (startHHMM || "0:0").split(":").map(Number);
  const [eh, em] = (endHHMM || "0:0").split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function buildOptions(openMin, closeMin, stepMin, minValueMin = openMin, maxValueMin = closeMin) {
  const out = [];
  for (let t = minValueMin; t <= maxValueMin; t += stepMin) out.push(toHHMM(t));
  return out;
}

/**
 * Reusable time controls for reservations (User + Admin).
 * - Uses public settings: OFFICE_OPEN_HOUR, OFFICE_CLOSE_HOUR, RESERVATION_STEP_MINUTES, HALF_DAY_MINUTES
 * - Supports manual selection, half-day, full-day
 */
export default function ReservationTimeFields({
  startTime,
  endTime,
  setStartTime,
  setEndTime,
  disabled = false,
  labelStart = "Hora de Inicio *",
  labelEnd = "Hora de Fin *",
}) {
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  const [mode, setMode] = useState("MANUAL"); // MANUAL | HALF_DAY | FULL_DAY

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/public/settings");
        if (!mounted) return;
        setSettings(res.data?.settings || {});
      } catch (e) {
        // fallback (safe defaults)
        if (!mounted) return;
        setSettings({});
      } finally {
        if (mounted) setLoadingSettings(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const cfg = useMemo(() => {
    const openMin = toMinutesFromHour(settings?.OFFICE_OPEN_HOUR, 9 * 60);
    const closeMin = toMinutesFromHour(settings?.OFFICE_CLOSE_HOUR, 18 * 60);
    const stepMin = toIntMinutes(settings?.RESERVATION_STEP_MINUTES, 30);
    const halfDayMin = toIntMinutes(settings?.HALF_DAY_MINUTES, 4 * 60);

    // Ensure sensible bounds
    const safeOpen = Math.max(0, openMin);
    const safeClose = Math.max(safeOpen + stepMin, closeMin);
    const safeStep = Math.max(5, stepMin);
    const safeHalf = Math.max(safeStep, Math.min(halfDayMin, safeClose - safeOpen));

    return { openMin: safeOpen, closeMin: safeClose, stepMin: safeStep, halfDayMin: safeHalf };
  }, [settings]);

  const halfDayStartOptions = useMemo(() => {
    const morning = cfg.openMin;
    const afternoon = cfg.closeMin - cfg.halfDayMin;
    // If halfDayMin equals full day, afternoon==open; keep unique.
    const opts = Array.from(new Set([morning, afternoon])).sort((a, b) => a - b);
    return opts.map(toHHMM);
  }, [cfg]);

  const manualStartOptions = useMemo(() => {
    // start must allow at least one step to end
    return buildOptions(cfg.openMin, cfg.closeMin, cfg.stepMin, cfg.openMin, cfg.closeMin - cfg.stepMin);
  }, [cfg]);

  const manualEndOptions = useMemo(() => {
    const sMin = toMinutesFromHour(startTime, cfg.openMin);
    const minEnd = Math.min(cfg.closeMin, sMin + cfg.stepMin);
    return buildOptions(cfg.openMin, cfg.closeMin, cfg.stepMin, minEnd, cfg.closeMin);
  }, [cfg, startTime]);

  // Keep endTime valid when in manual mode and startTime changes
  useEffect(() => {
    if (loadingSettings) return;
    if (mode !== "MANUAL") return;

    const dur = minutesBetween(startTime, endTime);
    if (dur >= cfg.stepMin) return;

    const sMin = toMinutesFromHour(startTime, cfg.openMin);
    const nextEnd = Math.min(cfg.closeMin, sMin + cfg.stepMin);
    setEndTime(toHHMM(nextEnd));
  }, [startTime, endTime, mode, loadingSettings, cfg, setEndTime]);

  // Mode handlers
  function activateManual() {
    setMode("MANUAL");
  }

  function activateFullDay() {
    setMode("FULL_DAY");
    setStartTime(toHHMM(cfg.openMin));
    setEndTime(toHHMM(cfg.closeMin));
  }

  function activateHalfDay() {
    setMode("HALF_DAY");
    // default: morning slot
    const start = halfDayStartOptions[0] || toHHMM(cfg.openMin);
    setStartTime(start);
    const sMin = toMinutesFromHour(start, cfg.openMin);
    setEndTime(toHHMM(Math.min(cfg.closeMin, sMin + cfg.halfDayMin)));
  }

  // When half-day start changes, keep end synced
  useEffect(() => {
    if (loadingSettings) return;
    if (mode !== "HALF_DAY") return;
    const sMin = toMinutesFromHour(startTime, cfg.openMin);
    setEndTime(toHHMM(Math.min(cfg.closeMin, sMin + cfg.halfDayMin)));
  }, [mode, startTime, loadingSettings, cfg, setEndTime]);

  // If user manually changes times while not in MANUAL, switch to MANUAL
  function onManualStartChange(v) {
    if (mode !== "MANUAL") setMode("MANUAL");
    setStartTime(v);
  }
  function onManualEndChange(v) {
    if (mode !== "MANUAL") setMode("MANUAL");
    setEndTime(v);
  }

  const isDisabled = disabled || loadingSettings;

  return (
    <div className="reserve-time-block">
      <div className="reserve-time-toggles">
        <button
          type="button"
          className={`reserve-toggle ${mode === "MANUAL" ? "active" : ""}`}
          onClick={activateManual}
          disabled={disabled}
          title="Elegir horario manualmente"
        >
          Manual
        </button>
        <button
          type="button"
          className={`reserve-toggle ${mode === "HALF_DAY" ? "active" : ""}`}
          onClick={activateHalfDay}
          disabled={disabled}
          title="Reserva de medio día"
        >
          Medio día
        </button>
        <button
          type="button"
          className={`reserve-toggle ${mode === "FULL_DAY" ? "active" : ""}`}
          onClick={activateFullDay}
          disabled={disabled}
          title="Reserva de día completo"
        >
          Día completo
        </button>
      </div>

      <div className="reserve-time-grid">
        <div className="user-reserve-field">
          <label>{labelStart}</label>

          {mode === "FULL_DAY" ? (
            <input type="time" value={toHHMM(cfg.openMin)} disabled />
          ) : (
            <select
              value={startTime}
              onChange={(e) => {
                const v = e.target.value;
                if (mode === "HALF_DAY") {
                  setStartTime(v);
                } else {
                  onManualStartChange(v);
                }
              }}
              disabled={isDisabled}
            >
              {(mode === "HALF_DAY" ? halfDayStartOptions : manualStartOptions).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <div className="user-reserve-field">
          <label>{labelEnd}</label>

          {mode === "MANUAL" ? (
            <select value={endTime} onChange={(e) => onManualEndChange(e.target.value)} disabled={isDisabled}>
              {manualEndOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          ) : (
            <input type="time" value={endTime || ""} disabled />
          )}
        </div>
      </div>

      {mode === "HALF_DAY" && (
        <div className="reserve-time-hint">
          Podés elegir turno mañana ({toHHMM(cfg.openMin)}) o tarde ({toHHMM(cfg.closeMin - cfg.halfDayMin)}).
        </div>
      )}
    </div>
  );
}
