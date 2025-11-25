import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';

const SPACE_TYPES = [
  { value: 'FIX_DESK', label: 'Puesto fijo' },
  { value: 'FLEX_DESK', label: 'Puesto flex' },
  { value: 'MEETING_ROOM', label: 'Sala de reuniones' },
];

export default function DashboardAdmin() {
  const [spaces, setSpaces] = useState([]);
  const [loadingSpaces, setLoadingSpaces] = useState(false);
  const [savingSpace, setSavingSpace] = useState(false);

  const [reservations, setReservations] = useState([]);
  const [loadingReservations, setLoadingReservations] = useState(false);

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);

  const [error, setError] = useState('');

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
      const res = await api.get('/reservations'); // todas las reservas (admin)
      setReservations(res.data);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar las reservas');
    } finally {
      setLoadingReservations(false);
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
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === 'capacity' ? Number(value) : value,
    }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSavingSpace(true);
    setError('');

    try {
      if (editingId) {
        await api.put(`/spaces/${editingId}`, form);
      } else {
        await api.post('/spaces', form);
      }

      await fetchSpaces();
      resetForm();
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
    if (u.role === newRole) return;

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

  return (
    <div>
      <Header user={user} />

      <div className="admin-page">
        <div
          className="admin-header"
          style={{ justifyContent: 'space-between' }}
        >
          <div>
            <h1>Panel de administrador</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Gestión de espacios, reservas y usuarios
            </span>
          </div>

          <Link
            to="/admin/calendar"
            style={{
              fontSize: '0.85rem',
              padding: '0.35rem 0.9rem',
              borderRadius: '999px',
              border: '1px solid #d1d5db',
              textDecoration: 'none',
              color: '#4f46e5',
            }}
          >
            Ver calendario por espacio
          </Link>
        </div>

        {error && (
          <div className="error" style={{ maxWidth: 600, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Gestión de espacios */}
        <div className="admin-grid">
          {/* Listado de espacios */}
          <div className="admin-card">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
              Espacios
            </h2>

            {loadingSpaces ? (
              <p>Cargando espacios...</p>
            ) : spaces.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                No hay espacios todavía. Crea el primero con el formulario de la derecha.
              </p>
            ) : (
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Tipo</th>
                    <th>Capacidad</th>
                    <th>Estado</th>
                    <th style={{ width: '150px' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {spaces.map((space) => (
                    <tr key={space.id}>
                      <td>{space.name}</td>
                      <td>
                        <span className="chip">
                          {SPACE_TYPES.find((t) => t.value === space.type)?.label ||
                            space.type}
                        </span>
                      </td>
                      <td>{space.capacity}</td>
                      <td>
                        {space.active ? (
                          <span className="badge green">Activo</span>
                        ) : (
                          <span className="badge red">Inactivo</span>
                        )}
                      </td>
                      <td>
                        <button
                          className="btn-small btn-outline"
                          onClick={() => handleEdit(space)}
                        >
                          Editar
                        </button>
                        {space.active && (
                          <button
                            className="btn-small btn-danger"
                            onClick={() => handleDeactivate(space.id)}
                          >
                            Desactivar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {/* Formulario crear/editar espacio */}
          <div className="admin-card">
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
              {editingId ? 'Editar espacio' : 'Nuevo espacio'}
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Nombre</label>
                <input
                  name="name"
                  type="text"
                  value={form.name}
                  onChange={handleChange}
                  placeholder="Ej: Sala Mareas"
                  required
                />
              </div>

              <div className="form-group">
                <label>Tipo</label>
                <select
                  name="type"
                  value={form.type}
                  onChange={handleChange}
                  style={{
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                  }}
                >
                  {SPACE_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Capacidad</label>
                <input
                  name="capacity"
                  type="number"
                  min="1"
                  value={form.capacity}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Descripción</label>
                <textarea
                  name="description"
                  value={form.description}
                  onChange={handleChange}
                  rows={3}
                  style={{
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                    resize: 'vertical',
                  }}
                  placeholder="Ej: Pantalla, pizarra, buena luz natural..."
                />
              </div>

              {editingId && (
                <div className="form-group">
                  <label>Estado</label>
                  <select
                    name="active"
                    value={form.active ? 'true' : 'false'}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        active: e.target.value === 'true',
                      }))
                    }
                    style={{
                      borderRadius: '0.5rem',
                      border: '1px solid #d1d5db',
                      padding: '0.6rem 0.8rem',
                      fontSize: '0.95rem',
                    }}
                  >
                    <option value="true">Activo</option>
                    <option value="false">Inactivo</option>
                  </select>
                </div>
              )}

              <button className="button" type="submit" disabled={savingSpace}>
                {savingSpace
                  ? 'Guardando...'
                  : editingId
                  ? 'Guardar cambios'
                  : 'Crear espacio'}
              </button>

              {editingId && (
                <button
                  type="button"
                  className="button"
                  style={{
                    marginTop: '0.5rem',
                    background: '#e5e7eb',
                    color: '#111827',
                  }}
                  onClick={resetForm}
                >
                  Cancelar edición
                </button>
              )}
            </form>
          </div>
        </div>

        {/* Tabla de todas las reservas */}
        <div className="admin-card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
            Todas las reservas
          </h2>

          {loadingReservations ? (
            <p>Cargando reservas...</p>
          ) : reservations.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No hay reservas registradas todavía.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Franja</th>
                  <th>Espacio</th>
                  <th>Usuario</th>
                  <th>Estado</th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const dateObj = new Date(r.date);
                  const start = new Date(r.startTime);
                  const end = new Date(r.endTime);

                  const fecha = dateObj.toLocaleDateString('es-ES');
                  const horaInicio = start.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const horaFin = end.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  return (
                    <tr key={r.id}>
                      <td>{fecha}</td>
                      <td>
                        {horaInicio} - {horaFin}
                      </td>
                      <td>{r.space?.name}</td>
                      <td>
                        {r.user
                          ? `${r.user.name} ${r.user.lastName} (${r.user.email})`
                          : '—'}
                      </td>
                      <td>
                        {r.status === 'CANCELLED' ? (
                          <span className="badge red">Cancelada</span>
                        ) : (
                          <span className="badge green">Activa</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Gestión de usuarios */}
        <div className="admin-card" style={{ marginTop: '1.5rem' }}>
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
            Usuarios
          </h2>

          {loadingUsers ? (
            <p>Cargando usuarios...</p>
          ) : users.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No hay usuarios registrados todavía.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Email</th>
                  <th>Teléfono</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ width: '200px' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => {
                  const fullName = `${u.name || ''} ${u.lastName || ''}`.trim() || '—';
                  const isAdmin = u.role === 'ADMIN';

                  return (
                    <tr key={u.id}>
                      <td>{fullName}</td>
                      <td>{u.email}</td>
                      <td>{u.phone || '—'}</td>
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
    </div>
  );
}
