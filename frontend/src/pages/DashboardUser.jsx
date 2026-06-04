import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaPlus, FaTimes, FaEdit } from 'react-icons/fa';
import api from '../api/axiosClient';
import ClientLayout from '../portals/client/layout/ClientLayout';
import { getCurrentUser } from '../utils/auth';

/* ── helpers ── */
function pad2(n) { return String(n).padStart(2, '0'); }

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
  return new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function statusLabel(status) {
  const map = { ACTIVE: 'Activa', PENDING: 'Pendiente', CANCELLED: 'Cancelada', REJECTED: 'Rechazada' };
  return map[status] || status || '—';
}

function statusClass(status) {
  const map = { ACTIVE: 'active', PENDING: 'pending', CANCELLED: 'cancelled', REJECTED: 'rejected' };
  return `sn-status sn-status--${map[status] || 'cancelled'}`;
}

function isUpcoming(res) {
  if (!(res?.status === 'ACTIVE' || res?.status === 'PENDING')) return false;
  const d = new Date(res?.date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const date0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return date0 >= today0;
}

function isWithinNextDays(res, maxDays) {
  if (!isUpcoming(res)) return false;
  const d = new Date(res?.date);
  const today = new Date();
  const today0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const date0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const end = new Date(today0);
  end.setDate(end.getDate() + Math.max(0, Number(maxDays || 0) - 1));
  return date0 >= today0 && date0 <= end;
}

function isToday(res) {
  if (!(res?.status === 'ACTIVE' || res?.status === 'PENDING')) return false;
  const d = new Date(res?.date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  return d.getFullYear() === today.getFullYear() && d.getMonth() === today.getMonth() && d.getDate() === today.getDate();
}

function canEdit(res) {
  if (!(res?.status === 'ACTIVE' || res?.status === 'PENDING')) return false;
  const start = new Date(res?.startTime);
  if (!Number.isNaN(start.getTime())) return start > new Date();
  return isUpcoming(res);
}

/* ── component ── */
export default function DashboardUser() {
  const user = getCurrentUser();
  const navigate = useNavigate();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [maxDaysUpcoming, setMaxDaysUpcoming] = useState(7);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailRes, setDetailRes] = useState(null);

  const firstName = useMemo(() => user?.name?.split(' ')[0] || 'ahí', [user]);

  async function fetchReservations() {
    const res = await api.get('/reservations/my');
    setReservations(Array.isArray(res.data) ? res.data : []);
  }

  async function fetchPublicSettings() {
    const res = await api.get('/public/settings');
    const settings = res.data?.settings || {};
    const n = Number(settings.MAX_DAYS_UPCOMING_BOOKING);
    setMaxDaysUpcoming(Number.isFinite(n) && n > 0 ? n : 7);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        setError('');
        await Promise.all([fetchReservations(), fetchPublicSettings()]);
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || 'Error al cargar tus reservas');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const totalCount = reservations.length;

  const upcoming = useMemo(() =>
    reservations
      .filter(isUpcoming)
      .filter((r) => isWithinNextDays(r, maxDaysUpcoming))
      .sort((a, b) => {
        const da = new Date(a.date), db = new Date(b.date);
        if (da.getTime() !== db.getTime()) return da - db;
        return toHHMM(a.startTime).localeCompare(toHHMM(b.startTime));
      }),
    [reservations, maxDaysUpcoming]
  );

  const todayCount = useMemo(() => reservations.filter(isToday).length, [reservations]);

  async function cancelReservation(id) {
    if (!window.confirm('¿Querés cancelar esta reserva?')) return;
    try {
      await api.patch(`/reservations/${id}/cancel`);
      await fetchReservations();
    } catch (e) {
      const data = e?.response?.data;
      alert(data?.message || data?.error || e?.message || 'No se pudo cancelar');
    }
  }

  if (loading) {
    return (
      <ClientLayout user={user}>
        <div className="client-page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '40vh' }}>
          <div style={{ color: 'var(--sn-muted)', fontWeight: 600 }}>Cargando tu panel…</div>
        </div>
      </ClientLayout>
    );
  }

  return (
    <ClientLayout user={user}>
      <div className="client-page">

        {/* Hero */}
        <div className="sn-dashboard-hero">
          <div>
            <span className="sn-eyebrow">Tu espacio de trabajo</span>
            <h1 className="sn-page-title">Hola, {firstName}</h1>
            <p className="sn-page-subtitle">
              Gestioná tus reservas, revisá tus próximos turnos y creá nuevos espacios de trabajo en segundos.
            </p>
            {error && <div className="sn-alert sn-alert--error" style={{ marginTop: '0.85rem' }}>{error}</div>}
          </div>
          <button className="sn-btn sn-btn--primary sn-btn--lg" onClick={() => navigate('/user/reservar')}>
            <FaPlus /> Nueva reserva
          </button>
        </div>

        {/* KPI grid */}
        <div className="sn-kpi-grid" style={{ marginBottom: '1.25rem' }}>
          <div className="sn-card sn-kpi-card sn-kpi-card--slate">
            <div className="sn-kpi-label">Reservas totales</div>
            <div className="sn-kpi-value">{totalCount}</div>
            <div className="sn-kpi-help">Historial completo incluyendo canceladas.</div>
          </div>

          <div className="sn-card sn-kpi-card sn-kpi-card--green">
            <div className="sn-kpi-label">Próximas</div>
            <div className="sn-kpi-value">{upcoming.length}</div>
            <div className="sn-kpi-help">Activas o pendientes en los próximos {maxDaysUpcoming} días.</div>
          </div>

          <div className="sn-card sn-kpi-card sn-kpi-card--amber">
            <div className="sn-kpi-label">Hoy</div>
            <div className="sn-kpi-value">{todayCount}</div>
            <div className="sn-kpi-help">Reservas activas o pendientes para hoy.</div>
          </div>
        </div>

        {/* Upcoming reservations */}
        <div className="sn-card">
          <div className="sn-section">
            <div className="sn-section-head">
              <div>
                <h2 className="sn-section-title">Próximas reservas</h2>
                <p className="sn-section-subtitle">
                  Tus próximas <strong>{maxDaysUpcoming}</strong> días. Podés gestionar cambios desde aquí.
                </p>
              </div>
              <button className="sn-btn sn-btn--ghost" onClick={() => navigate('/user/reservas')}>
                Ver todas →
              </button>
            </div>

            {upcoming.length === 0 ? (
              <div className="sn-empty">
                <strong>Sin reservas próximas</strong>
                <p>Creá una nueva reserva para verla aquí y gestionarla desde tu panel.</p>
                <button className="sn-btn sn-btn--primary" onClick={() => navigate('/user/reservar')}>
                  <FaPlus /> Nueva reserva
                </button>
              </div>
            ) : (
              <div className="sn-reservation-list">
                {upcoming.map((r) => (
                  <article key={r.id} className="sn-res-card">
                    <div>
                      <div className="sn-res-title">
                        <span>{r?.space?.name || `Espacio #${r.spaceId}`}</span>
                        <span className={statusClass(r.status)}>{statusLabel(r.status)}</span>
                      </div>
                      <div className="sn-res-meta">
                        <span className="sn-res-meta-chip">📅 {formatDateES(r.date)}</span>
                        <span className="sn-res-meta-chip">🕐 {toHHMM(r.startTime)}–{toHHMM(r.endTime)}</span>
                        <span className="sn-res-meta-chip">👥 {r.attendees ?? 1}</span>
                      </div>
                    </div>
                    <div className="sn-res-actions">
                      <button
                        className="sn-btn sn-btn--outline sn-btn--sm"
                        onClick={() => { setDetailRes(r); setDetailOpen(true); }}
                      >
                        Ver
                      </button>
                      <button
                        className="sn-btn sn-btn--outline sn-btn--sm"
                        disabled={!canEdit(r)}
                        onClick={() => navigate(`/user/reservar?edit=${r.id}&mode=edit`)}
                      >
                        <FaEdit />
                      </button>
                      <button
                        className="sn-btn sn-btn--danger sn-btn--sm"
                        disabled={!canEdit(r)}
                        onClick={() => cancelReservation(r.id)}
                      >
                        <FaTimes />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail modal */}
        {detailOpen && detailRes && (
          <div className="sn-modal-overlay" onClick={() => setDetailOpen(false)}>
            <div className="sn-modal" onClick={(e) => e.stopPropagation()}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start', marginBottom: '0.9rem' }}>
                <div>
                  <div style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--sn-ink)' }}>
                    {detailRes?.space?.name || `Reserva #${detailRes.id}`}
                  </div>
                  <div style={{ marginTop: '0.25rem', fontSize: '0.84rem', color: 'var(--sn-muted)' }}>
                    {formatDateES(detailRes.date)} · {toHHMM(detailRes.startTime)}–{toHHMM(detailRes.endTime)}
                  </div>
                </div>
                <span className={statusClass(detailRes.status)}>{statusLabel(detailRes.status)}</span>
              </div>

              <div style={{ display: 'grid', gap: '0.6rem', fontSize: '0.88rem', color: 'var(--sn-ink-2)' }}>
                {detailRes.seriesId && (
                  <div>Recurrencia: <strong>
                    {String(detailRes.recurrencePattern || 'WEEKLY').toUpperCase() === 'DAILY' ? 'Diaria'
                      : String(detailRes.recurrencePattern || 'WEEKLY').toUpperCase() === 'MONTHLY' ? 'Mensual'
                      : 'Semanal'}
                  </strong></div>
                )}
                <div>Participantes: <strong>{detailRes.attendees ?? 1}</strong></div>
                {detailRes.durationMinutes != null && <div>Duración: <strong>{detailRes.durationMinutes} min</strong></div>}
                {detailRes.purpose && <div>Propósito: <strong>{detailRes.purpose}</strong></div>}
                {detailRes.notes && <div>Notas: <strong>{detailRes.notes}</strong></div>}
              </div>

              <div className="sn-modal-footer">
                <button className="sn-btn sn-btn--outline" onClick={() => setDetailOpen(false)}>Cerrar</button>
              </div>
            </div>
          </div>
        )}

      </div>
    </ClientLayout>
  );
}
