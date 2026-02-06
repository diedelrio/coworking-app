import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import Header from "../components/Header";
import ReservationTimeFields from "../components/ReservationTimeFields";
import { getCurrentUser } from "../utils/auth";
import {
  buildStartTimeOptions,
  buildEndTimeOptions,
  minutesBetween,
} from "../utils/timeUtils";

function pad2(n) {
  return String(n).padStart(2, "0");
}

/**
 * Convierte cualquier formato razonable a "HH:MM" SIN aplicar timezone:
 * - "09:00" -> "09:00"
 * - "09:00:00" -> "09:00"
 * - "2026-02-06T09:00:00.000Z" -> "09:00"   (extrae del string, NO new Date())
 * - Date/number -> usa getHours/getMinutes
 */
function toHHMM(v) {
  if (!v) return "";

  if (typeof v === "string") {
    // 1) "HH:MM" o "HH:MM:SS" (ya es hora local de negocio)
    const m1 = v.match(/^(\d{2}:\d{2})/);
    if (m1) return m1[1];

    // 2) ISO con zona horaria (Z o ±HH:MM) -> convertir a hora local del navegador
    // Ej: "2026-02-10T16:00:00.000Z" o "2026-02-10T16:00:00+00:00"
    const hasTZ = /[zZ]|[+\-]\d{2}:\d{2}$/.test(v);
    if (hasTZ) {
      const d = new Date(v);
      if (!Number.isNaN(d.getTime())) {
        return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
      }
    }

    // 3) ISO sin TZ o formatos raros: último intento (no recomendado pero evita romper)
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) {
      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    }

    return v;
  }

  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return "";
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}


/**
 * Convierte cualquier formato razonable a "YYYY-MM-DD" sin corrimientos por TZ:
 * - "2026-02-06" -> "2026-02-06"
 * - "2026-02-06T00:00:00.000Z" -> "2026-02-06" (extrae string)
 * - Date/number -> yyyy-mm-dd con Date local
 */
