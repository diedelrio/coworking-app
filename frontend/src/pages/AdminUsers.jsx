import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import AdminUsersWithoutClassify from '../components/AdminUsersWithoutClassify';

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');
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
    const action = user.active ? 'desactivar' : 'activar';
    if (!window.confirm(`¿Seguro que quieres ${action} a ${user.email}?`)) return;

    try {
      setSaving(true);
      setError('');

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

  const handleToggleRole = async (user) => {
    const nextRole = user.role === 'ADMIN' ? 'CLIENT' : 'ADMIN';
    const label = nextRole === 'ADMIN' ? 'hacer admin' : 'pasar a cliente';

    if (!window.confirm(`¿Seguro que quieres ${label} a ${user.email}?`)) return;

    try {
      setSaving(true);
      setError('');

      const response = await api.put(`/users/${user.id}`, {
        role: nextRole,
      });

      const updated = response.data || {};
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, ...updated } : u))
      );
    } catch (err) {
      console.error(err);
      setError('No se pudo actualizar el rol del usuario.');
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

      const matchesRole = roleFilter === 'ALL' ? true : user.role === roleFilter;

      return matchesSearch && matchesStatus && matchesRole;
    });
  }, [users, searchTerm, statusFilter, roleFilter]);

  return (
    <Layout>
      <div className="admin-page">
        {/* Header */}
        <div
          className="admin-page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: '1rem',
            marginBottom: '1rem',
          }}
        >
          <div>
            <h1 style={{ marginBottom: 6 }}>Gestión de usuarios</h1>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              Administra los usuarios del coworking: activar / desactivar cuentas, revisar datos y filtrar por estado.
            </p>
          </div>

          <button
            type="button"
            className="pill-button"
            onClick={() => navigate('/admin/usuarios/nuevo')}
            style={{ whiteSpace: 'nowrap' }}
          >
            + Nuevo usuario
          </button>
        </div>

        {/* Usuarios sin classify */}
        <div style={{ marginBottom: '1.5rem' }}>
          <AdminUsersWithoutClassify />
        </div>

        {/* Filtros */}
        <div className="admin-card" style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'center',
            }}
          >
            <div style={{ flex: '1 1 260px' }}>
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
                className="pill-button-outline"
                type="button"
                onClick={fetchUsers}
                disabled={loading}
                style={{
                  height: 36,
                  borderRadius: 999,
                  padding: '0 14px',
                  fontWeight: 700,
                }}
              >
                {loading ? 'Cargando...' : 'Recargar'}
              </button>
            </div>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="admin-card" style={{ marginBottom: '1rem', borderLeft: '4px solid #f97373' }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
          </div>
        )}

        {/* Tabla */}
        <div className="admin-card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: 12,
              marginBottom: '0.9rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 800 }}>
              Usuarios ({filteredUsers.length})
            </h2>

            {saving && (
              <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
                Guardando cambios...
              </span>
            )}
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Cargando usuarios...</p>
          ) : filteredUsers.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>
              No hay usuarios que coincidan con el filtro.
            </p>
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
                    <th style={{ width: 260, textAlign: 'right' }}>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredUsers.map((u) => {
                    const isAdmin = u.role === 'ADMIN';

                    return (
                      <tr key={u.id}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>
                          {`${u.name || ''} ${u.lastName || ''}`.trim() || '—'}
                        </td>

                        <td style={{ color: '#0f172a' }}>{u.email}</td>

                        <td style={{ color: '#0f172a' }}>{u.phone || '—'}</td>

                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.7rem',
                              borderRadius: 999,
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: isAdmin ? '#eef2ff' : '#f1f5f9',
                              color: isAdmin ? '#4338ca' : '#0f172a',
                              border: `1px solid ${isAdmin ? '#c7d2fe' : '#e2e8f0'}`,
                            }}
                          >
                            {isAdmin ? 'Admin' : 'Cliente'}
                          </span>
                        </td>

                        <td>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '0.25rem 0.7rem',
                              borderRadius: 999,
                              fontSize: '0.8rem',
                              fontWeight: 700,
                              background: u.active ? '#ecfdf5' : '#fef2f2',
                              color: u.active ? '#166534' : '#b91c1c',
                              border: `1px solid ${u.active ? '#bbf7d0' : '#fecaca'}`,
                            }}
                          >
                            {u.active ? 'Activo' : 'Inactivo'}
                          </span>
                        </td>

                        <td style={{ textAlign: 'right' }}>
                          <div style={{ display: 'inline-flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                            {/*<button
                              type="button"
                              onClick={() => handleToggleRole(u)}
                              disabled={saving}
                              style={{
                                height: 34,
                                padding: '0 12px',
                                borderRadius: 999,
                                border: '1px solid #d1d5db',
                                background: '#ffffff',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 700,
                                color: '#0f172a',
                                opacity: saving ? 0.7 : 1,
                              }}
                            >
                              {isAdmin ? 'Pasar a cliente' : 'Hacer admin'}
                            </button> */}

                            <button
                              type="button"
                              onClick={() => handleToggleActive(u)}
                              disabled={saving}
                              style={{
                                height: 30,
                                padding: '0 12px',
                                borderRadius: 999,
                                border: `0px solid ${u.active ? '#fecaca' : '#bbf7d0'}`,
                                background: u.active ? '#fff1f2' : '#ecfdf5',
                                cursor: saving ? 'not-allowed' : 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 400,
                                color: u.active ? '#b91c1c' : '#166534',
                                opacity: saving ? 0.7 : 1,
                                width: '55%',
                              }}
                            >
                              {u.active ? 'Desactivar' : 'Activar'}
                            </button>

                            <button
                              type="button"
                              onClick={() => navigate(`/admin/usuarios/${u.id}`)}
                              style={{
                                height: 30,
                                padding: '0 12px',
                                borderRadius: 999,
                                border: '0px solid #49af70ff',
                                background: '#dcfce7',
                                cursor: 'pointer',
                                fontSize: '0.85rem',
                                fontWeight: 400,
                                color: '#0f172a',
                              }}
                            >
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
