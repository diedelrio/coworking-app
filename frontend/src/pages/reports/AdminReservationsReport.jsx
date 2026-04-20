import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import api from '../../api/axiosClient';
import Layout from '../../components/Layout';

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'Todos' },
  { value: 'ACTIVE', label: 'ACTIVE' },
  { value: 'PENDING', label: 'PENDING' },
  { value: 'CANCELLED', label: 'CANCELLED' },
  { value: 'REJECTED', label: 'REJECTED' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'PENALIZED', label: 'PENALIZED' },
  { value: 'INVOICED', label: 'INVOICED' },
];

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('es-ES');
}

function formatTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function buildExcelRows(reservations = []) {
  return reservations.map((reservation) => ({
    ID: reservation.id,
    Fecha: formatDate(reservation.date),
    Inicio: formatTime(reservation.startTime),
    Fin: formatTime(reservation.endTime),
    Espacio: reservation.space?.name || '',
    'Tipo espacio': reservation.space?.type || '',
    Usuario: `${reservation.user?.name || ''} ${reservation.user?.lastName || ''}`.trim(),
    Email: reservation.user?.email || '',
    Estado: reservation.status || '',
    Asistentes: reservation.attendees ?? '',
    Proposito: reservation.purpose || '',
    Notas: reservation.notes || '',
    'Creada en': reservation.createdAt ? new Date(reservation.createdAt).toLocaleString('es-ES') : '',
  }));
}

export default function AdminReservationsReport() {
  const [filters, setFilters] = useState({
    userId: 'ALL',
    spaceId: 'ALL',
    status: 'ALL',
  });

  const [reservations, setReservations] = useState([]);
  const [users, setUsers] = useState([]);
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      setError('');

      const [reservationsRes, usersRes, spacesRes] = await Promise.all([
        api.get('/reservations'),
        api.get('/users'),
        api.get('/spaces'),
      ]);

      setReservations(Array.isArray(reservationsRes.data) ? reservationsRes.data : []);
      setUsers(Array.isArray(usersRes.data) ? usersRes.data : []);
      setSpaces(Array.isArray(spacesRes.data) ? spacesRes.data : []);
    } catch (err) {
      console.error(err);
      setReservations([]);
      setUsers([]);
      setSpaces([]);
      setError('No se pudo cargar el reporte de reservas.');
    } finally {
      setLoading(false);
    }
  };

  const fetchReservations = async () => {
    try {
      setLoading(true);
      setError('');

      const params = {};
      if (filters.userId !== 'ALL') params.userId = filters.userId;
      if (filters.spaceId !== 'ALL') params.spaceId = filters.spaceId;
      if (filters.status !== 'ALL') params.status = filters.status;

      const { data } = await api.get('/reservations', { params });
      setReservations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReservations([]);
      setError('No se pudo obtener el reporte de reservas.');
    } finally {
      setLoading(false);
    }
  };

  const resetFilters = async () => {
    const next = {
      userId: 'ALL',
      spaceId: 'ALL',
      status: 'ALL',
    };

    setFilters(next);

    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/reservations');
      setReservations(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
      setReservations([]);
      setError('No se pudo restablecer el reporte de reservas.');
    } finally {
      setLoading(false);
    }
  };

  const rows = useMemo(() => buildExcelRows(reservations), [reservations]);

  const exportToExcel = async () => {
    try {
      setExporting(true);
      setError('');

      const worksheet = XLSX.utils.json_to_sheet(rows);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'Reservas');
      XLSX.writeFile(workbook, 'reporte_reservas.xlsx');
    } catch (err) {
      console.error(err);
      setError('No se pudo generar el archivo Excel.');
    } finally {
      setExporting(false);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
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
            <h1 style={{ marginBottom: 6 }}>Consulta reservas</h1>
            <p className="admin-page-subtitle" style={{ margin: 0 }}>
              Consulta todas las reservas, aplica filtros y descarga el resultado en Excel.
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
              <label className="admin-label">Usuario</label>
              <select
                className="admin-input"
                value={filters.userId}
                onChange={(e) => handleFilterChange('userId', e.target.value)}
              >
                <option value="ALL">Todos</option>
                {users.map((user) => (
                  <option key={user.id} value={String(user.id)}>
                    {`${user.name || ''} ${user.lastName || ''}`.trim()}{user.email ? ` - ${user.email}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '1 1 240px' }}>
              <label className="admin-label">Espacio</label>
              <select
                className="admin-input"
                value={filters.spaceId}
                onChange={(e) => handleFilterChange('spaceId', e.target.value)}
              >
                <option value="ALL">Todos</option>
                {spaces.map((space) => (
                  <option key={space.id} value={String(space.id)}>
                    {space.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ flex: '0 0 220px' }}>
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
                onClick={fetchReservations}
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
              Resultado ({reservations.length})
            </h2>

            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              La descarga respeta exactamente los filtros aplicados.
            </span>
          </div>

          {loading ? (
            <p style={{ color: '#6b7280', margin: 0 }}>Cargando reservas...</p>
          ) : reservations.length === 0 ? (
            <p style={{ color: '#6b7280', margin: 0 }}>
              No hay reservas para los filtros seleccionados.
            </p>
          ) : (
            <div className="admin-table-wrapper">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Inicio</th>
                    <th>Fin</th>
                    <th>Espacio</th>
                    <th>Usuario</th>
                    <th>Email</th>
                    <th>Estado</th>
                    <th>Asistentes</th>
                  </tr>
                </thead>
                <tbody>
                  {reservations.map((reservation) => (
                    <tr key={reservation.id}>
                      <td>{formatDate(reservation.date)}</td>
                      <td>{formatTime(reservation.startTime)}</td>
                      <td>{formatTime(reservation.endTime)}</td>
                      <td>{reservation.space?.name || '—'}</td>
                      <td>
                        {`${reservation.user?.name || ''} ${reservation.user?.lastName || ''}`.trim() || '—'}
                      </td>
                      <td>{reservation.user?.email || '—'}</td>
                      <td>{reservation.status || '—'}</td>
                      <td>{reservation.attendees ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}