import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import ClientLayout from '../portals/client/layout/ClientLayout';
import { getCurrentUser } from '../utils/auth';
import ReservationsCalendar from '../components/ReservationsCalendar';
import ReservationsGrid from '../components/ReservationsGrid';
import { FaCalendarAlt, FaClock, FaPlus, FaRegCalendarCheck, FaEdit, FaTimes } from 'react-icons/fa'; // Añadidos FaEdit y FaTimes

function formatKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function isActiveLike(r) { return r?.status === 'ACTIVE' || r?.status === 'PENDING'; }
function isUpcoming(r) {
  if (!isActiveLike(r)) return false;
  const d = new Date(r?.date);
  if (Number.isNaN(d.getTime())) return false;
  const today = new Date();
  const t0 = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const d0 = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return d0 >= t0;
}
function isToday(r) {
  if (!isActiveLike(r)) return false;
  const d = new Date(r?.date);
  if (Number.isNaN(d.getTime())) return false;
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

export default function UserReservations() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterStatus, setFilterStatus] = useState('ACTIVE');

  async function fetchReservations() {
    const res = await api.get('/reservations/my');
    setReservations(Array.isArray(res.data) ? res.data : []);
  }

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true); setError('');
        await fetchReservations();
      } catch (err) {
        if (mounted) setError(err?.response?.data?.message || 'Error al cargar tus reservas');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  const totalCount    = reservations.length;
  const activeCount   = useMemo(() => reservations.filter(isActiveLike).length, [reservations]);
  const upcomingCount = useMemo(() => reservations.filter(isUpcoming).length, [reservations]);
  const todayCount    = useMemo(() => reservations.filter(isToday).length, [reservations]);

  const stats = [
    { icon: <FaRegCalendarCheck />, value: totalCount,    label: 'Total' },
    { icon: <FaCalendarAlt />,      value: upcomingCount, label: 'Próximas' },
    { icon: <FaClock />,            value: todayCount,    label: 'Hoy' },
    { icon: <FaRegCalendarCheck />, value: activeCount,   label: 'Activas' },
  ];

  function handleEditReservation(id) {
    navigate(`/user/reservar?edit=${encodeURIComponent(id)}&mode=edit`);
  }
  function handleViewDetails(id) {
    navigate(`/user/reservar?edit=${encodeURIComponent(id)}`);
  }
  function handleSlotClick(slot, selectedDate) {
    const params = new URLSearchParams({ date: formatKeyFromDate(selectedDate), start: slot.start, end: slot.end });
    navigate(`/user/reservar?${params.toString()}`);
  }

  return (
    <ClientLayout user={user}>
      <div className="client-page">

        {/* Hero */}
        <div className="sn-dashboard-hero">
          <div>
            <span className="sn-eyebrow">Tus turnos</span>
            <h1 className="sn-page-title">Mis reservas</h1>
            <p className="sn-page-subtitle">
              Consultá tu calendario, revisá próximas reservas y gestioná cambios desde un solo lugar.
            </p>
          </div>
          <button className="sn-btn sn-btn--primary sn-btn--lg" onClick={() => navigate('/user/reservar')}>
            <FaPlus /> Nueva reserva
          </button>
        </div>

        {error && <div className="sn-alert sn-alert--error" style={{ marginBottom: '1rem' }}>{error}</div>}

        {/* Stats */}
        <div className="sn-stat-grid" style={{ marginBottom: '1.25rem' }}>
          {stats.map((s) => (
            <div key={s.label} className="sn-card sn-stat-card">
              <span className="sn-stat-icon">{s.icon}</span>
              <div>
                <strong className="sn-stat-value">{s.value}</strong>
                <span className="sn-stat-label">{s.label}</span>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="sn-card" style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--sn-muted)', fontWeight: 600 }}>
            Cargando tus reservas…
          </div>
        ) : (
          <>
            {/* Calendar */}
            <div className="sn-card" style={{ marginBottom: '1.25rem' }}>
              <div className="sn-section">
                <div className="sn-section-head">
                  <div>
                    <h2 className="sn-section-title">Calendario</h2>
                    <p className="sn-section-subtitle">Elegí un horario libre para crear una nueva reserva.</p>
                  </div>
                </div>
                <div style={{ overflowX: 'auto', borderRadius: 'var(--sn-radius-sm)' }}>
                  <ReservationsCalendar
                    reservations={reservations}
                    onEditReservation={handleEditReservation}
                    onSlotClick={handleSlotClick}
                  />
                </div>
              </div>
            </div>

          {/* Grid — CON FILTRO DE ESTADO Y TARJETAS RESPONSIVAS */}
            <div className="sn-card">
              <div className="sn-section">
                <div className="sn-section-head" style={{ marginBottom: '1.25rem' }}>
                  <div>
                    <h2 className="sn-section-title">Listado de reservas</h2>
                    <p className="sn-section-subtitle">Filtrá por estado y gestioná cada una de tus reservas.</p>
                  </div>
                </div>

                {/* FILTRO DE ESTADO REINCORPORADO */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem', fontSize: '0.88rem' }}>
                  <span style={{ color: 'var(--sn-muted)', fontWeight: 600 }}>Estado:</span>
                  
                  {/* Badge dinámico que muestra el filtro actual */}
                  <span className={`sn-status sn-status--${filterStatus.toLowerCase()}`}>
                    {filterStatus === 'ACTIVE' ? 'Activa' : filterStatus === 'PENDING' ? 'Pendiente' : filterStatus === 'CANCELLED' ? 'Cancelada' : 'Rechazada'}
                  </span>

                  {/* Selector estilizado con el diseño de Sinergia */}
                  <select 
                    className="sn-select" 
                    value={filterStatus} 
                    onChange={(e) => setFilterStatus(e.target.value)}
                    style={{ maxWith: '160px', height: '36px', minHeight: '36px', padding: '0 0.5rem', fontSize: '0.85rem' }}
                  >
                    <option value="ACTIVE">Activa</option>
                    <option value="PENDING">Pendiente</option>
                    <option value="CANCELLED">Cancelada</option>
                    <option value="REJECTED">Rechazada</option>
                  </select>
                </div>

                {/* Renderizado de las tarjetas basado en el filtro seleccionado */}
                {reservations.filter((r) => r.status === filterStatus).length === 0 ? (
                  <div className="sn-empty">
                    <strong>Sin registros</strong>
                    <p>No tenés ninguna reserva con el estado seleccionado en este momento.</p>
                  </div>
                ) : (
                  <div className="sn-reservation-list" style={{ display: 'grid', gap: '0.85rem' }}>
                    {reservations
                      .filter((r) => r.status === filterStatus) // Filtro dinámico en acción
                      .map((r) => {
                        const start = new Date(r.startTime);
                        const end = new Date(r.endTime);
                        const horaInicio = !isNaN(start.getTime()) ? `${String(start.getHours()).padStart(2, '0')}:${String(start.getMinutes()).padStart(2, '0')}` : '';
                        const horaFin = !isNaN(end.getTime()) ? `${String(end.getHours()).padStart(2, '0')}:${String(end.getMinutes()).padStart(2, '0')}` : '';
                        
                        // Formateador regional consistente
                        const fechaES = !isNaN(start.getTime()) 
                          ? new Intl.DateTimeFormat('es-ES', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' }).format(start) 
                          : r.date;

                        const mapStatusLabel = { ACTIVE: 'Activa', PENDING: 'Pendiente', CANCELLED: 'Cancelada', REJECTED: 'Rechazada' };
                        const mapStatusClass = { ACTIVE: 'active', PENDING: 'pending', CANCELLED: 'cancelled', REJECTED: 'rejected' };

                        // Determinar si es una reserva que se puede editar o cancelar
                        const canModify = (r.status === 'ACTIVE' || r.status === 'PENDING') && start > new Date();

                        return (
                          <article key={r.id} className="sn-res-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                              <div className="sn-res-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                                <span style={{ textTransform: 'uppercase', fontWeight: 700 }}>
                                  {r?.space?.name || `Espacio #${r.spaceId}`}
                                </span>
                                <span className={`sn-status sn-status--${mapStatusClass[r.status] || 'cancelled'}`}>
                                  {mapStatusLabel[r.status] || r.status}
                                </span>
                              </div>
                              <div className="sn-res-meta" style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', marginTop: '0.45rem' }}>
                                <span className="sn-res-meta-chip">📅 {fechaES}</span>
                                <span className="sn-res-meta-chip">🕐 {horaInicio}–{horaFin}</span>
                                <span className="sn-res-meta-chip">👥 {r.attendees ?? 1}</span>
                                {r.desks?.length > 0 && <span className="sn-res-meta-chip">Mesas: {r.desks.map(d => d.desk.number).join(", ")}</span>}
                              </div>
                            </div>

                            {/* Acciones con Botones Circulares — Comportamiento controlado por CSS */}
                            <div className="sn-res-actions">
                              <button
                                className="sn-btn sn-btn--outline sn-btn--sm"
                                style={{ borderRadius: '999px', width: '36px', height: '36px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleViewDetails(r.id)}
                              >
                                Ver
                              </button>
                              <button
                                className="sn-btn sn-btn--outline sn-btn--sm"
                                style={{ borderRadius: '999px', width: '36px', height: '36px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={() => handleEditReservation(r.id)}
                              >
                                <FaEdit />
                              </button>
                              <button
                                className="sn-btn sn-btn--danger sn-btn--sm"
                                style={{ borderRadius: '999px', width: '36px', height: '36px', padding: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                                onClick={async () => {
                                  if (!window.confirm('¿Querés cancelar esta reserva?')) return;
                                  try {
                                    await api.patch(`/reservations/${r.id}/cancel`);
                                    fetchReservations();
                                  } catch (e) {
                                    alert('No se pudo cancelar la reserva');
                                  }
                                }}
                              >
                                <FaTimes />
                              </button>
                            </div>
                          </article>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>
          </>
        )}

      </div>
    </ClientLayout>
  );
}
