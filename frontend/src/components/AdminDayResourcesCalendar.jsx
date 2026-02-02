import { useEffect, useMemo, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import resourceTimeGridPlugin from "@fullcalendar/resource-timegrid";
import interactionPlugin from "@fullcalendar/interaction";

import api from "../api/axiosClient";
import { occupyingReservations } from "../utils/reservationsCalendar";

function toHHmmss(v, fallback) {
  if (!v) return fallback;
  const s = String(v).trim();
  if (/^\d{1,2}$/.test(s)) return `${s.padStart(2, "0")}:00:00`;
  if (/^\d{1,2}:\d{2}$/.test(s)) return `${s.padStart(5, "0")}:00`;
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(s)) return s.padStart(8, "0");
  return fallback;
}

function fmtYMD(d) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Devuelve YYYY-MM-DD en hora local a partir de un Date/ISO string.
 * Esto evita bugs por UTC cuando comparás "día" en UI.
 */
function localYMD(value) {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return fmtYMD(d);
}

// Nombre + inicial del apellido: "Diego D."
function shortUserName(user) {
  if (!user) return "";
  const first = (user.name || user.firstName || "").trim();
  const last = (user.lastName || user.lastname || "").trim();
  const lastInitial = last ? `${last.charAt(0)}.` : "";
  const out = `${first} ${lastInitial}`.trim();
  return out || (user.email || "");
}

// Paleta suave y consistente por espacio (no por tipo):
// la idea es que cada recurso tenga "su" color y que todas las reservas en esa columna compartan identidad visual.
const SPACE_PALETTE = [
  { bg: "#e0f2fe", fg: "#075985" }, // sky
  { bg: "#ede9fe", fg: "#5b21b6" }, // violet
  { bg: "#dcfce7", fg: "#166534" }, // green
  { bg: "#fff7ed", fg: "#9a3412" }, // orange
  { bg: "#fefce8", fg: "#854d0e" }, // yellow
  { bg: "#ffe4e6", fg: "#9f1239" }, // rose
  { bg: "#ecfccb", fg: "#3f6212" }, // lime
  { bg: "#e0e7ff", fg: "#3730a3" }, // indigo
];

function colorBySpaceId(spaceId) {
  const n = Number(String(spaceId).replace(/\D/g, "")) || 0;
  return SPACE_PALETTE[n % SPACE_PALETTE.length];
}

