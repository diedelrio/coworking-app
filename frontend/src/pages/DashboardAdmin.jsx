import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { FiCalendar, FiClock, FiEye, FiEdit2, FiFileText, FiMapPin, FiPlus, FiUsers, FiX } from 'react-icons/fi';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import { getCurrentUser } from '../utils/auth';
import calendarImg from '../images/calendar-illustration.png';
import { aggregateSharedSlots, occupyingReservations } from '../utils/reservationsCalendar';
import AdminDayResourcesCalendar from '../components/AdminDayResourcesCalendar';
import './AdminMobileOccupancy.css';



const OPERATING_START_MINUTES = 9 * 60;
const OPERATING_END_MINUTES = 19 * 60;
const OPERATING_TOTAL_MINUTES = OPERATING_END_MINUTES - OPERATING_START_MINUTES;

function minutesFromDate(value) {
  const d = new Date(value);
  return d.getHours() * 60 + d.getMinutes();
}

function formatShortTime(value) {
  return new Date(value).toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeStatus(value) {
  return String(value || '').toUpperCase();
}

function isReservationOperationallyVisible(reservation) {
  const status = normalizeStatus(reservation?.status);
  return status === 'ACTIVE' || status === 'APPROVED' || status === 'PENDING';
}

function getReservationOverlapMinutes(reservation) {
  const start = Math.max(minutesFromDate(reservation.startTime), OPERATING_START_MINUTES);
  const end = Math.min(minutesFromDate(reservation.endTime), OPERATING_END_MINUTES);
  return Math.max(0, end - start);
}

function getReservationUserName(reservation) {
  const user = reservation?.user || {};
  const parts = [user.name, user.lastName].filter(Boolean);
  return parts.join(' ') || user.email || 'Usuario';
}

const SPACE_TYPES = [
  { value: 'FIX_DESK', label: 'Puesto fijo' },
  { value: 'FLEX_DESK', label: 'Puesto flex' },
  { value: 'MEETING_ROOM', label: 'Sala de reuniones' },
];

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function DashboardAdmin() {
  const [spaces, setSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [savingSpace, setSavingSpace] = useState(false);

  const [reservations, setReservations] = useState([]);
  const [statusFilter, setStatusFilter] = useState('ACTIVE'); // ACTIVE | CANCELLED | ALL

  const [loadingReservations, setLoadingReservations] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState('');

  // Modal cancelación (admin)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelTarget, setCancelTarget] = useState(null);
  const [canceling, setCanceling] = useState(false);

  // Calendario rápido por espacio (día)
  const [calendarSpaceId, setCalendarSpaceId] = useState('ALL');
  const [calendarDate, setCalendarDate] = useState(() =>
    formatDateInput(new Date())
  );
  const [calendarReservations, setCalendarReservations] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);
  const [selectedOccupancySpace, setSelectedOccupancySpace] = useState(null);

  // Paginación reservas futuras
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter]);

  // Formulario espacios
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    name: '',
    type: 'FIX_DESK',
    capacity: 1,
    description: '',
    active: true,
  });

  const user = getCurrentUser();

  function resetForm() {
    setEditingId(null);
    setForm({
      name: '',
      type: 'FIX_DESK',
      capacity: 1,
      description: '',
      active: true,
    });
  }

async function fetchSpaces() {
  try {
    setLoadingSpaces(true);
    const res = await api.get('/spaces');
    setSpaces(res.data);

    // default admin: ALL (no forzamos primer espacio)
    if (!calendarSpaceId) setCalendarSpaceId('ALL');
  } catch (err) {
    console.error(err);
    setError('No se pudieron cargar los espacios');
  } finally {
    setLoadingSpaces(false);
  }
}


  async function fetchReservations() {
    try {
      setLoadingReservations(true);
      const res = await api.get('/reservations'); // admin

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const upcoming = res.data
        .filter((r) => {
          const d = new Date(r.date);
          d.setHours(0, 0, 0, 0);
          return d >= today;
        })
        .sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          const cmpDate = dateA - dateB;
          if (cmpDate !== 0) return cmpDate;

          const startA = new Date(a.startTime);
          const startB = new Date(b.startTime);
          const cmpStart = startA - startB;
          if (cmpStart !== 0) return cmpStart;

          const spaceA = a.space?.name || '';
          const spaceB = b.space?.name || '';
          const cmpSpace = spaceA.localeCompare(spaceB);
          if (cmpSpace !== 0) return cmpSpace;

          return 0;
        });

      setReservations(upcoming);
      setCurrentPage(1);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las reservas');
    } finally {
      setLoadingReservations(false);
    }
  }

