import { useMemo, useState, useEffect } from "react";
import { hhmmToMinutes, minutesToHHMM, pickClosestEndOption } from "../utils/timeUtils";

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

  // Si cambian opciones y el valor actual no existe, corregimos (defensivo)
  useEffect(() => {
    if (!startOptions?.length) return;
    const allowed = mode === "HALF" && halfDayStarts.length ? halfDayStarts : startOptions;
    if (startTime && allowed.includes(startTime)) return;
    setStartTime(allowed[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOptions, mode, halfDayStarts]);

  useEffect(() => {
    if (!endOptions?.length) return;
    if (endTime && endOptions.includes(endTime)) return;
    setEndTime(endOptions[0]);
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

  const startSelectOptions = mode === "HALF" && halfDayStarts.length ? halfDayStarts : startOptions;

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
              {!endOptions?.length ? <option value="">—</option> : null}
              {endOptions.map((t) => (
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
