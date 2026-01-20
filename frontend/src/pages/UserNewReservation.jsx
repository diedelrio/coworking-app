import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import api from "../api/axiosClient";
import Header from "../components/Header";
import ReservationTimeFields from "../components/ReservationTimeFields";
import { getCurrentUser } from "../utils/auth";

function pad2(n) {
  return String(n).padStart(2, "0");
}

function toHHMM(v) {
  if (!v) return "";
  if (typeof v === "string") {
    if (/^\d{2}:\d{2}$/.test(v)) return v;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return v;
  }
  const d = new Date(v);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function toYMD(dateLike) {
  const d = new Date(dateLike);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function minutesBetween(startHHMM, endHHMM) {
  const [sh, sm] = (startHHMM || "0:0").split(":").map(Number);
  const [eh, em] = (endHHMM || "0:0").split(":").map(Number);
  return eh * 60 + em - (sh * 60 + sm);
}

function formatEUR(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(num);
}

function isSharedSpaceType(spaceType) {
  return spaceType === "FLEX_DESK" || spaceType === "SHARED_TABLE";
}

export default function UserNewReservation() {
  const user = getCurrentUser();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const editId = params.get("edit");

  const [spaces, setSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  const [spacesError, setSpacesError] = useState("");

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [success, setSuccess] = useState("");

  // form
  const [spaceId, setSpaceId] = useState("");
  const [date, setDate] = useState(toYMD(new Date()));
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("10:00");
  const [attendees, setAttendees] = useState(1);
  const [purpose, setPurpose] = useState("");
  const [notes, setNotes] = useState("");

  // pricing snapshot para UI (en edit se congela)
  const [hourlyRateSnapshot, setHourlyRateSnapshot] = useState(null);

  const selectedSpace = useMemo(
    () => spaces.find((s) => String(s.id) === String(spaceId)) || null,
    [spaces, spaceId]
  );

  const shared = useMemo(() => (selectedSpace ? isSharedSpaceType(selectedSpace.type) : false), [selectedSpace]);

  // duration + total (UI)
  const durationMinutes = useMemo(() => {
    const diff = minutesBetween(startTime, endTime);
    return Number.isFinite(diff) ? diff : 0;
  }, [startTime, endTime]);

  const durationHoursLabel = useMemo(() => {
    if (durationMinutes <= 0) return "—";
    const hours = durationMinutes / 60;
    // 3.5 como en mock, sin demasiados decimales
    const pretty = Number.isInteger(hours) ? String(hours) : String(Math.round(hours * 10) / 10);
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
    // ✅ Si es compartido, multiplica por attendees
    const qty = shared ? Math.max(1, Number(attendees || 1)) : 1;

    return rate * hours * qty;
  }, [hourlyRateSnapshot, selectedSpace, durationMinutes, attendees, shared]);

  // cargar spaces
  useEffect(() => {
    (async () => {
      try {
        setLoadingSpaces(true);
        setSpacesError("");
        // Ajustá si tu backend usa otro endpoint. En tu captura fallaba la carga.
        // Probá primero este:
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
        setStartTime(toHHMM(r.startTime));
        setEndTime(toHHMM(r.endTime));
        setAttendees(Number(r.attendees ?? 1));
        setPurpose(r.purpose ?? "");
        setNotes(r.notes ?? "");

        // ✅ congelar precio aplicado
        setHourlyRateSnapshot(r.hourlyRateSnapshot ?? null);
      } catch (e) {
        console.error(e);
        setFormError("No se pudo cargar la reserva para editar.");
      }
    })();
  }, [editId]);

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

  async function submit() {
    setSuccess("");
    setFormError("");

    if (!spaceId) return setFormError("Seleccioná un espacio.");
    if (!date) return setFormError("Seleccioná una fecha.");
    if (!startTime || !endTime) return setFormError("Seleccioná hora inicio/fin.");
    if (minutesBetween(startTime, endTime) <= 0) return setFormError("La hora fin debe ser mayor a inicio.");

    try {
      setSaving(true);

      const payload = {
        spaceId: Number(spaceId),
        date,
        startTime,
        endTime,
        attendees: Number(attendees || 1),
        purpose: purpose ? String(purpose).trim() : null,
        notes: notes ? String(notes).trim() : null,
      };

      if (editId) {
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

  return (
    <div>
      <Header user={user} />

      <div className="page-container">
        <div className="dashboard-container">
          {/* Header tipo mock */}
          <div className="user-reserve-header-wrap">
            <div className="user-reserve-header">
              <button className="user-reserve-back" onClick={() => navigate("/user")}>
                ←
              </button>

              <div className="user-reserve-title">
                <h1>{editId ? "Editar Reserva" : "Nueva Reserva"}</h1>
                <p>Crea una nueva reserva de espacio de coworking</p>
              </div>
            </div>
          </div>


          {spacesError ? (
            <div className="form-error" style={{ maxWidth: 860, margin: "0 auto 12px" }}>
              <b>Error</b>
              <div>{spacesError}</div>
            </div>
          ) : null}

          {formError ? (
            <div className="form-error" style={{ maxWidth: 860, margin: "0 auto 12px" }}>
              {formError}
            </div>
          ) : null}

          {success ? (
            <div className="success" style={{ maxWidth: 860, margin: "0 auto 12px" }}>
              {success}
            </div>
          ) : null}

          {/* Card central */}
          <div className="user-reserve-card">
            <div className="user-reserve-card-head">
              <div className="title">Detalles de la Reserva</div>
              <p className="sub">Completa la información a continuación para crear tu reserva</p>
            </div>

            <div className="user-reserve-grid">
              {/* Espacio */}
              <div className="user-reserve-field full">
                <label>Espacio *</label>
                <select
                  value={spaceId}
                  onChange={(e) => setSpaceId(e.target.value)}
                  disabled={loadingSpaces || saving}
                >
                  <option value="">
                    {loadingSpaces ? "Cargando..." : "Seleccioná un espacio"}
                  </option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} • {formatEUR(s.hourlyRate)} / hora • {s.capacity} persona(s)
                    </option>
                  ))}
                </select>

                {/* Card info espacio (condicional) */}
                {selectedSpace ? (
                  <div className="space-info-card">
                    <div className="space-info-row">
                      <span>👥 Capacidad: {selectedSpace.capacity}</span>
                      <span>💶 {formatEUR(selectedSpace.hourlyRate)} / hora</span>
                    </div>
                    {selectedSpace.description ? (
                      <p className="space-info-desc">{selectedSpace.description}</p>
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
                  disabled={saving}
                />
              </div>

              {/* Hora inicio / fin */}
              <ReservationTimeFields
                startTime={startTime}
                endTime={endTime}
                setStartTime={setStartTime}
                setEndTime={setEndTime}
                disabled={saving}
              />

              {/* Duración + Total (condicional si hay rango válido) */}
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
                  disabled={saving || !shared}
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
                  disabled={saving}
                />
              </div>

              {/* Notas */}
              <div className="user-reserve-field full">
                <label>Notas Adicionales</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Algún requerimiento especial o nota..."
                  disabled={saving}
                />
              </div>
            </div>

            {/* Footer botones */}
            <div className="user-reserve-footer">
              <button className="pill-button-outline" onClick={() => navigate("/user")} disabled={saving}>
                Cancelar
              </button>
              <button className="pill-button" onClick={submit} disabled={saving || loadingSpaces}>
                {saving ? "Guardando..." : editId ? "Guardar cambios" : "Crear Reserva"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
