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

  // Si cambian opciones y el valor actual no existe, corregimos (defensivo)
  useEffect(() => {
    if (!startOptions?.length) return;
    if (startTime && startOptions.includes(startTime)) return;
    setStartTime(startOptions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startOptions]);

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

  const handleMode = (next) => {
    if (disabled) return;
    setMode(next);

    if (!startOptions?.length) return;

    if (next === "FULL") {
      const st = startOptions[0];
      setStartTime(st);
      // en full day: queremos el último end posible
      if (endOptions?.length) {
        setEndTime(endOptions[endOptions.length - 1]);
      }
      return;
    }

    if (next === "HALF") {
      // medio día: fin = start + halfDayMinutes (si existe), sino el más cercano posible
      const st = startTime && startOptions.includes(startTime) ? startTime : startOptions[0];
      setStartTime(st);

      if (endOptions?.length) {
        const target = minutesToHHMM(hhmmToMinutes(st) + Number(halfDayMinutes || 300));
        const picked = pickClosestEndOption(endOptions, target);
        setEndTime(picked || endOptions[0]);
      }
      return;
    }

    // MANUAL: no toca horas
  };

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
                setMode("MANUAL");
                setStartTime(e.target.value);
              }}
              disabled={disabled || !startOptions?.length}
            >
              {!startOptions?.length ? <option value="">—</option> : null}
              {startOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          <div className="user-reserve-field">
            <label>Hora de Fin *</label>
            <select
              value={endTime || ""}
              onChange={(e) => {
                setMode("MANUAL");
                setEndTime(e.target.value);
              }}
              disabled={disabled || !endOptions?.length}
            >
              {!endOptions?.length ? <option value="">—</option> : null}
              {endOptions.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        </div>

        {error ? <div className="form-error" style={{ marginTop: 10 }}>{error}</div> : null}
        {warning ? <div className="reserve-time-hint">{warning}</div> : null}
      </div>
    </div>
  );
}
