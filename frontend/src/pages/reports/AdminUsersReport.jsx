import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api/axiosClient';
import Layout from '../../components/Layout';

const CLASSIFY_OPTIONS = [
  { value: 'ALL', label: 'Todas' },
  { value: 'GOOD', label: 'GOOD' },
  { value: 'REGULAR', label: 'REGULAR' },
  { value: 'BAD', label: 'BAD' },
  { value: 'EMPTY', label: 'Sin clasificación' },
];

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
];

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('es-ES');
}

function buildExcelRows(users = []) {
  return users.map((user) => ({
    ID: user.id,
    Nombre: user.name || '',
    Apellido: user.lastName || '',
    Email: user.email || '',
    Telefono: user.phone || '',
    Rol: user.role || '',
    Clasificacion: user.classify || '',
    Estado: user.active ? 'Activo' : 'Inactivo',
    Tags: Array.isArray(user.userTags)
      ? user.userTags
          .map((item) => item?.tag?.name)
          .filter(Boolean)
          .join(', ')
      : '',
    'Fecha alta': formatDateTime(user.createdAt),
  }));
}

export default function AdminUsersReport() {
  const [filters, setFilters] = useState({
    search: '',
    status: 'ALL',
    classify: 'ALL',
    tagId: 'ALL',
  });

  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadTags();
  }, []);

  useEffect(() => {
    fetchUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadTags = async () => {
    try {
      const { data } = await api.get('/admin/tags');
      setTags(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setTags([]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      const search = filters.search.trim();

      if (search) params.search = search;
      if (filters.status !== 'ALL') params.status = filters.status;
      if (filters.classify !== 'ALL') params.classify = filters.classify;
      if (filters.tagId !== 'ALL') params.tagId = filters.tagId;

      const { data } = await api.get('/users', { params });
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setError('No se pudo obtener el reporte de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => buildExcelRows(users), [users]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const resetFilters = async () => {
    const next = {
      search: '',
      status: 'ALL',
      classify: 'ALL',
      tagId: 'ALL',
    };

    setFilters(next);

    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setUsers([]);
      setError('No se pudo restablecer el reporte de usuarios.');
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      setExporting(true);
      setError('');

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Usuarios');
      XLSX.writeFile(workbook, 'reporte_usuarios.xlsx');
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <Layout>
      <div className="admin-page">
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
            <h1 style={{ marginBottom: 6 }}>Consulta usuarios</h1>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              Consulta el padrón completo de usuarios, aplica filtros y descarga el resultado en Excel.
            </p>
          </div>

          <button
            type="button"
            className="pill-button"
            onClick={exportToExcel}
            disabled={loading || exporting || rows.length === 0}
            style={{ whiteSpace: 'nowrap' }}
          >
            {exporting ? 'Generando Excel...' : 'Descargar Excel'}
          </button>
        </div>

        <div className="admin-card" style={{ marginBottom: '1.25rem' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              alignItems: 'flex-end',
            }}
          >
            <div style={{ flex: '1 1 260px' }}>
              <label className="admin-label">Buscar</label>
              <input
                type="text"
                className="admin-input"
                placeholder="Nombre, apellido o email..."
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
              />
            </div>

            <div style={{ flex: '0 0 180px' }}>
              <label className="admin-label">Estado</label>
              <select
                className="admin-input"
                value={filters.status}
                onChange={(e) => handleFilterChange('status', e.target.value)}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '0 0 180px' }}>
              <label className="admin-label">Clasificación</label>
              <select
                className="admin-input"
                value={filters.classify}
                onChange={(e) => handleFilterChange('classify', e.target.value)}
              >
                {CLASSIFY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '0 0 220px' }}>
              <label className="admin-label">Tag</label>
              <select
                className="admin-input"
                value={filters.tagId}
                onChange={(e) => handleFilterChange('tagId', e.target.value)}
              >
                <option value="ALL">Todos</option>
                {tags.map((tag) => (
                  <option key={tag.id} value={String(tag.id)}>
                    {tag.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
              <button
                className="pill-button-outline"
                type="button"
                onClick={resetFilters}
                disabled={loading}
                style={{
                  height: 36,
                  borderRadius: 999,
                  padding: '0 14px',
                  fontWeight: 700,
                }}
              >
                Limpiar
              </button>

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
                {loading ? 'Cargando...' : 'Consultar'}
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="admin-card" style={{ marginBottom: '1rem', borderLeft: '4px solid #f97373' }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
          </div>
        )}

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
              Resultado ({users.length})
            </h2>

            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              La descarga respeta exactamente los filtros aplicados.
            </span>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Cargando usuarios...</p>
          ) : users.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>
              No hay usuarios para los filtros seleccionados.
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
                    <th>Clasificación</th>
                    <th>Estado</th>
                    <th>Tags</th>
                    <th>Alta</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => {
                    const tagsLabel = Array.isArray(user.userTags)
                      ? user.userTags
                          .map((item) => item?.tag?.name)
                          .filter(Boolean)
                          .join(', ')
                      : '';

                    return (
                      <tr key={user.id}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>
                          {`${user.name || ''} ${user.lastName || ''}`.trim() || '—'}
                        </td>
                        <td>{user.email || '—'}</td>
                        <td>{user.phone || '—'}</td>
                        <td>{user.role || '—'}</td>
                        <td>{user.classify || '—'}</td>
                        <td>{user.active ? 'Activo' : 'Inactivo'}</td>
                        <td>{tagsLabel || '—'}</td>
                        <td>{formatDateTime(user.createdAt)}</td>
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