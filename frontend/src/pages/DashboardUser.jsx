import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function toHHMM(value) {
  if (!value) return '';
  if (typeof value === 'string') {
    if (/^\d{2}:\d{2}$/.test(value)) return value;
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
    return value;
  }
  const d = new Date(value);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function formatDateES(dateLike) {
  const d = new Date(dateLike);
  if (Number.isNaN(d.getTime())) return String(dateLike || '');
  return new Intl.DateTimeFormat('es-ES', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function formatEUR(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' }).format(num);
}

function statusLabel(status) {
  switch (status) {
    case 'ACTIVE':
      return 'Activa';
    case 'PENDING':
      return 'Pendiente';
    case 'CANCELLED':
      return 'Cancelada';
    case 'REJECTED':
      return 'Rechazada';
    default:
      return status || '—';
  }
}

function isUpcoming(res) {
  const statusOk = res?.status === 'ACTIVE' || res?.status === 'PENDING';
  if (!statusOk) return false;

  const d = new Date(res?.date);
  if (Number.isNaN(d.getTime())) return false;

  const today = new Date();
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const date0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  return date0 >= today0;
}

function isToday(res) {
  const statusOk = res?.status === 'ACTIVE' || res?.status === 'PENDING';
  if (!statusOk) return false;

  const d = new Date(res?.date);
  if (Number.isNaN(d.getTime())) return false;

  const today = new Date();
  return (
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate()
  );
}

export default function DashboardUser() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRes, setDetailRes] = useState(null);

  async function fetchReservations() {
    const res = await api.get('/reservations/my');
    setReservations(Array.isArray(res.data) ? res.data : []);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        await fetchReservations();
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err?.response?.data?.message || 'Error al cargar tus reservas');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  const totalCount = reservations.length;

  const upcoming = useMemo(() => {
    return reservations
      .filter(isUpcoming)
      .sort((a, b) => {
        const da = new Date(a.date);
        const db = new Date(b.date);
        const ta = toHHMM(a.startTime);
        const tb = toHHMM(b.startTime);
        if (da.getTime() !== db.getTime()) return da.getTime() - db.getTime();
        return ta.localeCompare(tb);
      });
  }, [reservations]);

  const todayCount = useMemo(() => reservations.filter(isToday).length, [reservations]);
  const upcomingCount = upcoming.length;
  const upcomingTop = useMemo(() => upcoming.slice(0, 3), [upcoming]); // mock muestra 3

  function canEdit(res) {
    if (!(res?.status === 'ACTIVE' || res?.status === 'PENDING')) return false;

    const start = new Date(res?.startTime);
    if (!Number.isNaN(start.getTime())) return start > new Date();

    return isUpcoming(res);
  }

  async function cancelReservation(id) {
    if (!window.confirm('¿Querés cancelar esta reserva?')) return;

    try {
      await api.patch(`/reservations/${id}/cancel`);
      await fetchReservations();
    } catch (e) {
      const status = e?.response?.status;
      const data = e?.response?.data;
      const msg =
        data?.message ||
        data?.error ||
        (typeof data === 'string' ? data : null) ||
        e?.message ||
        `No se pudo cancelar (HTTP ${status || '?'})`;
      alert(msg);
    }
  }

  if (loading) {
    return (
      <div>
        <Header user={user} />
        <div style={{ padding: '2rem 1rem', display: 'flex', justifyContent: 'center' }}>
          Cargando tu panel...
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header user={user} />

      <div className="page-container dashboard-page">
        <div className="dashboard-container">
          {/* Top header row (mock) */}
          <div className="dashboard-user-top">
            <div className="dashboard-header">
              <h1>Bienvenido</h1>
              <p>Gestioná tus espacios de trabajo, reservas y próximos turnos.</p>
              {error ? <div className="form-error">{error}</div> : null}
            </div>

            <button className="pill-button" onClick={() => navigate('/user/reservar')}>
              Nueva reserva
            </button>
          </div>

          {/* KPIs (mock) */}
          <div className="dashboard-kpis">
            <div className="user-card">
              <div className="kpi-title">Reservas totales</div>
              <div className="kpi-value">{totalCount}</div>
              <div className="kpi-sub">Incluye canceladas y rechazadas.</div>
            </div>

            <div className="user-card">
              <div className="kpi-title">Próximas</div>
              <div className="kpi-value">{upcomingCount}</div>
              <div className="kpi-sub">Activas o pendientes desde hoy.</div>
            </div>

            <div className="user-card">
              <div className="kpi-title">Hoy</div>
              <div className="kpi-value">{todayCount}</div>
              <div className="kpi-sub">Reservas activas o pendientes para hoy.</div>
            </div>
          </div>

          {/* Próximas reservas (mock) */}
          <div className="user-card">
            <div className="dashboard-section-head">
              <div>
                <div className="dashboard-section-title">Próximas reservas</div>
                <div className="dashboard-section-sub">
                  Accedé rápido a tus próximas reservas y gestioná cambios.
                </div>
              </div>

              <button className="dashboard-link" onClick={() => navigate('/user/reservas')}>
                Ver todas →
              </button>
            </div>

            {upcomingTop.length === 0 ? (
              <div className="dashboard-empty">
                <div style={{ fontWeight: 900 }}>Todavía no tenés reservas próximas</div>
                <div style={{ marginTop: 6, opacity: 0.75 }}>
                  Creá una nueva reserva para verlas aquí.
                </div>
                <div style={{ marginTop: 12 }}>
                  <button className="pill-button" onClick={() => navigate('/user/reservar')}>
                    Nueva reserva
                  </button>
                </div>
              </div>
            ) : (
              <div className="upcoming-list">
                {upcomingTop.map((r) => (
                  <div key={r.id} className="user-card" style={{ padding: 14 }}>
                    <div className="upcoming-card-top">
                      <div style={{ width: "100%" }}>
                        {/* Título + estado en la misma línea */}
                        <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                          <div className="upcoming-title" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span>{r?.space?.name || `Espacio #${r.spaceId}`}</span>
                            <span className={`status-pill status-${r.status}`}>{statusLabel(r.status)}</span>
                          </div>
                        </div>

                        <div className="upcoming-meta">
                          <span>{formatDateES(r.date)}</span>
                          <span>
                            {toHHMM(r.startTime)}–{toHHMM(r.endTime)}
                          </span>
                          <span>👥 {r.attendees ?? 1}</span>
                          {r.totalAmount != null ? <span>💶 {formatEUR(r.totalAmount)}</span> : null}
                        </div>
                      </div>
                    </div>
                    <div className="upcoming-actions">
                      <button
                        className="pill-button-outline"
                        type="button"
                        onClick={() => {
                          setDetailRes(r);
                          setDetailOpen(true);
                        }}
                      >
                        Ver detalles
                      </button>

                      <button
                        className="pill-button-outline"
                        type="button"
                        disabled={!canEdit(r)}
                        onClick={() => navigate(`/user/reservar?edit=${r.id}`)}
                      >
                        Editar
                      </button>

                      <button
                        className="pill-button-red"
                        type="button"
                        disabled={!canEdit(r)}
                        onClick={() => cancelReservation(r.id)}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Modal Detalle (si ya tenés modal-overlay/modal-card en CSS, queda ok) */}
        {detailOpen && detailRes ? (
          <div className="modal-overlay" onClick={() => setDetailOpen(false)}>
            <div className="modal-card" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: 18 }}>
                    {detailRes?.space?.name || `Reserva #${detailRes.id}`}
                  </div>
                  <div style={{ marginTop: 6, opacity: 0.75 }}>
                    {formatDateES(detailRes.date)} • {toHHMM(detailRes.startTime)}–{toHHMM(detailRes.endTime)}
                  </div>
                </div>

                <span className={`status-pill status-${detailRes.status}`}>
                  {statusLabel(detailRes.status)}
                </span>
              </div>

              <div style={{ marginTop: 14, display: 'grid', gap: 8 }}>
                <div style={{ opacity: 0.85 }}>
                  Participantes: <b>{detailRes.attendees ?? 1}</b>
                </div>

                {detailRes.durationMinutes != null ? (
                  <div style={{ opacity: 0.85 }}>
                    Duración: <b>{detailRes.durationMinutes} min</b>
                  </div>
                ) : null}

                {detailRes.hourlyRateSnapshot != null ? (
                  <div style={{ opacity: 0.85 }}>
                    Precio aplicado: <b>{formatEUR(detailRes.hourlyRateSnapshot)}</b>
                  </div>
                ) : null}

                {detailRes.totalAmount != null ? (
                  <div style={{ opacity: 0.85 }}>
                    Total: <b>{formatEUR(detailRes.totalAmount)}</b>
                  </div>
                ) : null}

                {detailRes.purpose ? (
                  <div style={{ opacity: 0.85 }}>
                    Propósito: <b>{detailRes.purpose}</b>
                  </div>
                ) : null}

                {detailRes.notes ? (
                  <div style={{ opacity: 0.85 }}>
                    Notas: <b>{detailRes.notes}</b>
                  </div>
                ) : null}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
                <button className="pill-button-outline" onClick={() => setDetailOpen(false)}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