async function fetchCalendarReservations() {
  try {
    setLoadingCalendar(true);

    if (calendarSpaceId === 'ALL') {
      // Reusamos /reservations (admin) y filtramos por fecha en frontend
      const res = await api.get('/reservations');

      const filtered = (res.data || []).filter((r) => {
        const d = new Date(r.date);
        const key = formatDateInput(d);
        return key === calendarDate;
      });

      setCalendarReservations(filtered);
      return;
    }

    // Un espacio: endpoint existente por espacio + rango de un día
    const res = await api.get(`/reservations/space/${calendarSpaceId}`, {
      params: { from: calendarDate, to: calendarDate },
    });

    setCalendarReservations(res.data || []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoadingCalendar(false);
  }
}

  function handleCancelReservation(reservation) {
    setCancelTarget(reservation);
    setCancelModalOpen(true);
  }

  async function confirmCancelReservation() {
    if (!cancelTarget?.id) return;
    try {
      setCanceling(true);
      await api.delete(`/reservations/${cancelTarget.id}`);
      setCancelModalOpen(false);
      setCancelTarget(null);
      await fetchReservations();
    } catch (err) {
      console.error(err);
      setError('Error al cancelar la reserva');
    } finally {
      setCanceling(false);
    }
  }

  async function handleApproveReservation(reservation) {
    if (!reservation?.id) return;
    try {
      setError('');
      if (reservation.seriesId) {
        await api.patch(`/reservations/series/${reservation.seriesId}/approve`);
      } else {
        await api.patch(`/reservations/${reservation.id}/approve`);
      }
      await Promise.all([fetchReservations(), fetchCalendarReservations()]);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'No se pudo aprobar la reserva');
    }
  }

  async function handleRejectReservation(reservation) {
    if (!reservation?.id) return;
    const reason = window.prompt('Motivo de rechazo (se enviará al usuario por email):', '');
    if (reason === null) return;

    try {
      setError('');
      const payload = { reason };
      if (reservation.seriesId) {
        await api.patch(`/reservations/series/${reservation.seriesId}/reject`, payload);
      } else {
        await api.patch(`/reservations/${reservation.id}/reject`, payload);
      }
      await Promise.all([fetchReservations(), fetchCalendarReservations()]);
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || 'No se pudo rechazar la reserva');
    }
  }

  async function fetchUsers() {
    try {
      setLoadingUsers(true);
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios');
    } finally {
      setLoadingUsers(false);
    }
  }

  useEffect(() => {
    async function load() {
      setError('');
      await Promise.all([fetchSpaces(), fetchReservations(), fetchUsers()]);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchCalendarReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [calendarSpaceId, calendarDate]);

  function handleChange(e) {
    const { name, value, type, checked } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSavingSpace(true);
    setError('');

    try {
      const payload = {
        name: form.name,
        type: form.type,
        capacity: Number(form.capacity),
        description: form.description,
        active: form.active,
      };

      if (editingId) {
        await api.put(`/spaces/${editingId}`, payload);
      } else {
        await api.post('/spaces', payload);
      }

      resetForm();
      await fetchSpaces();
    } catch (err) {
      console.error(err);
      setError('Error al guardar el espacio');
    } finally {
      setSavingSpace(false);
    }
  }

  function handleEdit(space) {
    setEditingId(space.id);
    setForm({
      name: space.name,
      type: space.type,
      capacity: space.capacity,
      description: space.description || '',
      active: space.active,
    });
  }

  async function handleDeactivate(id) {
    if (!window.confirm('¿Seguro que quieres desactivar este espacio?')) return;

    try {
      await api.delete(`/spaces/${id}`);
      await fetchSpaces();
    } catch (err) {
      console.error(err);
      setError('Error al desactivar el espacio');
    }
  }

  async function handleChangeUserRole(u, newRole) {
    const isAdmin = u.role === 'ADMIN';
    if (!window.confirm(`¿Seguro que quieres cambiar el rol de ${u.email} a ${newRole}?`)) {
      return;
    }

    try {
      await api.put(`/users/${u.id}`, { role: newRole });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setError('Error al cambiar el rol del usuario');
    }
  }

  async function handleToggleUserActive(u) {
    const newActive = !u.active;
    const actionText = newActive ? 'activar' : 'desactivar';
    if (!window.confirm(`¿Seguro que quieres ${actionText} al usuario ${u.email}?`)) {
      return;
    }

    try {
      await api.put(`/users/${u.id}`, { active: newActive });
      await fetchUsers();
    } catch (err) {
      console.error(err);
      setError('Error al cambiar el estado del usuario');
    }
  }

  const pendingApprovalReservations = reservations.filter(
    (r) => String(r.status || '').toUpperCase() === 'PENDING'
  );

  const activeFutureReservations = reservations.filter((r) => {
    const status = String(r.status || '').toUpperCase();
    return status === 'ACTIVE' || status === 'APPROVED';
  });

  const filteredReservations = activeFutureReservations.filter((r) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'APPROVED') return String(r.status || '').toUpperCase() === 'APPROVED';
    return String(r.status || '').toUpperCase() === 'ACTIVE';
  });

  const totalPages = Math.max(1, Math.ceil(filteredReservations.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = filteredReservations.slice(startIndex, startIndex + pageSize);

  const todayKey = formatDateInput(new Date());
  const activeReservations = reservations.filter((r) => {
    const status = String(r.status || '').toUpperCase();
    return status === 'ACTIVE' || status === 'APPROVED' || status === 'PENDING';
  });
  const reservationsToday = activeReservations.filter((r) => {
    const d = new Date(r.date);
    return formatDateInput(d) === todayKey;
  });
  const activeUsers = users.filter((u) => u.active !== false).length;
  const activeSpaces = spaces.filter((space) => space.active !== false).length;
  const occupiedSpacesToday = new Set(
    reservationsToday.map((r) => r.space?.id || r.spaceId).filter(Boolean)
  ).size;
  const occupancyToday = activeSpaces > 0
    ? Math.round((occupiedSpacesToday / activeSpaces) * 100)
    : 0;


  const mobileOccupancySpaces = useMemo(() => {
    const visibleReservations = (calendarReservations || [])
      .filter(isReservationOperationallyVisible)
      .filter((reservation) => {
        const reservationSpaceId = reservation.space?.id || reservation.spaceId;
        return Boolean(reservationSpaceId);
      });

    return (spaces || [])
      .filter((space) => space.active !== false)
      .map((space) => {
        const spaceReservations = visibleReservations
          .filter((reservation) => String(reservation.space?.id || reservation.spaceId) === String(space.id))
          .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

        const occupiedMinutes = Math.min(
          OPERATING_TOTAL_MINUTES,
          spaceReservations.reduce((sum, reservation) => sum + getReservationOverlapMinutes(reservation), 0)
        );

        const percentage = OPERATING_TOTAL_MINUTES > 0
          ? Math.round((occupiedMinutes / OPERATING_TOTAL_MINUTES) * 100)
          : 0;

        return {
          ...space,
          reservations: spaceReservations,
          occupiedMinutes,
          percentage,
        };
      });
  }, [calendarReservations, spaces]);

  const selectedOccupancyData = useMemo(() => {
    if (!selectedOccupancySpace) return null;
    return mobileOccupancySpaces.find((space) => String(space.id) === String(selectedOccupancySpace.id)) || selectedOccupancySpace;
  }, [mobileOccupancySpaces, selectedOccupancySpace]);

  return (
    <Layout user={user}>
      <div className="admin-page">
        <section className="admin-dashboard-v2">
          <div className="admin-dashboard-v2__hero">
            <div>
              <p className="admin-dashboard-v2__eyebrow">Panel de control</p>
              <h1>Panel de administrador</h1>
              <p>
                Supervisá reservas, ocupación, espacios y actividad general del coworking.
              </p>
            </div>

            <Link to="/admin/reservas/nueva" className="admin-dashboard-v2__primary-action">
              <FiPlus />
              <span>Nueva reserva</span>
            </Link>
          </div>

          {error && <div className="error admin-dashboard-v2__error">{error}</div>}

          <div className="admin-dashboard-v2__kpis" aria-label="Indicadores principales">
            <article className="admin-dashboard-v2__kpi-card admin-dashboard-v2__kpi-card--blue">
              <span className="admin-dashboard-v2__kpi-icon"><FiCalendar /></span>
              <div>
                <span className="admin-dashboard-v2__kpi-label">Reservas hoy</span>
                <strong>{loadingReservations ? '…' : reservationsToday.length}</strong>
                <small>Activas para la fecha actual</small>
              </div>
            </article>

            <article className="admin-dashboard-v2__kpi-card admin-dashboard-v2__kpi-card--purple">
              <span className="admin-dashboard-v2__kpi-icon"><FiClock /></span>
              <div>
                <span className="admin-dashboard-v2__kpi-label">Próximas</span>
                <strong>{loadingReservations ? '…' : activeReservations.length}</strong>
                <small>Desde hoy en adelante</small>
              </div>
            </article>

            <article className="admin-dashboard-v2__kpi-card admin-dashboard-v2__kpi-card--green">
              <span className="admin-dashboard-v2__kpi-icon"><FiUsers /></span>
              <div>
                <span className="admin-dashboard-v2__kpi-label">Usuarios activos</span>
                <strong>{loadingUsers ? '…' : activeUsers}</strong>
                <small>Clientes y administradores</small>
              </div>
            </article>

            <article className="admin-dashboard-v2__kpi-card admin-dashboard-v2__kpi-card--amber">
              <span className="admin-dashboard-v2__kpi-icon"><FiMapPin /></span>
              <div>
                <span className="admin-dashboard-v2__kpi-label">Ocupación hoy</span>
                <strong>{loadingSpaces || loadingReservations ? '…' : `${occupancyToday}%`}</strong>
                <small>{occupiedSpacesToday} de {activeSpaces || 0} espacios</small>
              </div>
            </article>
          </div>

          <div className="admin-dashboard-v2__quick-card">
            <div className="admin-dashboard-v2__quick-copy">
              <span className="admin-dashboard-v2__quick-icon"><img src={calendarImg} alt="" /></span>
              <div>
                <h2>Agendar una reserva</h2>
                <p>Crea una reserva a nombre de un usuario que te contacte por teléfono, mail u otro canal.</p>
              </div>
            </div>
            <Link to="/admin/reservas/nueva" className="admin-dashboard-v2__secondary-action">
              Nueva reserva
            </Link>
          </div>

          <div className="admin-dashboard-v2__calendar-card admin-calendar-desktop-only">
            <AdminDayResourcesCalendar />
          </div>

          <section className="admin-mobile-occupancy-card" aria-label="Ocupación por espacio en mobile">
            <div className="admin-mobile-occupancy-card__head">
              <div>
                <h2>Ocupación por espacio</h2>
                <p>Vista rápida del uso diario. Tocá una card para ver el detalle.</p>
              </div>
              <input
                type="date"
                value={calendarDate}
                onChange={(e) => setCalendarDate(e.target.value)}
                aria-label="Fecha de ocupación"
              />
            </div>

            {loadingCalendar || loadingSpaces ? (
              <p className="admin-mobile-occupancy-card__loading">Cargando ocupación...</p>
            ) : mobileOccupancySpaces.length === 0 ? (
              <div className="admin-mobile-occupancy-card__empty">
                <strong>No hay espacios activos</strong>
                <p>Cuando actives espacios, aparecerán en esta vista.</p>
              </div>
            ) : (
              <div className="admin-mobile-occupancy-grid">
                {mobileOccupancySpaces.map((space) => (
                  <button
                    key={space.id}
                    type="button"
                    className="admin-mobile-space-card"
                    onClick={() => setSelectedOccupancySpace(space)}
                  >
                    <div className="admin-mobile-space-card__top">
                      <strong>{space.name}</strong>
                      <span>{space.percentage}%</span>
                    </div>
                    <div className="admin-mobile-space-card__bar" aria-hidden="true">
                      <span style={{ width: `${Math.min(space.percentage, 100)}%` }} />
                    </div>
                    <div className="admin-mobile-space-card__meta">
                      <span>{space.reservations.length} reservas</span>
                      <span>{Math.round(space.occupiedMinutes / 60 * 10) / 10} h ocupadas</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        </section>

        <div className="admin-dashboard-v2__lists">
          <div className="admin-card admin-dashboard-v2__approval-card">
            <div className="admin-dashboard-v2__card-head">
              <div>
                <h2>Reservas a aprobar</h2>
                <p>Solicitudes pendientes que requieren revisión del administrador.</p>
              </div>
              <span className="admin-dashboard-v2__count-pill">
                {loadingReservations ? '…' : pendingApprovalReservations.length}
              </span>
            </div>

            {loadingReservations ? (
              <p className="admin-dashboard-v2__empty-text">Cargando reservas pendientes...</p>
            ) : pendingApprovalReservations.length === 0 ? (
              <div className="admin-dashboard-v2__empty-state">
                <strong>No hay reservas pendientes de aprobación</strong>
                <p>Cuando un usuario genere una solicitud pendiente, aparecerá en esta sección.</p>
              </div>
            ) : (
              <div className="admin-dashboard-v2__approval-list">
                {pendingApprovalReservations.slice(0, 6).map((r) => {
                  const d = new Date(r.date);
                  const start = new Date(r.startTime);
                  const end = new Date(r.endTime);
                  const fechaStr = d.toLocaleDateString('es-ES', {
                    weekday: 'short',
                    day: '2-digit',
                    month: '2-digit',
                  });
                  const horaInicio = start.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const horaFin = end.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const userName = r.user?.name || r.user?.email || 'Usuario';

                  return (
                    <article key={r.id} className="admin-dashboard-v2__approval-item">
                      <div>
                        <strong>{r.space?.name || 'Espacio'}</strong>
                        <p>{userName} · {fechaStr} · {horaInicio} - {horaFin}</p>
                      </div>
                      <div className="admin-dashboard-v2__approval-actions">
                        <Link to={`/admin/reservas/${r.id}`} className="admin-dashboard-v2__icon-link" title="Ver detalle">
                          <FiEye />
                        </Link>
                        <button type="button" className="admin-dashboard-v2__approve-btn" onClick={() => handleApproveReservation(r)}>
                          Aprobar
                        </button>
                        <button type="button" className="admin-dashboard-v2__reject-btn" onClick={() => handleRejectReservation(r)}>
                          Rechazar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </div>

          <div className="admin-card admin-dashboard-v2__active-card">
            <div className="admin-dashboard-v2__card-head">
              <div>
                <h2>Reservas activas</h2>
                <p>Listado ordenado desde hoy hacia adelante.</p>
              </div>

              <div className="admin-dashboard-v2__status-filter" aria-label="Filtro de estado de reservas activas">
                {[
                  { value: 'ACTIVE', label: 'Activas' },
                  { value: 'APPROVED', label: 'Aprobadas' },
                  { value: 'ALL', label: 'Todas' },
                ].map((opt) => {
                  const active = statusFilter === opt.value;
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setStatusFilter(opt.value)}
                      aria-pressed={active}
                      className={active ? 'is-active' : ''}
                    >
                      {opt.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {loadingReservations ? (
              <p className="admin-dashboard-v2__empty-text">Cargando reservas activas...</p>
            ) : filteredReservations.length === 0 ? (
              <div className="admin-dashboard-v2__empty-state">
                <strong>No hay reservas activas desde hoy</strong>
                <p>Cuando existan reservas activas o aprobadas futuras, las verás listadas acá.</p>
              </div>
            ) : (
              <>
                <table className="admin-table admin-dashboard-v2__reservations-table">
                  <thead>
                    <tr>
                      <th>Espacio</th>
                      <th>Fecha</th>
                      <th>Franja</th>
                      <th>Usuario</th>
                      <th>Estado</th>
                      <th>Notas</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((r) => {
                      const d = new Date(r.date);
                      const start = new Date(r.startTime);
                      const end = new Date(r.endTime);

                      const fechaStr = d.toLocaleDateString('es-ES', {
                        weekday: 'short',
                        day: '2-digit',
                        month: '2-digit',
                      });

                      const horaInicio = start.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });
                      const horaFin = end.toLocaleTimeString('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                      });

                      const userName = r.user?.name || r.user?.email || '';
                      const status = String(r.status || '').toUpperCase();

                      return (
                        <tr key={r.id}>
                          <td>{r.space?.name || '—'}</td>
                          <td>{fechaStr}</td>
                          <td>{horaInicio} - {horaFin}</td>
                          <td>{userName}</td>
                          <td>
                            {status === 'APPROVED' ? (
                              <span className="badge blue">Aprobada</span>
                            ) : (
                              <span className="badge green">Activa</span>
                            )}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            {r.notes && String(r.notes).trim() ? (
                              <span title="Tiene notas" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                <FiFileText />
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>—</span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                              <Link
                                to={`/admin/reservas/nueva?edit=${r.id}`}
                                title="Ver detalles"
                                aria-label="Ver detalles"
                                style={{ display: 'inline-flex', padding: 6, borderRadius: 8 }}
                              >
                                <FiEye />
                              </Link>

                              <Link
                                to={`/admin/reservas/nueva?edit=${r.id}&mode=edit`}
                                title="Editar"
                                aria-label="Editar"
                                style={{ display: 'inline-flex', padding: 6, borderRadius: 8 }}
                              >
                                <FiEdit2 />
                              </Link>

                              <button
                                type="button"
                                onClick={() => handleCancelReservation(r)}
                                title="Cancelar"
                                aria-label="Cancelar"
                                style={{
                                  display: 'inline-flex',
                                  padding: 6,
                                  borderRadius: 8,
                                  border: 'none',
                                  background: 'transparent',
                                  cursor: 'pointer',
                                }}
                              >
                                <FiX />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>

                <div className="admin-dashboard-v2__pagination">
                  <button
                    type="button"
                    disabled={safePage === 1}
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  >
                    ◀
                  </button>
                  <span>
                    Página {safePage} de {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={safePage === totalPages}
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ▶
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Secciones de gestión existentes (espacios y usuarios) */}

        {/* Gestión de usuarios 
        <div className="admin-card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
            Usuarios
          </h2>

          {loadingUsers ? (
            <p>Cargando usuarios...</p>
          ) : users.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No hay usuarios registrados.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ width: '200px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const isAdmin = u.role === 'ADMIN';
                  return (
                    <tr key={u.id}>
                      <td>{u.name}</td>
                      <td>{u.email}</td>
                      <td>
                        <span className="chip">
                          {isAdmin ? 'Admin' : 'Cliente'}
                        </span>
                      </td>
                      <td>
                        {u.active ? (
                          <span className="badge green">Activo</span>
                        ) : (
                          <span className="badge red">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-small btn-outline"
                          onClick={() =>
                            handleChangeUserRole(u, isAdmin ? 'USER' : 'ADMIN')
                          }
                        >
                          {isAdmin ? 'Pasar a cliente' : 'Hacer admin'}
                        </button>
                        <button
                          className="btn-small btn-danger"
                          onClick={() => handleToggleUserActive(u)}
                        >
                          {u.active ? 'Desactivar' : 'Activar'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        ESTA ES LA PRIMERA VERSION DE USUARIOS, LA DEJO DE BACKUP POR UNOS DÍAS 20251215*/}
      

      {selectedOccupancyData && (
        <div
          className="admin-mobile-occupancy-modal"
          role="dialog"
          aria-modal="true"
          aria-label={`Detalle de ocupación de ${selectedOccupancyData.name}`}
          onClick={() => setSelectedOccupancySpace(null)}
        >
          <div className="admin-mobile-occupancy-modal__panel" onClick={(e) => e.stopPropagation()}>
            <div className="admin-mobile-occupancy-modal__head">
              <div>
                <span>Detalle del espacio</span>
                <h3>{selectedOccupancyData.name}</h3>
                <p>{selectedOccupancyData.percentage}% ocupado en el día seleccionado</p>
              </div>
              <button type="button" onClick={() => setSelectedOccupancySpace(null)} aria-label="Cerrar detalle">
                <FiX />
              </button>
            </div>

            <div className="admin-mobile-occupancy-modal__progress">
              <span style={{ width: `${Math.min(selectedOccupancyData.percentage || 0, 100)}%` }} />
            </div>

            {selectedOccupancyData.reservations?.length ? (
              <div className="admin-mobile-occupancy-timeline">
                {selectedOccupancyData.reservations.map((reservation) => {
                  const status = normalizeStatus(reservation.status);
                  return (
                    <Link
                      key={reservation.id}
                      to={`/admin/reservas/nueva?edit=${reservation.id}`}
                      className="admin-mobile-occupancy-timeline__item"
                      onClick={() => setSelectedOccupancySpace(null)}
                    >
                      <span className="admin-mobile-occupancy-timeline__time">
                        {formatShortTime(reservation.startTime)} - {formatShortTime(reservation.endTime)}
                      </span>
                      <strong>{getReservationUserName(reservation)}</strong>
                      <small>{status === 'PENDING' ? 'Pendiente de aprobación' : status === 'APPROVED' ? 'Aprobada' : 'Activa'}</small>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="admin-mobile-occupancy-modal__empty">
                <strong>Sin reservas para este día</strong>
                <p>Este espacio figura libre dentro del horario operativo.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal confirmación cancelación */}
      {cancelModalOpen && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
            zIndex: 9999,
          }}
          onClick={() => {
            if (!canceling) {
              setCancelModalOpen(false);
              setCancelTarget(null);
            }
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 520,
              background: '#fff',
              borderRadius: 14,
              padding: 18,
              boxShadow: '0 10px 30px rgba(0,0,0,0.2)',
            }}
          >
            <h3 style={{ marginTop: 0, marginBottom: 8 }}>Confirmar cancelación</h3>
            <p style={{ marginTop: 0, color: '#4b5563', fontSize: '0.95rem' }}>
              ¿Seguro que querés cancelar esta reserva?
            </p>

            <div style={{ fontSize: '0.9rem', color: '#111827', marginBottom: 14 }}>
              <div><strong>Espacio:</strong> {cancelTarget?.space?.name || '—'}</div>
              <div><strong>Usuario:</strong> {cancelTarget?.user?.name || cancelTarget?.user?.email || '—'}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
              <button
                type="button"
                className="btn-small"
                disabled={canceling}
                onClick={() => {
                  setCancelModalOpen(false);
                  setCancelTarget(null);
                }}
              >
                Volver
              </button>
              <button
                type="button"
                className="btn-small btn-danger"
                disabled={canceling}
                onClick={confirmCancelReservation}
              >
                {canceling ? 'Cancelando...' : 'Cancelar reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
</div>
    </Layout>
  );
}
