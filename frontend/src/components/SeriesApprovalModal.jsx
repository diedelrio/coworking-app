import { useCallback, useEffect, useState } from 'react';
import api from '../api/axiosClient';

const TZ = 'Europe/Madrid';

function fmtDate(value) {
  return new Date(value).toLocaleDateString('es-ES', {
    timeZone: TZ,
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function fmtTime(value) {
  return new Date(value).toLocaleTimeString('es-ES', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false });
}

/**
 * Aprobación de una serie recurrente: el administrador elige entre aprobar toda la serie
 * o resolver las fechas una a una (aprobar / rechazar cada una).
 *
 * Props:
 *  - seriesId: serie a revisar (el modal se abre cuando hay seriesId)
 *  - onClose(): cerrar sin más
 *  - onChanged(): se llama tras cualquier aprobación/rechazo, para refrescar la pantalla de origen
 */
export default function SeriesApprovalModal({ seriesId, onClose, onChanged }) {
  const [loaded, setLoaded] = useState(null);
  const [busyKey, setBusyKey] = useState(null); // 'ALL' | id de la fecha
  const [error, setError] = useState('');

  // Trae la serie; el estado solo se actualiza después de esperar la respuesta.
  const fetchSeries = useCallback(async () => {
    if (!seriesId) return null;
    try {
      const res = await api.get(`/reservations/series/${encodeURIComponent(seriesId)}/pending`);
      setLoaded(res.data);
      setError('');
      return res.data;
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo cargar la serie.');
      return null;
    }
  }, [seriesId]);

  useEffect(() => {
    // fetchSeries solo cambia estado tras el await (no de forma síncrona)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSeries();
  }, [fetchSeries]);

  if (!seriesId) return null;

  // Solo se muestran datos de la serie actual (evita ver los de una serie anterior mientras carga)
  const data = loaded?.seriesId === seriesId ? loaded : null;

  const occurrences = data?.occurrences || [];
  const busy = busyKey !== null;

  const run = async (key, request) => {
    setBusyKey(key);
    setError('');
    try {
      await request();
      onChanged?.();
      const fresh = await fetchSeries();
      // sin fechas pendientes: no queda nada por resolver
      if (fresh && fresh.pendingCount === 0) onClose?.();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo completar la acción.');
    } finally {
      setBusyKey(null);
    }
  };

  const approveAll = () => {
    if (!window.confirm(`¿Aprobar las ${data?.pendingCount ?? ''} reservas pendientes de la serie?`)) return;
    run('ALL', () => api.patch(`/reservations/series/${encodeURIComponent(seriesId)}/approve`));
  };

  const approveOne = (occ) => run(occ.id, () => api.patch(`/reservations/${occ.id}/approve`));

  const rejectOne = (occ) => {
    const reason = window.prompt(`Motivo de rechazo del ${fmtDate(occ.date)} (se enviará al usuario por email):`, '');
    if (reason === null) return;
    run(occ.id, () => api.patch(`/reservations/${occ.id}/reject`, { reason }));
  };

  const userLabel = data?.user
    ? `${data.user.name || ''} ${data.user.lastName || ''}`.trim() || data.user.email
    : '';

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 9999,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="admin-card"
        style={{
          width: '100%',
          maxWidth: 680,
          maxHeight: '85vh',
          overflow: 'hidden',
          borderRadius: 16,
          padding: '1rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>Aprobar reserva recurrente</h3>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {[userLabel, data?.space?.name, data?.pattern].filter(Boolean).join(' · ')}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            style={{ border: 'none', background: 'transparent', fontSize: 18, cursor: busy ? 'not-allowed' : 'pointer', lineHeight: 1 }}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        {error ? <p style={{ color: '#b91c1c', margin: '10px 0 0' }}>{error}</p> : null}

        {!data && !error ? (
          <p style={{ color: '#6b7280' }}>Cargando serie...</p>
        ) : data ? (
          <>
            <div
              style={{
                marginTop: 12,
                padding: '0.75rem',
                borderRadius: 12,
                background: '#f3f4f6',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 12,
                flexWrap: 'wrap',
              }}
            >
              <div style={{ fontSize: '0.9rem' }}>
                <strong>{data.pendingCount}</strong> pendiente{data.pendingCount === 1 ? '' : 's'}
                {data.approvedCount ? ` · ${data.approvedCount} ya aprobada${data.approvedCount === 1 ? '' : 's'}` : ''}
                {' '}de {data.total}
              </div>
              <button type="button" className="pill-button-green" onClick={approveAll} disabled={busy || !data.pendingCount}>
                {busyKey === 'ALL' ? 'Procesando...' : `Aprobar toda la serie (${data.pendingCount})`}
              </button>
            </div>

            <div style={{ fontSize: 12, color: '#6b7280', margin: '12px 0 6px' }}>
              O resolvé las fechas una a una:
            </div>

            <div style={{ overflowY: 'auto', flex: 1 }}>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Horario</th>
                    <th>Mesa</th>
                    <th style={{ width: 190 }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {occurrences.map((occ) => (
                    <tr key={occ.id}>
                      <td>
                        {fmtDate(occ.date)}
                        {occ.isPast ? <span style={{ color: '#b45309', marginLeft: 6, fontSize: 12 }}>(pasada)</span> : null}
                      </td>
                      <td>
                        {fmtTime(occ.startTime)} - {fmtTime(occ.endTime)}
                      </td>
                      <td>{occ.desks?.length ? occ.desks.join(', ') : '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                          <button type="button" className="pill-button-green" onClick={() => approveOne(occ)} disabled={busy}>
                            {busyKey === occ.id ? '...' : 'Aprobar'}
                          </button>
                          <button type="button" className="pill-button-red" onClick={() => rejectOne(occ)} disabled={busy}>
                            Rechazar
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!occurrences.length ? (
                    <tr>
                      <td colSpan={4} style={{ color: '#6b7280' }}>
                        No quedan fechas pendientes.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </>
        ) : null}

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button type="button" className="pill-button-outline" onClick={onClose} disabled={busy}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
