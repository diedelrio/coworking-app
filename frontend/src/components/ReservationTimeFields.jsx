import { useMemo, useState, useEffect } from "react";
import { hhmmToMinutes, minutesToHHMM, pickClosestEndOption } from "../utils/timeUtils";

function normalizeHHMM(v) {
  if (!v) return "";
  if (typeof v === "string") {
    const s = v.trim();
    if (/^\d{2}:\d{2}$/.test(s)) return s;
    const m = /^(\d{2}):(\d{2}):\d{2}/.exec(s);
    if (m) return `${m[1]}:${m[2]}`;
    const d = new Date(s);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
    return s;
  }
  try {
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      const hh = String(d.getHours()).padStart(2, "0");
      const mm = String(d.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    }
  } catch (_) {}
  return "";
}


export default function ReservationTimeFields({
  startTime,
  endTime,
  setStartTime,
  setEndTime,
  disabled = false,
  startOptions = [],
  endOptions = [],
  error = "",
  warning = "",
  halfDayMinutes = 300,
}) {
  const [mode, setMode] = useState("MANUAL"); // MANUAL | HALF | FULL

  const halfDayStarts = useMemo(() => {
    if (!Array.isArray(startOptions) || startOptions.length === 0) return [];
    const open = startOptions[0];
    const afternoon = minutesToHHMM(hhmmToMinutes(open) + Number(halfDayMinutes || 300));
    const allowed = [open, afternoon].filter((t) => startOptions.includes(t));
    // evitar duplicados
    return Array.from(new Set(allowed));
  }, [startOptions, halfDayMinutes]);

  // Si cambian opciones:
  // - En creación: si no hay valor, setear default permitido
  // - En edición: si hay valor pero no está en opciones, NO lo pisamos (lo mostramos igual)
  useEffect(() => {
    if (!startOptions?.length) return;

    const normalized = normalizeHHMM(startTime);
    if (startTime && normalized && normalized !== startTime) {
      setStartTime(normalized);
      return;
    }

    if (!startTime) {
      const allowed = mode === "HALF" && halfDayStarts.length ? halfDayStarts : startOptions;
      setStartTime(allowed[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOptions, mode, halfDayStarts]);


  useEffect(() => {
    if (!endOptions?.length) return;

    const normalized = normalizeHHMM(endTime);
    if (endTime && normalized && normalized !== endTime) {
      setEndTime(normalized);
      return;
    }

    if (!endTime) {
      setEndTime(endOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [endOptions]);

  const modeBtn = (active) => ({
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid #d6dbe6",
    background: active ? "#5b86ff" : "#fff",
    color: active ? "#fff" : "#2a2f3a",
    fontWeight: 700,
    fontSize: 12,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.6 : 1,
  });

  const applyHalfDay = (st) => {
    if (!endOptions?.length) return;
    const target = minutesToHHMM(hhmmToMinutes(st) + Number(halfDayMinutes || 300));
    const picked = pickClosestEndOption(endOptions, target);
    setEndTime(picked || endOptions[0]);
  };

  const handleMode = (next) => {
    if (disabled) return;
    if (!startOptions?.length) return;

    setMode(next);

    // ✅ BUG-0003 (2): al cambiar de Manual → Medio día / Día completo, resetear horas y usar valores predefinidos
    if (next === "FULL") {
      const st = startOptions[0];
      setStartTime(st);
      if (endOptions?.length) setEndTime(endOptions[endOptions.length - 1]);
      return;
    }

    if (next === "HALF") {
      const st = halfDayStarts.length ? halfDayStarts[0] : startOptions[0];
      setStartTime(st);
      applyHalfDay(st);
      return;
    }

    // MANUAL: no toca horas
  };

  const startSelectOptions = useMemo(() => {
    const base = mode === "HALF" && halfDayStarts.length ? halfDayStarts : startOptions;
    const st = normalizeHHMM(startTime);
    if (st && Array.isArray(base) && !base.includes(st)) return [st, ...base];
    return base;
  }, [mode, halfDayStarts, startOptions, startTime]);

  const endSelectOptions = useMemo(() => {
    const base = Array.isArray(endOptions) ? endOptions : [];
    const et = normalizeHHMM(endTime);
    if (et && !base.includes(et)) return [et, ...base];
    return base;
  }, [endOptions, endTime]);

  return (
    <div className="user-reserve-field full">
      <div style={{ display: "flex", gap: 10, marginBottom: 10 }}>
        <button type="button" onClick={() => handleMode("MANUAL")} style={modeBtn(mode === "MANUAL")}>
          Manual
        </button>
        <button type="button" onClick={() => handleMode("HALF")} style={modeBtn(mode === "HALF")}>
          Medio día
        </button>
        <button type="button" onClick={() => handleMode("FULL")} style={modeBtn(mode === "FULL")}>
          Día completo
        </button>
      </div>

      <div className="reserve-time-block">
        <div className="reserve-time-grid">
          <div className="user-reserve-field">
            <label>Hora de Inicio *</label>
            <select
              value={startTime || ""}
              onChange={(e) => {
                const v = e.target.value;
                if (mode === "HALF") {
                  setStartTime(v);
                  applyHalfDay(v);
                  return;
                }
                setMode("MANUAL");
                setStartTime(v);
              }}
              disabled={disabled || !startSelectOptions?.length}
            >
              {!startSelectOptions?.length ? <option value="">—</option> : null}
              {startSelectOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {mode === "HALF" ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                En medio día solo podés elegir {startSelectOptions.join(" o ")}.
              </div>
            ) : null}
          </div>

          <div className="user-reserve-field">
            <label>Hora de Fin *</label>
            <select
              value={endTime || ""}
              onChange={(e) => {
                setMode("MANUAL");
                setEndTime(e.target.value);
              }}
              disabled={disabled || !endOptions?.length || mode === "HALF" || mode === "FULL"}
            >
              {!endSelectOptions?.length ? <option value="">—</option> : null}
              {endSelectOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            {mode === "HALF" || mode === "FULL" ? (
              <div style={{ marginTop: 6, fontSize: 12, opacity: 0.7 }}>
                La hora de fin se calcula automáticamente en {mode === "FULL" ? "día completo" : "medio día"}.
              </div>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="form-error" style={{ marginTop: 10 }}>
            {error}
          </div>
        ) : null}
        {warning ? <div className="reserve-time-hint">{warning}</div> : null}
      </div>
    </div>
  );
}