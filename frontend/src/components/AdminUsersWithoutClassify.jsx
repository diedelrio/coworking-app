import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';

export default function AdminUsersWithoutClassify() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/users/missing-classify');
      setUsers(res.data || []);
    } catch (err) {
      console.error(err);
      setError('No se pudieron cargar los usuarios sin classify.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  return (
    <div className="admin-card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '0.75rem',
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: '1rem' }}>
            Usuarios sin clasificación
          </h2>
          <p style={{ margin: 0, fontSize: '0.85rem', color: '#6b7280' }}>
            Usuarios nuevos que aún no tienen classify asignado.
          </p>
        </div>

        <button
          type="button"
          className="admin-button-outline"
          onClick={loadUsers}
          disabled={loading}
        >
          {loading ? 'Actualizando...' : 'Actualizar'}
        </button>
      </div>

      {error && (
        <p style={{ color: '#b91c1c', fontSize: '0.9rem' }}>{error}</p>
      )}

      {loading ? (
        <p style={{ color: '#6b7280' }}>Cargando usuarios...</p>
      ) : users.length === 0 ? (
        <p style={{ color: '#6b7280' }}>
          No hay usuarios pendientes de clasificación.
        </p>
      ) : (
        <div className="admin-table-wrapper">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Email</th>
                <th>Creado</th>
                <th style={{ width: 180 }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>
                    {`${u.name || ''} ${u.lastName || ''}`.trim() ||
                      `Usuario #${u.id}`}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    {u.createdAt
                      ? new Date(u.createdAt).toLocaleString()
                      : '-'}
                  </td>
                  <td>
                    <Link
                      to={`/admin/usuarios/${u.id}`}
                      style={{ textDecoration: 'none' }}
                    >
                      <button className="admin-button">
                        Clasificar
                      </button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
