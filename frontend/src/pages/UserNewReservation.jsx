import DeskAvailability from '../components/DeskAvailability';
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import ClientLayout from "../portals/client/layout/ClientLayout";
import ReservationTimeFields from "../components/ReservationTimeFields";
import { getCurrentUser } from "../utils/auth";
import { buildStartTimeOptions, buildEndTimeOptions, minutesBetween } from "../utils/timeUtils";

/* ── helpers ── */
function pad2(n) { return String(n).padStart(2, "0"); }

function toHHMM(v) {
  if (!v) return "";
  if (typeof v === "string") {
    const m1 = v.match(/^(\d{2}:\d{2})/);
    if (m1) return m1[1];
    const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(v);
    if (hasTZ) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return v;
  }
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toYMD(dateLike) {
  if (!dateLike) return "";
  if (typeof dateLike === "string") {
    const hasTime = dateLike.includes("T");
    const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(dateLike);
    if (hasTime && hasTZ) {
      const d = new Date(dateLike);
      if (!Number.isNaN(d.getTime()))
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
    const m = dateLike.match(/^(\d{4}-\d{2}-\d{2})$/);
    if (m) return m[1];
    const d = new Date(dateLike);
    if (!Number.isNaN(d.getTime()))
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return "";
  }
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function nextBusinessDayYMD(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return toYMD(d);
}

function isValidHHMM(v) { return typeof v === "string" && /^\d{2}:\d{2}$/.test(v); }
function isSharedSpaceType(t) { return t === "FLEX_DESK" || t === "SHARED_TABLE"; }

/* ── component ── */
export default function UserNewReservation() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId    = params.get("edit");
  const modeParam = params.get("mode");
  const qDate  = params.get("date");
  const qStart = params.get("start");
  const qEnd   = params.get("end");
  const hasPrefillParams = Boolean(qDate || qStart || qEnd);

  const [detailMode, setDetailMode] = useState(() => Boolean(editId) && modeParam !== "edit");
  useEffect(() => { setDetailMode(Boolean(editId) && modeParam !== "edit"); }, [editId, modeParam]);

  const [deskIds, setDeskIds] = useState([]);
  const [assignedDesks, setAssignedDesks] = useState([]);
  const [deskAvailability, setDeskAvailability] = useState(null);
  const [deskRefresh, setDeskRefresh] = useState(0);
  const [spaces, setSpaces]                   = useState([]);
  const [loadingSpaces, setLoadingSpaces]     = useState(true);
  const [spacesError, setSpacesError]         = useState("");
  const [saving, setSaving]                   = useState(false);
  const [formError, setFormError]             = useState("");
  const [success, setSuccess]                 = useState("");
  const [spaceId, setSpaceId]                 = useState("");
  const [date, setDate]                       = useState(toYMD(new Date()));
  const [startTime, setStartTime]             = useState("09:00");
  const [endTime, setEndTime]                 = useState("10:00");
  const [attendees, setAttendees]             = useState(1);
  const [purpose, setPurpose]                 = useState("");
  const [notes, setNotes]                     = useState("");
  const [settings, setSettings]               = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [endTimeOptions, setEndTimeOptions]     = useState([]);
  const [timeError, setTimeError]               = useState("");
  const [timeWarning, setTimeWarning]           = useState("");
  const [timeEditable, setTimeEditable]         = useState(true);
  const [loadedStatus, setLoadedStatus]         = useState(null);
  const [loadedStartISO, setLoadedStartISO]     = useState(null);
  const [createLocked, setCreateLocked]         = useState(false);
  const [autoShiftedToNextDay, setAutoShiftedToNextDay] = useState(false);
  const [recurring, setRecurring]               = useState(false);
  const [repeat, setRepeat]                     = useState("WEEKLY");
  const [endRule, setEndRule]                   = useState("DATE");
  const [repeatEndDate, setRepeatEndDate]       = useState("");
  const [repeatCount, setRepeatCount]           = useState(4);
  const [loadedSeriesId, setLoadedSeriesId]     = useState(null);
  const [showApplyScopeModal, setShowApplyScopeModal] = useState(false);
  const [applyScope, setApplyScope]             = useState("ONE");
  const [pendingSubmitMode, setPendingSubmitMode] = useState(null);
  const [hourlyRateSnapshot, setHourlyRateSnapshot] = useState(null);
  const [originalStartTime, setOriginalStartTime]   = useState(null);

  const selectedSpace = useMemo(() => spaces.find((s) => String(s.id) === String(spaceId)) || null, [spaces, spaceId]);
  const shared = useMemo(() => (selectedSpace ? isSharedSpaceType(selectedSpace.type) : false), [selectedSpace]);

  const durationMinutes = useMemo(() => {
    const diff = minutesBetween(startTime, endTime);
    return Number.isFinite(diff) ? diff : 0;
  }, [startTime, endTime]);

  const durationHoursLabel = useMemo(() => {
    if (durationMinutes <= 0) return "—";
    const hours = durationMinutes / 60;
    return `${Number.isInteger(hours) ? hours : Math.round(hours * 10) / 10} horas`;
  }, [durationMinutes]);

  const isLoadedFuture = useMemo(() => {
    if (!editId || !date || !startTime) return false;
    const [hh, mm] = startTime.split(":").map(Number);
    const d = new Date(date);
    d.setHours(hh, mm, 0, 0);
    return d.getTime() > Date.now();
  }, [editId, date, startTime]);

  const canEditLoadedReservation = Boolean(editId) && loadedStatus === "ACTIVE" && isLoadedFuture;
  const readOnly = Boolean(editId) ? detailMode || !canEditLoadedReservation : false;
  const showEnableEdit = Boolean(editId) && detailMode && canEditLoadedReservation;
  const showNotEditableHint = Boolean(editId) && !canEditLoadedReservation;

  const recurrenceSummary = useMemo(() => {
    if (!recurring) return null;
    const patternLabel = repeat === "DAILY" ? "Diaria" : repeat === "MONTHLY" ? "Mismo día todos los meses" : "Mismo día todas las semanas";
    const endLabel = endRule === "COUNT"
      ? `${Math.max(1, Number(repeatCount || 1))} ocurrencias`
      : repeatEndDate ? `hasta ${repeatEndDate}` : "(sin fin)";
    return { patternLabel, endLabel };
  }, [recurring, repeat, endRule, repeatCount, repeatEndDate]);

  // Load spaces
  useEffect(() => {
    (async () => {
      try {
        setLoadingSpaces(true); setSpacesError("");
        const res = await api.get("/spaces/active");
        setSpaces(Array.isArray(res.data) ? res.data : []);
      } catch (e) { setSpacesError("No se pudieron cargar los espacios."); }
      finally { setLoadingSpaces(false); }
    })();
  }, []);

  // Load settings
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingSettings(true);
        const res = await api.get("/public/settings");
        const s = res?.data?.settings || res?.data || {};
        if (mounted) setSettings(s);
      } catch (e) { if (mounted) setSettings({}); }
      finally { if (mounted) setLoadingSettings(false); }
    })();
    return () => { mounted = false; };
  }, []);

  // Prefill from calendar
  useEffect(() => {
    if (editId || !hasPrefillParams) return;
    if (qDate) setDate(qDate);
    if (isValidHHMM(qStart)) setStartTime(qStart);
    if (isValidHHMM(qEnd)) setEndTime(qEnd);
  }, [editId]);

  // Load reservation for edit/detail
  useEffect(() => {
    if (!editId) return;
    (async () => {
      try {
        setFormError("");
        const res = await api.get(`/reservations/${editId}`);
        const r = res.data;
        setSpaceId(String(r.spaceId));
        setDate(toYMD(r.date));
        const st = toHHMM(r.startTime);
        const et = toHHMM(r.endTime);
        setStartTime(st); setEndTime(et);
        setLoadedStatus(r.status ?? null);
        const ymd = toYMD(r.date);
        setLoadedStartISO(st && /^\d{2}:\d{2}$/.test(st) ? `${ymd}T${st}:00` : `${ymd}T00:00:00`);
        setOriginalStartTime(st);
        setAttendees(Number(r.attendees ?? 1));
        setAssignedDesks(r.desks || []);
        setDeskIds((r.desks || []).map(d => d.deskId));
        setPurpose(r.purpose ?? "");
        setNotes(r.notes ?? "");
        setLoadedSeriesId(r.seriesId ?? null);
        setRecurring(Boolean(r.seriesId));
        setRepeat((r.recurrencePattern || "WEEKLY").toUpperCase());
        if (r.recurrenceEndDate) { setEndRule("DATE"); setRepeatEndDate(toYMD(r.recurrenceEndDate)); }
        else if (r.recurrenceCount) { setEndRule("COUNT"); setRepeatCount(Number(r.recurrenceCount) || 1); }
        else { setEndRule("DATE"); setRepeatEndDate(""); }
        setHourlyRateSnapshot(r.hourlyRateSnapshot ?? null);
      } catch (e) { setFormError("No se pudo cargar la reserva para editar."); }
    })();
  }, [editId]);

  // Default recurrence end date
  useEffect(() => {
    if (editId || !recurring || endRule !== "DATE" || repeatEndDate) return;
    const d = new Date(`${date}T00:00:00`);
    d.setMonth(d.getMonth() + 1);
    setRepeatEndDate(toYMD(d));
  }, [editId, recurring, endRule, repeatEndDate, date]);

  // Snapshot hourly rate for new reservations
  useEffect(() => {
    if (editId || !selectedSpace) return;
    setHourlyRateSnapshot(selectedSpace.hourlyRate ?? 0);
  }, [editId, selectedSpace]);

  useEffect(() => {
    if (!selectedSpace || !shared) setAttendees(1);
  }, [shared, selectedSpace]);

  // Build start time options
  useEffect(() => {
    if (!settings || !date) return;
    setTimeError(""); setTimeWarning(""); setTimeEditable(true);
    const result = buildStartTimeOptions({ mode: editId ? "edit" : "create", selectedDateYMD: date, now: new Date(), settings, originalStartTime: null });
    const opts = result.options || [];
    let finalOpts = opts;
    if (editId && startTime && /^\d{2}:\d{2}$/.test(startTime) && !opts.includes(startTime))
      finalOpts = [startTime, ...opts];
    setStartTimeOptions(finalOpts);
    setTimeEditable(!!result.editable);
    if (result.error) setTimeError(result.error);
    if (result.warning) setTimeWarning(result.warning);
    if (!editId) {
      if (finalOpts.length) { if (!finalOpts.includes(startTime)) setStartTime(finalOpts[0]); }
      else { setStartTime(""); setEndTime(""); }
    }
  }, [settings, date, editId]);

  // Auto shift to next business day
  useEffect(() => {
    if (editId || !settings || (hasPrefillParams && qDate) || autoShiftedToNextDay) return;
    const today = toYMD(new Date());
    if (date !== today) return;
    const result = buildStartTimeOptions({ mode: "create", selectedDateYMD: date, now: new Date(), settings });
    if (!result?.options?.length && result?.error && String(result.error).includes("Ya no es posible reservar para hoy")) {
      setDate(nextBusinessDayYMD(today));
      setAutoShiftedToNextDay(true);
    }
  }, [editId, settings, date, hasPrefillParams, qDate, autoShiftedToNextDay]);

  useEffect(() => {
    if (editId) { setCreateLocked(false); return; }
    setCreateLocked(date === toYMD(new Date()) && !timeEditable && !!timeError);
  }, [editId, date, timeEditable, timeError]);

  // Build end time options
  useEffect(() => {
    if (!settings || !startTime) { setEndTimeOptions([]); return; }
    const opts = buildEndTimeOptions({ startTime, settings });
    let finalOpts = opts;
    if (editId && endTime && /^\d{2}:\d{2}$/.test(endTime) && !opts.includes(endTime))
      finalOpts = [endTime, ...opts];
    setEndTimeOptions(finalOpts);
    if (!editId && finalOpts.length && !finalOpts.includes(endTime)) setEndTime(finalOpts[0]);
  }, [settings, startTime, editId]);

  async function submit() {
    if (success) return;
    setSuccess(""); setFormError("");
    if (!spaceId) return setFormError("Seleccioná un espacio.");
    if (!date) return setFormError("Seleccioná una fecha.");
    if (!startTime || !endTime) return setFormError("Seleccioná hora inicio/fin.");
    if (timeError) return setFormError(timeError);
    if (readOnly) return setFormError(detailMode ? 'Tocá "Editar" para habilitar cambios.' : "Esta reserva no puede modificarse.");
    if (minutesBetween(startTime, endTime) <= 0) return setFormError("La hora fin debe ser mayor a inicio.");
    if (editId && loadedSeriesId) { setPendingSubmitMode("UPDATE"); setApplyScope("ONE"); setShowApplyScopeModal(true); return; }
    await doSubmit("ONE");
  }

  async function doSubmit(scope) {
    try {
      setSaving(true);
      if (recurring) {
        if (!repeat) return setFormError("Seleccioná un patrón de recurrencia.");
        if (endRule === "DATE" && !repeatEndDate) return setFormError("Seleccioná una fecha de fin.");
        if (endRule === "COUNT") {
          const n = Number(repeatCount || 0);
          if (!Number.isInteger(n) || n < 1 || n > 100) return setFormError("La cantidad debe ser entre 1 y 100.");
        }
      }
      if (selectedSpace?.numberedDesks) {
        const currentKey = [selectedSpace.id,date,startTime,endTime,editId,deskRefresh].join('|');
        if (!deskAvailability || !deskAvailability.key.startsWith(currentKey + '|')) return setFormError('Esperá a que se actualice la disponibilidad de mesas.');
        if (deskAvailability.available < Number(attendees)) return setFormError('No hay suficientes mesas libres para todos los asistentes.');

      }
      const payload = {
        spaceId: Number(spaceId), date, startTime, endTime,
        attendees: Number(attendees || 1),
        purpose: purpose ? String(purpose).trim() : null,
        notes: notes ? String(notes).trim() : null,
      };
      if (recurring) {
        payload.recurrenceEnabled = true;
        payload.recurrencePattern = repeat;
        if (endRule === "DATE") payload.recurrenceEndDate = repeatEndDate;
        else payload.recurrenceCount = Math.max(1, Number(repeatCount || 1));
      }
      if (editId) {
        if (loadedSeriesId) payload.applyTo = scope;
        const response = await api.put(`/reservations/${editId}`, payload);
        const saved = response.data.first || response.data;
        setAssignedDesks(saved.desks || []);
        setSuccess('Reserva actualizada.' + (saved.desks?.length ? ' Mesas asignadas: ' + saved.desks.map(d => d.desk.number).join(', ') + '.' : ''));
      } else {
        const response = await api.post('/reservations', payload);
        const saved = response.data.first || response.data;
        setAssignedDesks(saved.desks || []);
        setSuccess((saved.status === 'PENDING' ? 'Reserva pendiente de aprobación.' : 'Reserva creada.') + (saved.desks?.length ? ' Mesas asignadas' + (response.data.first ? ' para la primera fecha' : '') + ': ' + saved.desks.map(d => d.desk.number).join(', ') + '.' : ''));
      }
      setTimeout(() => navigate("/user"), selectedSpace?.numberedDesks ? 4500 : 350);
    } catch (e) {
      setDeskRefresh(n => n+1);
      const data = e?.response?.data;
      setFormError(data?.message || data?.error || (typeof data === "string" ? data : null) || e?.message || "Error guardando reserva");
    } finally {
      setSaving(false);
    }
  }

  const timeFieldsDisabled = saving || loadingSettings || readOnly || (!editId && createLocked) || (!editId && !timeEditable && !!timeError);

  return (
    <ClientLayout user={user}>
      <div className="client-page">
        <div className="sn-reserve-wrapper">

          {/* Header */}
          <div className="sn-reserve-header">
            <button className="sn-back-btn" onClick={() => navigate("/user")} aria-label="Volver">←</button>
            <div>
              <h1 className="sn-reserve-title">
                {editId ? (readOnly ? "Detalle de reserva" : "Editar reserva") : "Nueva reserva"}
              </h1>
              <p className="sn-reserve-sub">
                {editId ? "Consulta el detalle de tu reserva" : "Creá una nueva reserva de espacio de coworking"}
              </p>
            </div>
          </div>

          {/* Alerts */}
          {spacesError && <div className="sn-alert sn-alert--error" style={{ marginBottom: '0.85rem' }}><strong>Error:</strong> {spacesError}</div>}
          {formError   && <div className="sn-alert sn-alert--error" style={{ marginBottom: '0.85rem' }}>{formError}</div>}
          {success     && <div className="sn-alert sn-alert--success" style={{ marginBottom: '0.85rem' }}>{success}</div>}

          {/* Edit mode banner */}
          {editId && (
            <div className="sn-card" style={{ marginBottom: '0.85rem', padding: '0.9rem 1.1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--sn-ink)' }}>
                    {detailMode ? "Modo detalle" : "Modo edición"}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: 'var(--sn-muted)', marginTop: '0.15rem' }}>
                    {showNotEditableHint
                      ? "Solo se pueden editar reservas ACTIVAS y futuras."
                      : detailMode ? "Podés habilitar la edición si la reserva cumple las reglas." : "Estás editando esta reserva."}
                  </div>
                </div>
                {showEnableEdit && (
                  <button className="sn-btn sn-btn--primary sn-btn--sm" type="button" onClick={() => setDetailMode(false)} disabled={saving}>
                    Habilitar edición
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Main card */}
          <div className="sn-card sn-reserve-card">
            <div className="sn-reserve-card-head">
              <div className="sn-reserve-card-title">Detalles de la reserva</div>
              <p className="sn-reserve-card-sub">
                {editId ? (detailMode ? "Revisá la información de la reserva." : "Modificá los datos de tu reserva.") : "Completá la información para crear tu reserva."}
              </p>
            </div>

            <div className="sn-form-grid">
              {/* Espacio */}
              <div className="sn-field full">
                <label className="sn-label">Espacio *</label>
                <select
                  className="sn-select"
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  disabled={loadingSpaces || saving || createLocked || readOnly}
                >
                  <option value="">{loadingSpaces ? "Cargando..." : "Seleccioná un espacio"}</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} · {s.capacity} persona(s)</option>
                  ))}
                </select>
                {selectedSpace && (
                  <div className="sn-space-info">
                    👥 Capacidad: <strong>{selectedSpace.capacity}</strong>
                    {selectedSpace.description && <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: 'var(--sn-muted)' }}>{selectedSpace.description}</p>}
                  </div>
                )}
              </div>

              {/* Fecha */}
              <div className="sn-field full">
                <label className="sn-label">Fecha *</label>
                <input
                  className="sn-input"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={Boolean(success) || saving || readOnly}
                />
              </div>

              {/* Horas */}
              <ReservationTimeFields
                startTime={startTime}
                endTime={endTime}
                setStartTime={setStartTime}
                setEndTime={setEndTime}
                disabled={timeFieldsDisabled}
                startOptions={startTimeOptions}
                endOptions={endTimeOptions}
                error={readOnly ? "" : timeError}
                warning={readOnly ? "" : timeWarning}
                halfDayMinutes={settings?.HALF_DAY_MINUTES}
              />

              {/* Recurrencia */}
              <div className="sn-field full">
                <div className="sn-recurrence-card">
                  <div className="sn-recurrence-head">
                    <div>
                      <div className="sn-recurrence-title">Reserva recurrente</div>
                      <div className="sn-recurrence-sub">Configurá una cita programada y repetida</div>
                    </div>
                    <label className="sn-toggle">
                      <input type="checkbox" checked={recurring} onChange={(e) => setRecurring(e.target.checked)} disabled={Boolean(success) || saving || readOnly} />
                      <span className="sn-toggle-slider" />
                    </label>
                  </div>

                  {recurring && (
                    <div className="sn-recurrence-body">
                      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '1.25rem', alignItems: 'start' }}>
                        {/* Patrón */}
                        <div>
                          <label className="sn-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Repetir</label>
                          <select
                            className="sn-select"
                            value={repeat}
                            onChange={(e) => setRepeat(e.target.value)}
                            disabled={Boolean(success) || saving || readOnly}
                          >
                            <option value="DAILY">Diaria</option>
                            <option value="WEEKLY">Mismo día todas las semanas</option>
                            <option value="MONTHLY">Mismo día todos los meses</option>
                          </select>
                        </div>

                        {/* Regla de fin */}
                        <div>
                          <label className="sn-label" style={{ marginBottom: '0.4rem', display: 'block' }}>Regla de fin</label>
                          <div style={{ display: 'grid', gap: '0.65rem' }}>
                            <label className={`sn-radio-card${endRule === "DATE" ? " sn-radio-card--selected" : ""}`}>
                              <input type="radio" name="endRule" checked={endRule === "DATE"} onChange={() => setEndRule("DATE")} disabled={Boolean(success) || saving || readOnly} />
                              <div>
                                <div className="sn-radio-title">Hasta una fecha</div>
                                <input
                                  className="sn-input"
                                  type="date"
                                  value={repeatEndDate}
                                  onChange={(e) => setRepeatEndDate(e.target.value)}
                                  disabled={Boolean(success) || saving || endRule !== "DATE" || readOnly}
                                  style={{ marginTop: '0.45rem' }}
                                />
                              </div>
                            </label>
                            <label className={`sn-radio-card${endRule === "COUNT" ? " sn-radio-card--selected" : ""}`}>
                              <input type="radio" name="endRule" checked={endRule === "COUNT"} onChange={() => setEndRule("COUNT")} disabled={Boolean(success) || saving || readOnly} />
                              <div>
                                <div className="sn-radio-title">Cantidad de ocurrencias</div>
                                <input
                                  className="sn-input"
                                  type="number" min={1} max={100}
                                  value={repeatCount}
                                  onChange={(e) => setRepeatCount(Number(e.target.value || 1))}
                                  disabled={Boolean(success) || saving || endRule !== "COUNT" || readOnly}
                                  style={{ marginTop: '0.45rem' }}
                                />
                              </div>
                            </label>
                          </div>
                        </div>
                      </div>

                      {recurrenceSummary && (
                        <div className="sn-recurrence-summary">
                          <div className="sn-recurrence-summary-row">
                            <div className="sn-recurrence-summary-item"><div className="k">Patrón</div><div className="v">{recurrenceSummary.patternLabel}</div></div>
                            <div className="sn-recurrence-summary-item"><div className="k">Inicio</div><div className="v">{date}</div></div>
                            <div className="sn-recurrence-summary-item"><div className="k">Fin</div><div className="v">{recurrenceSummary.endLabel}</div></div>
                          </div>
                          <div className="sn-recurrence-hint">Esta reserva se repetirá según la configuración seleccionada.</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Duración */}
              {durationMinutes > 0 && (
                <div className="sn-field full">
                  <div className="sn-pricing">
                    <div><div className="sn-pricing-label">Duración</div><div className="sn-pricing-value">{durationHoursLabel}</div></div>
                  </div>
                </div>
              )}

              <DeskAvailability space={selectedSpace} date={date} startTime={startTime} endTime={endTime} attendees={attendees} editId={editId} admin={false} deskIds={deskIds} onSelection={setDeskIds} readOnly={readOnly} assignedDesks={assignedDesks} onAvailability={setDeskAvailability} refreshKey={deskRefresh} recurring={recurring || Boolean(loadedSeriesId)} />
              {/* Asistentes */}
              <div className="sn-field full">
                <label className="sn-label">Número de asistentes</label>
                <input
                  className="sn-input"
                  type="number" min={1}
                  value={attendees}
                  onChange={(e) => setAttendees(Number(e.target.value || 1))}
                  disabled={Boolean(success) || saving || !shared || readOnly || createLocked}
                />
                <div className="sn-help" style={{ marginTop: '0.3rem' }}>
                  {shared ? "En espacios compartidos podés indicar cuántos asistentes ocupan cupo." : "En espacios no compartidos, siempre es 1."}
                </div>
              </div>

              {/* Propósito */}
              <div className="sn-field full">
                <label className="sn-label">Propósito / Motivo</label>
                <input
                  className="sn-input"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="ej. Reunión de equipo, Presentación a cliente"
                  disabled={Boolean(success) || saving || readOnly}
                />
              </div>

              {/* Notas */}
              <div className="sn-field full">
                <label className="sn-label">Notas adicionales</label>
                <textarea
                  className="sn-textarea"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Algún requerimiento especial o nota..."
                  disabled={Boolean(success) || saving || readOnly}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="sn-reserve-footer">
              <button className="sn-btn sn-btn--outline" onClick={() => navigate("/user")} disabled={saving}>
                {editId ? "Volver" : "Cancelar"}
              </button>
              {showEnableEdit && (
                <button className="sn-btn sn-btn--outline" type="button" onClick={() => { setFormError(""); setDetailMode(false); }} disabled={saving}>
                  Editar
                </button>
              )}
              {!readOnly && (
                <button
                  className="sn-btn sn-btn--primary"
                  onClick={submit}
                  disabled={Boolean(success) || saving || loadingSpaces || loadingSettings || !!timeError || createLocked}
                >
                  {saving ? "Guardando…" : editId ? "Guardar cambios" : "Crear reserva"}
                </button>
              )}
            </div>
          </div>

        </div>

        {/* Modal scope */}
        {showApplyScopeModal && (
          <div className="sn-modal-overlay" onClick={() => { setShowApplyScopeModal(false); setPendingSubmitMode(null); }}>
            <div className="sn-modal" onClick={(e) => e.stopPropagation()}>
              <div className="sn-modal-title">Aplicar cambios</div>
              <div className="sn-modal-subtitle">Esta reserva es recurrente. ¿A qué ocurrencias querés aplicar los cambios?</div>

              <div style={{ display: 'grid', gap: '0.65rem' }}>
                <label className={`sn-radio-card${applyScope === "ONE" ? " sn-radio-card--selected" : ""}`}>
                  <input type="radio" name="applyScope" value="ONE" checked={applyScope === "ONE"} onChange={() => setApplyScope("ONE")} />
                  <div><div className="sn-radio-title">Solo esta cita</div><div className="sn-radio-desc">Modifica únicamente la reserva seleccionada.</div></div>
                </label>
                <label className={`sn-radio-card${applyScope === "SERIES" ? " sn-radio-card--selected" : ""}`}>
                  <input type="radio" name="applyScope" value="SERIES" checked={applyScope === "SERIES"} onChange={() => setApplyScope("SERIES")} />
                  <div><div className="sn-radio-title">Esta y las siguientes</div><div className="sn-radio-desc">Aplica el cambio desde esta ocurrencia en adelante.</div></div>
                </label>
              </div>

              <div className="sn-modal-footer">
                <button className="sn-btn sn-btn--outline" onClick={() => { setShowApplyScopeModal(false); setPendingSubmitMode(null); }}>Cancelar</button>
                <button className="sn-btn sn-btn--primary" onClick={() => { setShowApplyScopeModal(false); if (pendingSubmitMode === "UPDATE") doSubmit(applyScope); setPendingSubmitMode(null); }}>
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ClientLayout>
  );
}
