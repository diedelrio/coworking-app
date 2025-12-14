import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatTime(dateStr) {
  try {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return dateStr;
  }
}

export default function AdminDashboardWidgets() {
  const [pending, setPending] = useState([]);
  const [loadingPending, setLoadingPending] = useState(true);

  const [missingClassify, setMissingClassify] = useState([]);
  const [loadingMissing, setLoadingMissing] = useState(true);

  const [actionBusyId, setActionBusyId] = useState(null);
  const [error, setError] = useState('');

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      // ✅ endpoint esperado: GET /api/reservations/pending
      const res = await api.get('/reservations/pending');
      setPending(res.data || []);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || 'No se pudieron cargar las reservas pendientes.');
    } finally {
      setLoadingPending(false);
    }
  };

  const loadMissingClassify = async () => {
    setLoadingMissing(true);
    try {
      // ✅ endpoint esperado: GET /api/users/missing-classify
      const res = await api.get('/users/missing-classify');
      setMissingClassify(res.data || []);
    } catch (e) {
      console.error(e);
      setError((prev) => prev || 'No se pudieron cargar los usuarios sin classify.');
    } finally {
      setLoadingMissing(false);
    }
  };

  useEffect(() => {
    setError('');
    loadPending();
    loadMissingClassify();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const approveReservation = async (id) => {
    setActionBusyId(id);
    setError('');
    try {
      // ✅ endpoint esperado: PATCH /api/reservations/:id/approve
      await api.patch(`/reservations/${id}/approve`);
      await loadPending();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo aprobar la reserva.');
    } finally {
      setActionBusyId(null);
    }
  };

  const cancelReservation = async (id) => {
    setActionBusyId(id);
    setError('');
    try {
      // ✅ endpoint esperado: PATCH /api/reservations/:id/cancel
      await api.patch(`/reservations/${id}/cancel`);
      await loadPending();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo cancelar la reserva.');
    } finally {
      setActionBusyId(null);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '1rem' }}>
      {error && (
        <div className="admin-card" style={{ borderLeft: '4px solid #f97373' }}>
          <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
        </div>
      )}

      {/* =========================
          Reservas pendientes
      ========================== */}
      <div className="admin-card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            marginBottom: 10,
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem' }}>Reservas pendientes de aprobación</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#6b7280' }}>
              Reservas creadas por usuarios con classify vacío/REGULAR.
            </p>
          </div>

          <button
            type="button"
            className="admin-button-outline"
            onClick={loadPending}
            disabled={loadingPending}
          >
            {loadingPending ? 'Actualizando...' : 'Actualizar'}
          </button>
          {/*<Link to=""
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
                Actualizar
            </Link> DIEGO*/}
        </div>

        {loadingPending ? (
          <p style={{ color: '#6b7280', margin: 0 }}>Cargando reservas pendientes...</p>
        ) : pending.length === 0 ? (
          <p style={{ color: '#6b7280', margin: 0 }}>No hay reservas pendientes.</p>
        ) : (
          <div className="admin-table-wrapper">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Horario</th>
                  <th>Espacio</th>
                  <th>Usuario</th>
                  <th style={{ width: 220 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.date)}</td>
                    <td>
                      {formatTime(r.startTime)} - {formatTime(r.endTime)}
                    </td>
                    <td>{r.space?.name || `Espacio #${r.spaceId}`}</td>
                    <td>
                      {r.user
                        ? `${r.user.name || ''} ${r.user.lastName || ''}`.trim() || r.user.email
                        : `Usuario #${r.userId}`}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="admin-button"
                          onClick={() => approveReservation(r.id)}
                          disabled={actionBusyId === r.id}
                        >
                          {actionBusyId === r.id ? 'Procesando...' : 'Aprobar'}
                        </button>

                        <button
                          type="button"
                          className="admin-button-outline"
                          onClick={() => cancelReservation(r.id)}
                          disabled={actionBusyId === r.id}
                        >
                          Cancelar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


    </div>
  );
}
