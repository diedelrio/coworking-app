import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom'; 
import api from '../api/axiosClient';
// Ajusta el import de Layout al que ya estés usando en AdminSpaces / DashboardAdmin
import Layout from '../components/Layout';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL'); // ALL | ACTIVE | INACTIVE
  const [roleFilter, setRoleFilter] = useState('ALL'); // ALL | ADMIN | CLIENT
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
      // Ojo: si tu axiosClient ya tiene baseURL /api, aquí va simplemente "/users"
      const response = await api.get('/users');
      setUsers(response.data || []);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios. Intenta nuevamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (!window.confirm(`¿Seguro que quieres ${user.active ? 'desactivar' : 'activar'} a ${user.name}?`)) {
      return;
    }

    try {
      setSaving(true);
      setError('');

      // Ajusta este endpoint según tu backend:
      // Opción típica: PUT /users/:id con { active: !user.active }
      const response = await api.put(`/users/${user.id}`, {
        active: !user.active,
      });

      const updated = response.data || {};
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u))
      );
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el estado del usuario.');
    } finally {
      setSaving(false);
    }
  };

  const filteredUsers = useMemo(() => {
    return users.filter((user) => {
      const matchesSearch =
        `${user.name || ''} ${user.lastName || ''} ${user.email || ''}`
          .toLowerCase()
          .includes(searchTerm.toLowerCase());

      const matchesStatus =
        statusFilter === 'ALL'
          ? true
          : statusFilter === 'ACTIVE'
          ? user.active
          : !user.active;

      const matchesRole =
        roleFilter === 'ALL' ? true : user.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, statusFilter, roleFilter]);

  return (
    <Layout>
      <div className="admin-page">
        <div className="admin-page-header">
          <h1>Gestión de usuarios</h1>
          <p className="admin-page-subtitle">
            Administra los usuarios del coworking: activar / desactivar cuentas, revisar datos y filtrar por estado.
          </p>
        </div>
        <button
          type="button"
          className="admin-button"
          onClick={() => navigate('/admin/usuarios/nuevo')}
        >
          + Nuevo usuario
        </button>
        
        {/* Filtros */}
        <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
          <div
            className="filters-row"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: '1 1 200px' }}>
              <label className="admin-label">Buscar</label>
              <input
                type="text"
                className="admin-input"
                placeholder="Nombre, apellido o email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div style={{ flex: '0 0 180px' }}>
              <label className="admin-label">Estado</label>
              <select
                className="admin-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="ACTIVE">Activos</option>
                <option value="INACTIVE">Inactivos</option>
              </select>
            </div>

            <div style={{ flex: '0 0 180px' }}>
              <label className="admin-label">Rol</label>
              <select
                className="admin-input"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
              >
                <option value="ALL">Todos</option>
                <option value="ADMIN">Admin</option>
                <option value="CLIENT">Cliente</option>
              </select>
            </div>

            <div style={{ flex: '0 0 auto', marginLeft: 'auto' }}>
              <button
                className="admin-button"
                type="button"
                onClick={fetchUsers}
                disabled={loading}
              >
                🔄 Recargar
              </button>
            </div>
          </div>
        </div>

        {/* Estado de carga / error */}
        {error && (
          <div className="admin-card" style={{ marginBottom: '1rem', borderLeft: '4px solid #f97373' }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
          </div>
        )}

        {loading ? (
          <div className="admin-card">
            <p>Cargando usuarios...</p>
          </div>
        ) : (
          <div className="admin-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: '0.75rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1rem' }}>
                Usuarios ({filteredUsers.length})
              </h2>
              {saving && (
                <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  Guardando cambios...
                </span>
              )}
            </div>

            {filteredUsers.length === 0 ? (
              <p>No hay usuarios que coincidan con el filtro.</p>
            ) : (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Nombre</th>
                      <th>Email</th>
                      <th>Teléfono</th>
                      <th>Rol</th>
                      <th>Estado</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((user) => (
                      <tr key={user.id}>
                        <td>
                          {user.name} {user.lastName}
                        </td>
                        <td>{user.email}</td>
                        <td>{user.phone || '-'}</td>
                        <td>
                          {user.role === 'ADMIN' ? (
                            <span className="tag tag-admin">Admin</span>
                          ) : (
                            <span className="tag tag-client">Cliente</span>
                          )}
                        </td>
                        <td>
                          {user.active ? (
                            <span className="tag tag-active">Activo</span>
                          ) : (
                            <span className="tag tag-inactive">Inactivo</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="admin-button-outline"
                            onClick={() => handleToggleActive(user)}
                            disabled={saving}
                          >
                            {user.active ? 'Desactivar' : 'Activar'}
                          </button>

                          <button
                            type="button"
                            className="admin-button-outline"
                            style={{ marginLeft: '0.5rem' }}
                            onClick={() => navigate(`/admin/usuarios/${user.id}`)}
                          >
                            Editar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