function toYMD(dateLike) {
  if (!dateLike) return "";

  if (typeof dateLike === "string") {
    const m = dateLike.match(/^(\d{4}-\d{2}-\d{2})/);
    if (m) return m[1];
  }

  const d = new Date(dateLike);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function nextBusinessDayYMD(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  // 0=Sun,6=Sat
  do {
    d.setDate(d.getDate() + 1);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return toYMD(d);
}

function isValidHHMM(v) {
  return typeof v === "string" && /^\d{2}:\d{2}$/.test(v);
}
function formatEUR(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(num);
}

function isSharedSpaceType(spaceType) {
  return spaceType === "FLEX_DESK" || spaceType === "SHARED_TABLE";
}

export default function UserNewReservation() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit");
  const modeParam = params.get("mode"); // "edit" | null
  // Desde la lista (Ver detalles) abrimos en modo lectura por defecto.
  const [detailMode, setDetailMode] = useState(
    () => Boolean(editId) && modeParam !== "edit"
  );

  useEffect(() => {
    setDetailMode(Boolean(editId) && modeParam !== "edit");
  }, [editId, modeParam]);

  const qDate = params.get("date");
  const qStart = params.get("start");
  const qEnd = params.get("end");
  const hasPrefillParams = Boolean(qDate || qStart || qEnd);

  const [spaces, setSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [spacesError, setSpacesError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  // settings (para combos de horas)
  const [settings, setSettings] = useState(null);
  const [loadingSettings, setLoadingSettings] = useState(true);

  // time options + flags UX
  const [startTimeOptions, setStartTimeOptions] = useState([]);
  const [endTimeOptions, setEndTimeOptions] = useState([]);
  const [timeError, setTimeError] = useState("");
  const [timeWarning, setTimeWarning] = useState("");
  const [timeEditable, setTimeEditable] = useState(true);

  // Meta de la reserva cargada (para decidir si se puede editar desde "detalles")
  const [loadedStatus, setLoadedStatus] = useState(null);
  const [loadedStartISO, setLoadedStartISO] = useState(null);

  const [createLocked, setCreateLocked] = useState(false);
  const [autoShiftedToNextDay, setAutoShiftedToNextDay] = useState(false);

  const isLoadedFuture = useMemo(() => {
    if (!loadedStartISO) return false;
    const t = new Date(loadedStartISO).getTime();
    return Number.isFinite(t) && t > Date.now();
  }, [loadedStartISO]);

  // Para habilitar edición desde "detalle" SOLO depende de reglas de negocio de la reserva cargada.
  // No lo atamos a `timeEditable` porque ese flag está pensado para bloquear la creación cuando
  // el usuario elige HOY y ya no hay horarios; en modo detalle queremos poder abrir y, si corresponde,
  // habilitar edición.
  const canEditLoadedReservation =
    Boolean(editId) && loadedStatus === "ACTIVE" && isLoadedFuture;
  const readOnly = Boolean(editId)
    ? detailMode || !canEditLoadedReservation
    : false;
  const showEnableEdit =
    Boolean(editId) && detailMode && canEditLoadedReservation;
  const showNotEditableHint = Boolean(editId) && !canEditLoadedReservation;

  // form
  const [spaceId, setSpaceId] = useState("");
  const [date, setDate] = useState(toYMD(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendees, setAttendees] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  // recurrencia
  const [recurring, setRecurring] = useState(false);
  const [repeat, setRepeat] = useState("WEEKLY"); // DAILY | WEEKLY | MONTHLY
  const [endRule, setEndRule] = useState("DATE"); // DATE | COUNT
  const [repeatEndDate, setRepeatEndDate] = useState("");
  const [repeatCount, setRepeatCount] = useState(4);

  const [loadedSeriesId, setLoadedSeriesId] = useState(null);

  // ---- edición de recurrencias (aplicar cambios) ----
  const [showApplyScopeModal, setShowApplyScopeModal] = useState(false);
  const [applyScope, setApplyScope] = useState("ONE"); // ONE | SERIES
  const [pendingSubmitMode, setPendingSubmitMode] = useState(null); // UPDATE

  // pricing snapshot para UI (en edit se congela)
  const [hourlyRateSnapshot, setHourlyRateSnapshot] = useState(null);

  // para edición: la hora original (NO se usa para limitar el combo)
  const [originalStartTime, setOriginalStartTime] = useState(null);

  const selectedSpace = useMemo(
    () => spaces.find((s) => String(s.id) === String(spaceId)) || null,
    [spaces, spaceId]
  );

  const shared = useMemo(
    () => (selectedSpace ? isSharedSpaceType(selectedSpace.type) : false),
    [selectedSpace]
  );

  // duration + total (UI)
  const durationMinutes = useMemo(() => {
    const diff = minutesBetween(startTime, endTime);
    return Number.isFinite(diff) ? diff : 0;
  }, [startTime, endTime]);

  const durationHoursLabel = useMemo(() => {
    if (durationMinutes <= 0) return "—";
    const hours = durationMinutes / 60;
    const pretty = Number.isInteger(hours)
      ? String(hours)
      : String(Math.round(hours * 10) / 10);
    return `${pretty} horas`;
  }, [durationMinutes]);

  const totalAmount = useMemo(() => {
    const rate =
      hourlyRateSnapshot != null
        ? Number(hourlyRateSnapshot)
        : selectedSpace?.hourlyRate != null
        ? Number(selectedSpace.hourlyRate)
        : 0;

    const hours = Math.max(0, durationMinutes) / 60;
    const qty = shared ? Math.max(1, Number(attendees || 1)) : 1;
    return rate * hours * qty;
  }, [hourlyRateSnapshot, selectedSpace, durationMinutes, attendees, shared]);

  // ---- styles inline para dejar la UI alineada aunque el CSS global varíe ----
  const recurStyles = useMemo(
    () => ({
      grid: {
        display: "grid",
        gridTemplateColumns: "1.2fr 1fr",
        gap: 24,
        alignItems: "start",
      },
      blockTitle: { margin: 0, fontSize: 13, fontWeight: 800 },
      optionList: { display: "grid", gap: 12, marginTop: 10 },
      optionCard: (selected) => ({
        display: "grid",
        gridTemplateColumns: "24px 1fr",
        gap: 10,
        padding: 12,
        borderRadius: 14,
        border: selected ? "1px solid #b9ccff" : "1px solid #e6e9ef",
        background: selected ? "#f3f7ff" : "#fafbfc",
      }),
      optionTitle: {
        fontWeight: 700,
        fontSize: 13,
        color: "#2a2f3a",
        marginBottom: 8,
      },
      input: {
        width: "100%",
        height: 40,
        padding: "8px 10px",
        borderRadius: 12,
        border: "1px solid #e6e9ef",
        background: "#fff",
      },
      labelMuted: { color: "#5b6472", fontSize: 12, marginTop: 4 },
    }),
    []
  );

  // cargar spaces
  useEffect(() => {
    (async () => {
      try {
        setLoadingSpaces(true);
        setSpacesError("");
        const res = await api.get("/spaces/active");
        setSpaces(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        console.error(e);
        setSpacesError("No se pudieron cargar los espacios.");
      } finally {
        setLoadingSpaces(false);
      }
    })();
  }, []);

  // cargar settings públicos (horarios + reglas)
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoadingSettings(true);
        const res = await api.get("/public/settings");
        // backend suele devolver { settings: {...} }
        const s = res?.data?.settings || res?.data || {};
        if (mounted) setSettings(s);
      } catch (e) {
        console.error(e);
        if (mounted) setSettings({});
      } finally {
        if (mounted) setLoadingSettings(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Prefill desde calendario (BUG-0004): /user/reservar?date=YYYY-MM-DD&start=HH:MM&end=HH:MM
  useEffect(() => {
    if (editId) return;
    if (!hasPrefillParams) return;

    if (qDate) setDate(qDate);
    if (isValidHHMM(qStart)) setStartTime(qStart);
    if (isValidHHMM(qEnd)) setEndTime(qEnd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId]);

  // cargar reserva si edit
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
        setStartTime(st);
        setEndTime(et);

        // ✅ Para reglas de edición desde "detalle"
        setLoadedStatus(r.status ?? null);
        // Construimos un datetime local (suficiente para comparar contra Date.now())
        const ymd = toYMD(r.date);
        if (st && /^\d{2}:\d{2}$/.test(st)) {
          setLoadedStartISO(`${ymd}T${st}:00`);
        } else {
          setLoadedStartISO(`${ymd}T00:00:00`);
        }

        // guardamos la original por si la querés para algo, pero NO limitamos el combo
        setOriginalStartTime(st);

        setAttendees(Number(r.attendees ?? 1));
        setPurpose(r.purpose ?? "");
        setNotes(r.notes ?? "");

        // recurrencia
        setLoadedSeriesId(r.seriesId ?? null);
        setRecurring(Boolean(r.seriesId));
        setRepeat((r.recurrencePattern || "WEEKLY").toUpperCase());
        if (r.recurrenceEndDate) {
          setEndRule("DATE");
          setRepeatEndDate(toYMD(r.recurrenceEndDate));
        } else if (r.recurrenceCount) {
          setEndRule("COUNT");
          setRepeatCount(Number(r.recurrenceCount) || 1);
        } else {
          setEndRule("DATE");
          setRepeatEndDate("");
        }

        // congelar precio aplicado
        setHourlyRateSnapshot(r.hourlyRateSnapshot ?? null);
      } catch (e) {
        console.error(e);
        setFormError("No se pudo cargar la reserva para editar.");
      }
    })();
  }, [editId]);

  // defaults recurrencia al cambiar fecha (solo create)
  useEffect(() => {
    if (editId) return;
    if (!recurring) return;
    if (endRule !== "DATE") return;
    if (repeatEndDate) return;

    const d = new Date(`${date}T00:00:00`);
    d.setMonth(d.getMonth() + 1);
    setRepeatEndDate(toYMD(d));
  }, [editId, recurring, endRule, repeatEndDate, date]);

  const recurrenceSummary = useMemo(() => {
    if (!recurring) return null;

    const patternLabel =
      repeat === "DAILY"
        ? "Diaria"
        : repeat === "MONTHLY"
        ? "Mismo día todos los meses"
        : "Mismo día todas las semanas";

    const endLabel =
      endRule === "COUNT"
        ? `${Math.max(1, Number(repeatCount || 1))} ocurrencias`
        : repeatEndDate
        ? `hasta ${repeatEndDate}`
        : "(sin fin)";

    return { patternLabel, endLabel };
  }, [recurring, repeat, endRule, repeatCount, repeatEndDate]);

  // en create: al elegir espacio, setear snapshot SOLO para UI
  useEffect(() => {
    if (editId) return;
    if (!selectedSpace) return;
    setHourlyRateSnapshot(selectedSpace.hourlyRate ?? 0);
  }, [editId, selectedSpace]);

  // si no es shared, forzar attendees = 1
  useEffect(() => {
    if (!selectedSpace) return;
    if (!shared) setAttendees(1);
  }, [shared, selectedSpace]);

  // ===== construir combos de horas (inicio/fin) =====
  useEffect(() => {
    if (!settings || !date) return;

    setTimeError("");
    setTimeWarning("");
    setTimeEditable(true);

    const result = buildStartTimeOptions({
      mode: editId ? "edit" : "create",
      selectedDateYMD: date,
      now: new Date(),
      settings,
      // ✅ IMPORTANTE: en edición NO limitar por hora original.
      // Si es día futuro, debe permitir cambiar 16 -> 10.
      originalStartTime: null,
    });

    const opts = result.options || [];

    // ✅ En edición: NO pisar el valor cargado.
    // Si no está en la lista (cambió grilla, etc.), lo agregamos para que el <select> lo muestre.
    let finalOpts = opts;
    if (
      editId &&
      startTime &&
      /^\d{2}:\d{2}$/.test(startTime) &&
      !opts.includes(startTime)
    ) {
      finalOpts = [startTime, ...opts];
    }

    setStartTimeOptions(finalOpts);
    setTimeEditable(!!result.editable);

    if (result.error) setTimeError(result.error);
    if (result.warning) setTimeWarning(result.warning);

    // ✅ Solo en CREATE hacemos auto-ajuste
    if (!editId) {
      if (finalOpts.length) {
        if (!finalOpts.includes(startTime)) setStartTime(finalOpts[0]);
      } else {
        // no hay opciones: limpiamos para evitar submit accidental
        setStartTime("");
        setEndTime("");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, date, editId]);

  // ✅ BUG-0003 (1): si al abrir el formulario es imposible reservar hoy (fuera de horario),
  // setear automáticamente el próximo día laboral (solo en create y si NO vino una fecha por query).
  useEffect(() => {
    if (editId) return;
    if (!settings) return;
    if (hasPrefillParams && qDate) return;
    if (autoShiftedToNextDay) return;

    const today = toYMD(new Date());
    if (date !== today) return;

    const result = buildStartTimeOptions({
      mode: "create",
      selectedDateYMD: date,
      now: new Date(),
      settings,
    });

    if (
      !result?.options?.length &&
      result?.error &&
      String(result.error).includes("Ya no es posible reservar para hoy")
    ) {
      setDate(nextBusinessDayYMD(today));
      setAutoShiftedToNextDay(true);
    }
  }, [editId, settings, date, hasPrefillParams, qDate, autoShiftedToNextDay]);

  // ✅ BUG-0003 (1): si el usuario selecciona manualmente HOY y ya no hay horarios,
  // dejar en readonly todo excepto la fecha (para que pueda elegir otra).
  useEffect(() => {
    if (editId) {
      setCreateLocked(false);
      return;
    }
    const today = toYMD(new Date());
    const lock = date === today && !timeEditable && !!timeError;
    setCreateLocked(lock);
  }, [editId, date, timeEditable, timeError]);

  useEffect(() => {
    if (!settings || !startTime) {
      setEndTimeOptions([]);
      return;
    }

    const opts = buildEndTimeOptions({ startTime, settings });

    // ✅ En edición: NO pisar endTime cargado; si falta en opciones, lo agregamos.
    let finalOpts = opts;
    if (
      editId &&
      endTime &&
      /^\d{2}:\d{2}$/.test(endTime) &&
      !opts.includes(endTime)
    ) {
      finalOpts = [endTime, ...opts];
    }

    setEndTimeOptions(finalOpts);

    // ✅ Solo en CREATE ajustamos
    if (!editId && finalOpts.length && !finalOpts.includes(endTime)) {
      setEndTime(finalOpts[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings, startTime, editId]);

  async function submit() {
    setSuccess("");
    setFormError("");

    if (!spaceId) return setFormError("Seleccioná un espacio.");
    if (!date) return setFormError("Seleccioná una fecha.");
    if (!startTime || !endTime)
      return setFormError("Seleccioná hora inicio/fin.");

    if (timeError) return setFormError(timeError);
    if (readOnly) {
      return setFormError(
        detailMode
          ? 'Esta reserva está en modo solo lectura. Tocá "Editar" para habilitar cambios (si está permitido).'
          : "Esta reserva no puede modificarse por las reglas de negocio."
      );
    }

    if (minutesBetween(startTime, endTime) <= 0) {
      return setFormError("La hora fin debe ser mayor a inicio.");
    }

    // En edición de una reserva recurrente: preguntar alcance (ONE vs SERIES)
    if (editId && loadedSeriesId) {
      setPendingSubmitMode("UPDATE");
      setApplyScope("ONE");
      setShowApplyScopeModal(true);
      return;
    }

    await doSubmit("ONE");
  }

  async function doSubmit(scope) {
    try {
      setSaving(true);

      if (recurring) {
        if (!repeat) return setFormError("Seleccioná un patrón de recurrencia.");
        if (endRule === "DATE") {
          if (!repeatEndDate)
            return setFormError(
              "Seleccioná una fecha de fin para la recurrencia."
            );
        } else {
          const n = Number(repeatCount || 0);
          if (!Number.isInteger(n) || n < 1 || n > 100) {
            return setFormError(
              "La cantidad de ocurrencias debe ser un número entre 1 y 100."
            );
          }
        }
      }

      const payload = {
        spaceId: Number(spaceId),
        date,
        startTime,
        endTime,
        attendees: Number(attendees || 1),
        purpose: purpose ? String(purpose).trim() : null,
        notes: notes ? String(notes).trim() : null,
      };

      if (recurring) {
        payload.recurrenceEnabled = true;
        payload.recurrencePattern = repeat; // DAILY | WEEKLY | MONTHLY
        if (endRule === "DATE") {
          payload.recurrenceEndDate = repeatEndDate;
        } else {
          payload.recurrenceCount = Math.max(1, Number(repeatCount || 1));
        }
      }

      if (editId) {
        if (loadedSeriesId) payload.applyTo = scope; // ONE | SERIES
        await api.put(`/reservations/${editId}`, payload);
        setSuccess("Reserva actualizada.");
      } else {
        await api.post("/reservations", payload);
        setSuccess("Reserva creada.");
      }

      setTimeout(() => navigate("/user"), 350);
    } catch (e) {
      console.error(e);
      const status = e?.response?.status;
      const data = e?.response?.data;
      const msg =
        data?.message ||
        data?.error ||
        (typeof data === "string" ? data : null) ||
        e?.message ||
        `Error guardando reserva (HTTP ${status || "?"})`;

      setFormError(msg);
    } finally {
      setSaving(false);
    }
  }

  function onConfirmApplyScope() {
    setShowApplyScopeModal(false);
    if (pendingSubmitMode === "UPDATE") {
      doSubmit(applyScope);
    }
    setPendingSubmitMode(null);
  }

  function onCancelApplyScope() {
    setShowApplyScopeModal(false);
    setPendingSubmitMode(null);
  }

  const timeFieldsDisabled =
    saving ||
    loadingSettings ||
    readOnly ||
    (!editId && createLocked) ||
    (!editId && !timeEditable && !!timeError);

  return (
    <div>
      <Header user={user} />

      <div className="page-container">
        <div className="dashboard-container">
          {/* Header tipo mock */}
          <div className="user-reserve-header-wrap">
            <div className="user-reserve-header">
              <button
                className="user-reserve-back"
                onClick={() => navigate("/user")}
              >
                ←
              </button>

              <div className="user-reserve-title">
                <h1>
                  {editId
                    ? readOnly
                      ? "Detalle de Reserva"
                      : "Editar Reserva"
                    : "Nueva Reserva"}
                </h1>
                <p>
                  {editId
                    ? "Consulta el detalle de tu reserva"
                    : "Crea una nueva reserva de espacio de coworking"}
                </p>
              </div>
            </div>
          </div>

          {spacesError ? (
            <div
              className="form-error"
              style={{ maxWidth: 860, margin: "0 auto 12px" }}
            >
              <b>Error</b>
              <div>{spacesError}</div>
            </div>
          ) : null}

          {formError ? (
            <div
              className="form-error"
              style={{ maxWidth: 860, margin: "0 auto 12px" }}
            >
              {formError}
            </div>
          ) : null}

          {editId ? (
            <div
              className="admin-card"
              style={{ maxWidth: 860, margin: "0 auto 12px", padding: 14 }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ display: "grid", gap: 4 }}>
                  <div style={{ fontWeight: 900 }}>
                    {detailMode ? "Modo detalle" : "Modo edición"}
                  </div>
                  {showNotEditableHint ? (
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      Esta reserva no se puede editar (solo reservas <b>ACTIVAS</b>{" "}
                      y <b>futuras</b>).
                    </div>
                  ) : (
                    <div style={{ opacity: 0.8, fontSize: 13 }}>
                      {detailMode
                        ? "Podés habilitar la edición si la reserva cumple las reglas de negocio."
                        : "Estás editando esta reserva."}
                    </div>
                  )}
                </div>

                {showEnableEdit ? (
                  <button
                    type="button"
                    className="pill-button"
                    onClick={() => setDetailMode(false)}
                    disabled={saving}
                  >
                    Habilitar edición
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}

          {success ? (
            <div
              className="success"
              style={{ maxWidth: 860, margin: "0 auto 12px" }}
            >
              {success}
            </div>
          ) : null}

          {/* Card central */}
          <div className="user-reserve-card">
            <div className="user-reserve-card-head">
              <div className="title">Detalles de la Reserva</div>
              <p className="sub">
                {editId
                  ? detailMode
                    ? "Revisa la información de la reserva seleccionada."
                    : "Modificá los datos de tu reserva."
                  : "Completa la información a continuación para crear tu reserva"}
              </p>
            </div>

            <div className="user-reserve-grid">
              {/* Espacio */}
              <div className="user-reserve-field full">
                <label>Espacio *</label>
                <select
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  disabled={loadingSpaces || saving || createLocked || readOnly}
                >
                  <option value="">
                    {loadingSpaces ? "Cargando..." : "Seleccioná un espacio"}
                  </option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} • {formatEUR(s.hourlyRate)} / hora •{" "}
                      {s.capacity} persona(s)
                    </option>
                  ))}
                </select>

                {selectedSpace ? (
                  <div className="space-info-card">
                    <div className="space-info-row">
                      <span>👥 Capacidad: {selectedSpace.capacity}</span>
                      <span>💶 {formatEUR(selectedSpace.hourlyRate)} / hora</span>
                    </div>
                    {selectedSpace.description ? (
                      <p className="space-info-desc">
                        {selectedSpace.description}
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* Fecha */}
              <div className="user-reserve-field full">
                <label>Fecha *</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  disabled={saving || readOnly}
                />
              </div>

              {/* Hora inicio / fin */}
              <ReservationTimeFields
                startTime={startTime}
                endTime={endTime}
                setStartTime={setStartTime}
                setEndTime={setEndTime}
                disabled={timeFieldsDisabled}
                // ✅ nuevos props (ver patch del componente)
                startOptions={startTimeOptions}
                endOptions={endTimeOptions}
                // En modo detalle (solo lectura) NO mostramos errores/advertencias de edición/creación.
                error={readOnly ? "" : timeError}
                warning={readOnly ? "" : timeWarning}
                halfDayMinutes={settings?.HALF_DAY_MINUTES}
              />

              {/* Recurrencia */}
              <div className="user-reserve-field full">
                <div className="recurrence-card">
                  <div className="recurrence-head">
                    <div>
                      <div className="title">Haz recurrente tu reserva</div>
                      <div className="sub">
                        Configura una cita recurrente y programada para esta
                        reserva
                      </div>
                    </div>
                    <label className="toggle-switch" title="Activar recurrencia">
                      <input
                        type="checkbox"
                        checked={recurring}
                        onChange={(e) => setRecurring(e.target.checked)}
                        disabled={saving || readOnly}
                      />
                      <span className="toggle-slider" />
                    </label>
                  </div>

                  {recurring ? (
                    <div className="recurrence-body">
                      <div style={recurStyles.grid}>
                        {/* Izquierda: Repetir */}
                        <div>
                          <div style={recurStyles.blockTitle}>Repetir</div>
                          <div style={recurStyles.labelMuted}>
                            Elige el patrón de recurrencia
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <select
                              value={repeat}
                              onChange={(e) => setRepeat(e.target.value)}
                              disabled={saving || readOnly}
                              style={recurStyles.input}
                            >
                              <option value="DAILY">Diaria</option>
                              <option value="WEEKLY">
                                Mismo día todas las semanas
                              </option>
                              <option value="MONTHLY">
                                Mismo día todos los meses
                              </option>
                            </select>
                          </div>
                        </div>

                        {/* Derecha: Regla de fin */}
                        <div>
                          <div style={recurStyles.blockTitle}>Regla de fin</div>
                          <div style={recurStyles.labelMuted}>
                            Define cuándo finaliza la recurrencia
                          </div>

                          <div style={recurStyles.optionList}>
                            <div style={recurStyles.optionCard(endRule === "DATE")}>
                              <input
                                type="radio"
                                name="endRule"
                                checked={endRule === "DATE"}
                                onChange={() => setEndRule("DATE")}
                                disabled={saving || readOnly}
                                style={{ marginTop: 3 }}
                              />
                              <div>
                                <div style={recurStyles.optionTitle}>
                                  Hasta una fecha
                                </div>
                                <input
                                  type="date"
                                  value={repeatEndDate}
                                  onChange={(e) =>
                                    setRepeatEndDate(e.target.value)
                                  }
                                  disabled={saving || endRule !== "DATE" || readOnly}
                                  style={recurStyles.input}
                                />
                              </div>
                            </div>

                            <div style={recurStyles.optionCard(endRule === "COUNT")}>
                              <input
                                type="radio"
                                name="endRule"
                                checked={endRule === "COUNT"}
                                onChange={() => setEndRule("COUNT")}
                                disabled={saving || readOnly}
                                style={{ marginTop: 3 }}
                              />
                              <div>
                                <div style={recurStyles.optionTitle}>
                                  Cantidad de ocurrencias
                                </div>
                                <input
                                  type="number"
                                  min={1}
                                  max={100}
                                  value={repeatCount}
                                  onChange={(e) =>
                                    setRepeatCount(Number(e.target.value || 1))
                                  }
                                  disabled={saving || endRule !== "COUNT" || readOnly}
                                  style={recurStyles.input}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {recurrenceSummary ? (
                        <div className="recurrence-summary">
                          <div className="row">
                            <div>
                              <div className="k">Patrón</div>
                              <div className="v">
                                {recurrenceSummary.patternLabel}
                              </div>
                            </div>
                            <div>
                              <div className="k">Inicio</div>
                              <div className="v">{date}</div>
                            </div>
                            <div>
                              <div className="k">Fin</div>
                              <div className="v">{recurrenceSummary.endLabel}</div>
                            </div>
                          </div>
                          <div className="hint">
                            Esta reserva se repetirá según la configuración
                            seleccionada.
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              {/* Duración + Total */}
              {durationMinutes > 0 ? (
                <div className="user-reserve-field full">
                  <div className="pricing-summary">
                    <div className="pricing-box">
                      <span className="label">Duración</span>
                      <span className="value">{durationHoursLabel}</span>
                    </div>
                    <div className="pricing-box" style={{ textAlign: "right" }}>
                      <span className="label">Costo Total</span>
                      <span className="value">{formatEUR(totalAmount)}</span>
                    </div>
                  </div>
                </div>
              ) : null}

              {/* Asistentes */}
              <div className="user-reserve-field full">
                <label>Número de Asistentes</label>
                <input
                  type="number"
                  min={1}
                  value={attendees}
                  onChange={(e) => setAttendees(Number(e.target.value || 1))}
                  disabled={saving || !shared || readOnly || createLocked}
                />
                <div className="user-reserve-help">
                  {shared
                    ? "En espacios compartidos podés indicar cuántos asistentes ocupan cupo."
                    : "En espacios no compartidos, siempre es 1."}
                </div>
              </div>

              {/* Propósito */}
              <div className="user-reserve-field full">
                <label>Propósito / Motivo</label>
                <input
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="ej. Reunión de equipo, Presentación a cliente"
                  disabled={saving || readOnly}
                />
              </div>

              {/* Notas */}
              <div className="user-reserve-field full">
                <label>Notas Adicionales</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Algún requerimiento especial o nota..."
                  disabled={saving || readOnly}
                />
              </div>
            </div>

            {/* Footer botones */}
            <div className="user-reserve-footer">
              <button
                className="pill-button-outline"
                onClick={() => navigate("/user")}
                disabled={saving}
              >
                {editId ? "Volver" : "Cancelar"}
              </button>

              {showEnableEdit ? (
                <button
                  type="button"
                  className="pill-button"
                  onClick={() => {
                    setFormError("");
                    setDetailMode(false);
                  }}
                  disabled={saving}
                >
                  Editar
                </button>
              ) : null}

              {!readOnly ? (
                <button
                  className="pill-button"
                  onClick={submit}
                  disabled={
                    saving ||
                    loadingSpaces ||
                    loadingSettings ||
                    !!timeError ||
                    readOnly ||
                    createLocked
                  }
                >
                  {saving
                    ? "Guardando..."
                    : editId
                    ? "Guardar cambios"
                    : "Crear Reserva"}
                </button>
              ) : null}
            </div>
          </div>
        </div>

        {/* Modal: aplicar cambios a reserva recurrente */}
        {showApplyScopeModal ? (
          <div
            onClick={onCancelApplyScope}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 9999,
              padding: 16,
            }}
          >
            <div
              onClick={(ev) => ev.stopPropagation()}
              style={{
                width: "min(520px, 100%)",
                background: "#fff",
                borderRadius: 16,
                boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
                padding: 18,
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  Aplicar cambios
                </div>
                <div style={{ color: "#5b6472", fontSize: 13 }}>
                  Esta reserva es recurrente. ¿Querés aplicar los cambios solo a
                  esta cita o a la serie?
                </div>
              </div>

              <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    border:
                      applyScope === "ONE"
                        ? "1px solid #7aa7ff"
                        : "1px solid #e6e9ef",
                    background: applyScope === "ONE" ? "#f3f7ff" : "#fafbfc",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="applyScope"
                    value="ONE"
                    checked={applyScope === "ONE"}
                    onChange={() => setApplyScope("ONE")}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      Solo esta cita
                    </div>
                    <div style={{ color: "#5b6472", fontSize: 12, marginTop: 2 }}>
                      Modifica únicamente la reserva seleccionada.
                    </div>
                  </div>
                </label>

                <label
                  style={{
                    display: "flex",
                    gap: 10,
                    alignItems: "center",
                    padding: 12,
                    borderRadius: 12,
                    border:
                      applyScope === "SERIES"
                        ? "1px solid #7aa7ff"
                        : "1px solid #e6e9ef",
                    background: applyScope === "SERIES" ? "#f3f7ff" : "#fafbfc",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="applyScope"
                    value="SERIES"
                    checked={applyScope === "SERIES"}
                    onChange={() => setApplyScope("SERIES")}
                  />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>
                      Esta y las siguientes
                    </div>
                    <div style={{ color: "#5b6472", fontSize: 12, marginTop: 2 }}>
                      Aplica el cambio a la serie a partir de esta ocurrencia.
                    </div>
                  </div>
                </label>
              </div>

              <div
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  gap: 10,
                  marginTop: 16,
                }}
              >
                <button
                  type="button"
                  onClick={onCancelApplyScope}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #e6e9ef",
                    background: "#fff",
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={onConfirmApplyScope}
                  style={{
                    padding: "10px 14px",
                    borderRadius: 10,
                    border: "1px solid #7aa7ff",
                    background: "#5b86ff",
                    color: "#fff",
                    cursor: "pointer",
                    fontWeight: 800,
                  }}
                >
                  Aplicar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