export default function AdminDayResourcesCalendar() {
  const [spaces, setSpaces] = useState([]);
  const [spaceId, setSpaceId] = useState("ALL");
  const [date, setDate] = useState(() => fmtYMD(new Date()));
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);

  const [slotMinTime, setSlotMinTime] = useState("08:00:00");
  const [slotMaxTime, setSlotMaxTime] = useState("20:00:00");

  useEffect(() => {
    (async () => {
      try {
        const [spacesRes, settingsRes] = await Promise.all([
          api.get("/spaces"),
          api.get("/public/settings"),
        ]);

        setSpaces(spacesRes.data || []);

        const settings = settingsRes.data?.settings || {};
        setSlotMinTime(toHHmmss(settings.OFFICE_OPEN_HOUR, "08:00:00"));
        setSlotMaxTime(toHHmmss(settings.OFFICE_CLOSE_HOUR, "20:00:00"));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);

        const res = await api.get("/reservations");
        const all = res.data || [];

        // ✅ Filtro robusto por día: usar startTime (DateTime real)
        const sameDay = all.filter((r) => localYMD(r.startTime) === date);

        const filtered =
          spaceId === "ALL"
            ? sameDay
            : sameDay.filter((r) => String(r.spaceId) === String(spaceId));

        setReservations(filtered);
      } catch (e) {
        console.error(e);
        setReservations([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [date, spaceId]);

  const resources = useMemo(() => {
    const list =
      spaceId === "ALL"
        ? spaces
        : spaces.filter((s) => String(s.id) === String(spaceId));

    return list.map((s) => ({
      id: String(s.id),
      title: s.name,
      extendedProps: { type: s.type, capacity: s.capacity },
    }));
  }, [spaces, spaceId]);

  const events = useMemo(() => {
    // Hidratamos space si el backend no lo manda embebido
    const hydrated = reservations.map((r) => {
      const sp = r.space || spaces.find((s) => String(s.id) === String(r.spaceId));
      return { ...r, space: sp || r.space };
    });

    // ✅ IMPORTANTE: en Admin queremos ver cada reserva individual (con el nombre del usuario)
    // y que FullCalendar las disponga una al lado de la otra cuando hay solapamientos.
    const occ = occupyingReservations(hydrated);

    return occ
      .map((r) => {
        const sp = r.space || {};
        const { bg, fg } = colorBySpaceId(r.spaceId || sp.id);

        const start = r.startTime;
        const end = r.endTime;
        const resourceId = String(r.spaceId || sp.id || "");
        if (!resourceId || !start || !end) return null;

        const userShort = shortUserName(r.user);

        return {
          id: String(r.id),
          title: userShort || "Reserva",
          start,
          end,
          resourceId,
          backgroundColor: bg,
          borderColor: fg,
          textColor: fg,
          classNames: ["fc-event-soft"],
          extendedProps: {
            userNameShort: userShort || "",
            // dejamos email/fullName guardado por si después querés tooltip o modal
            userEmail: r.user?.email || "",
            userFullName: `${(r.user?.name || r.user?.firstName || "").trim()} ${(r.user?.lastName || r.user?.lastname || "").trim()}`.trim(),
            spaceName: sp.name || "",
            status: r.status || "",
            isShared: ["FLEX", "SHARED_TABLE"].includes(String(sp.type || "").toUpperCase()),
            capacity: Number(sp.capacity) || 1,
          },
        };
      })
      .filter(Boolean);
  }, [reservations, spaces]);

  return (
    <div className="admin-card" style={{ marginBottom: "1.5rem" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2 style={{ margin: 0, marginBottom: "0.25rem", fontSize: "1.1rem" }}>
            Calendario (día)
          </h2>
          <div style={{ fontSize: "0.85rem", color: "#6b7280" }}>
            Vista por espacio. Se muestra el nombre (apellido abreviado) en cada reserva. Cuando hay solapamientos, se renderizan una al lado de la otra.
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          <div style={{ minWidth: 240 }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
              Espacio
            </label>
            <select
              value={spaceId}
              onChange={(e) => setSpaceId(e.target.value)}
              style={{
                width: "100%",
                borderRadius: "0.6rem",
                border: "1px solid #d1d5db",
                padding: "0.55rem 0.75rem",
                fontSize: "0.9rem",
                background: "#fff",
              }}
            >
              <option value="ALL">Todos los espacios</option>
              {spaces.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: 170 }}>
            <label style={{ display: "block", fontSize: "0.8rem", marginBottom: "0.2rem" }}>
              Fecha
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                width: "100%",
                borderRadius: "0.6rem",
                border: "1px solid #d1d5db",
                padding: "0.55rem 0.75rem",
                fontSize: "0.9rem",
                background: "#fff",
              }}
            />
          </div>
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        {loading ? (
          <p style={{ fontSize: "0.9rem", color: "#6b7280" }}>Cargando calendario...</p>
        ) : (
          <div className="fc-admin-wrap">
            <FullCalendar
              plugins={[resourceTimeGridPlugin, interactionPlugin]}
              initialView="resourceTimeGridDay"
              height="auto"
              nowIndicator={true}
              allDaySlot={false}
              // ✅ evita superposición visual: eventos solapados se muestran en columnas lado a lado
              slotEventOverlap={false}
              eventMaxStack={12}
              slotMinTime={slotMinTime}
              slotMaxTime={slotMaxTime}
              slotDuration="00:30:00"
              expandRows={true}
              stickyHeaderDates={true}
              resources={resources}
              events={events}
              initialDate={date}
              headerToolbar={{ left: "today prev,next", center: "title", right: "" }}
              buttonText={{ today: "Hoy" }}
              datesSet={(arg) => {
                const next = fmtYMD(arg.start);
                if (next !== date) setDate(next);
              }}
              eventTimeFormat={{ hour: "2-digit", minute: "2-digit", hour12: false }}
              eventContent={(arg) => {
  const ep = arg.event.extendedProps || {};
  const name = ep.userNameShort || arg.event.title || "";

  return (
    <div
      style={{
        fontSize: "0.88rem",
        fontWeight: 700,
        lineHeight: 1.1,
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
      title={ep.userFullName || name} // tooltip opcional
    >
      {name}
    </div>
  );
}}

            />
          </div>
        )}
      </div>
    </div>
  );
}
