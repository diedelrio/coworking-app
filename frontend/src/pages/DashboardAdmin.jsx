import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import { getCurrentUser } from '../utils/auth';
import calendarImg from '../images/calendar-illustration.png';

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
  const [loadingReservations, setLoadingReservations] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState('');

  // Calendario rápido por espacio (día)
  const [calendarSpaceId, setCalendarSpaceId] = useState('');
  const [calendarDate, setCalendarDate] = useState(() =>
    formatDateInput(new Date())
  );
  const [calendarReservations, setCalendarReservations] = useState([]);
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Paginación reservas futuras
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

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

      if (!calendarSpaceId && res.data.length > 0) {
        setCalendarSpaceId(String(res.data[0].id));
      }
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
          const spaceA = a.space?.name || '';
          const spaceB = b.space?.name || '';
          const cmpSpace = spaceA.localeCompare(spaceB);
          if (cmpSpace !== 0) return cmpSpace;

          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          const cmpDate = dateA - dateB;
          if (cmpDate !== 0) return cmpDate;

          return new Date(a.startTime) - new Date(b.startTime);
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
    if (!calendarSpaceId) return;

    try {
      setLoadingCalendar(true);
      const res = await api.get(`/reservations/space/${calendarSpaceId}`, {
        params: {
          from: calendarDate,
          to: calendarDate,
        },
      });
      setCalendarReservations(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCalendar(false);
    }
  }
  async function handleCancelReservation(id) {
  if (!window.confirm('¿Seguro que quieres cancelar esta reserva?')) return;

  try {
    await api.delete(`/reservations/${id}`);
    await fetchReservations(); // recarga la tabla
  } catch (err) {
    console.error(err);
    setError('Error al cancelar la reserva');
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

  const totalPages = Math.max(1, Math.ceil(reservations.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const pageItems = reservations.slice(startIndex, startIndex + pageSize);

  return (
    <Layout user={user}>
      <div className="admin-page">
        {/* Encabezado Dashboard */}
        <div
          className="admin-header"
          style={{ justifyContent: 'space-between', marginBottom: '1.25rem' }}
        >
          <div>
            <h1>Panel de administrador</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Visión general de reservas y gestión del coworking
            </span>
          </div>
        </div>

        {error && (
          <div className="error" style={{ maxWidth: 700, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Card acción rápida: agendar reserva */}
        <div
          className="admin-card"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '1.5rem',
          }}
        >
          <div>
            <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.1rem' }}>
              Agendar una reserva
            </h2>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#6b7280' }}>
              Crea una reserva a nombre de un usuario que te contacte por teléfono, mail u otro canal.
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <img
              src={calendarImg}
              alt="Calendario"
              style={{ width: 64, height: 64, objectFit: 'contain' }}
            />
            <Link
              to="/admin/reservas/nueva"
              style={{
                padding: '0.6rem 1.2rem',
                borderRadius: '999px',
                background: '#4f46e5',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
              }}
            >
              Nueva reserva
            </Link>
          </div>
        </div>

        {/* Calendario rápido por espacio (día) */}
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              marginBottom: '0.75rem',
              gap: '1rem',
            }}
          >
            <div>
              <h2 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '1.1rem' }}>
                Calendario por espacio
              </h2>
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Revisa rápidamente las reservas de hoy para un espacio concreto.
              </span>
            </div>

            <Link
              to={
                calendarSpaceId
                  ? `/admin/calendar?spaceId=${calendarSpaceId}&date=${calendarDate}`
                  : '/admin/calendar'
              }
              style={{
                fontSize: '0.85rem',
                padding: '0.35rem 0.9rem',
                borderRadius: '999px',
                border: '1px solid #d1d5db',
                textDecoration: 'none',
                color: '#4f46e5',
                alignSelf: 'flex-start',
                whiteSpace: 'nowrap',
              }}
            >
              Ver vista completa
            </Link>
          </div>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '0.75rem',
            }}
          >
            <div style={{ minWidth: 220 }}>
              <label
                style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}
              >
                Espacio
              </label>
              <select
                value={calendarSpaceId}
                onChange={(e) => setCalendarSpaceId(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem 0.7rem',
                  fontSize: '0.9rem',
                }}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ minWidth: 180 }}>
              <label
                style={{ display: 'block', fontSize: '0.8rem', marginBottom: '0.2rem' }}
              >
                Fecha
              </label>
              <input
                type="date"
                value={calendarDate}
                onChange={(e) => setCalendarDate(e.target.value)}
                style={{
                  width: '100%',
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem 0.7rem',
                  fontSize: '0.9rem',
                }}
              />
            </div>
          </div>

          {/* Lista de reservas del día para el espacio */}
          {loadingCalendar ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>Cargando calendario...</p>
          ) : calendarReservations.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No hay reservas para esta fecha en este espacio.
            </p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {calendarReservations
                .slice()
                .sort(
                  (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
                )
                .map((r) => {
                  const start = new Date(r.startTime);
                  const end = new Date(r.endTime);
                  const horaInicio = start.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const horaFin = end.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const userName = r.user?.name || r.user?.email || '';

                  return (
                    <li
                      key={r.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '0.5rem 0.3rem',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600 }}>
                          {horaInicio} – {horaFin}
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                          Usuario: {userName || '—'}
                        </div>
                      </div>
                      <div>
                        {r.status === 'CANCELLED' ? (
                          <span className="badge red">Cancelada</span>
                        ) : (
                          <span className="badge green">Activa</span>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>

        {/* Tabla de reservas (hoy en adelante) */}
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.1rem' }}>
            Reservas desde hoy
          </h2>

          {loadingReservations ? (
            <p>Cargando reservas...</p>
          ) : reservations.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No hay reservas próximas registradas.
            </p>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Espacio</th>
                    <th>Fecha</th>
                    <th>Franja</th>
                    <th>Usuario</th>
                    <th>Estado</th>
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

                    return (
                      <tr key={r.id}>
                        <td>{r.space?.name || '—'}</td>
                        <td>{fechaStr}</td>
                        <td>{horaInicio} - {horaFin}</td>
                        <td>{userName}</td>
                        <td>
                          {r.status === 'CANCELLED' ? (
                            <span className="badge red">Cancelada</span>
                          ) : (
                            <span className="badge green">Activa</span>
                          )}
                        </td>
                        <td>
                          {r.status !== 'CANCELLED' ? (
                            <button
                              className="btn-small btn-danger"
                              onClick={() => handleCancelReservation(r.id)}
                            >
                              Cancelar
                            </button>
                          ) : (
                            <span style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                              —
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* paginado simple */}
              <div
                style={{
                  marginTop: '0.5rem',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.85rem',
                }}
              >
                <button
                  type="button"
                  disabled={safePage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '999px',
                    border: '1px solid #d1d5db',
                    background: safePage === 1 ? '#f9fafb' : '#ffffff',
                    cursor: safePage === 1 ? 'default' : 'pointer',
                  }}
                >
                  ◀
                </button>
                <span>
                  Página {safePage} de {totalPages}
                </span>
                <button
                  type="button"
                  disabled={safePage === totalPages}
                  onClick={() =>
                    setCurrentPage((p) => Math.min(totalPages, p + 1))
                  }
                  style={{
                    padding: '0.25rem 0.6rem',
                    borderRadius: '999px',
                    border: '1px solid #d1d5db',
                    background: safePage === totalPages ? '#f9fafb' : '#ffffff',
                    cursor: safePage === totalPages ? 'default' : 'pointer',
                  }}
                >
                  ▶
                </button>
              </div>
            </>
          )}
        </div>

        {/* Secciones de gestión existentes (espacios y usuarios) */}

        {/* Gestión de usuarios */}
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
      </div>
    </Layout>
  );
}
