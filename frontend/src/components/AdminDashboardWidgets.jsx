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

function RejectReservationModal({ open, reservation, loading, onClose, onConfirm }) {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  if (!open) return null;

  // "reservation" puede ser una reserva (ONE) o un grupo (SERIES) del pending-groups
  const base = reservation?.firstReservation || reservation;
  const isSeries = reservation?.type === 'SERIES' || Boolean(reservation?.seriesId && reservation?.firstReservation);

  const userLabel = base?.user
    ? `${base.user.name || ''} ${base.user.lastName || ''}`.trim() || base.user.email
    : base
    ? `Usuario #${base.userId}`
    : '';

  const spaceLabel = base?.space?.name || (base ? `Espacio #${base.spaceId}` : '');

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
          maxWidth: 560,
          maxHeight: '80vh',
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
            <h3 style={{ margin: 0 }}>{isSeries ? 'Rechazar serie' : 'Rechazar reserva'}</h3>
            <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
              {userLabel} · {spaceLabel}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              cursor: loading ? 'not-allowed' : 'pointer',
              lineHeight: 1,
              opacity: loading ? 0.6 : 1,
            }}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div
          style={{
            marginTop: 12,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          <label
            style={{
              fontWeight: 800,
              display: 'block',
              marginBottom: 6,
            }}
          >
            Motivo (se enviará al usuario por email)
          </label>

          <textarea
            rows={4}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Ej: No hay disponibilidad en ese horario / se requiere autorización / etc."
            style={{
              width: '95%',
              border: '1px solid #e5e7eb',
              borderRadius: 12,
              padding: '0.75rem',
              resize: 'vertical',
              outline: 'none',
              maxHeight: 160,
            }}
          />

          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>
            Si lo dejás vacío, se enviará “No especificado.”
          </div>
        </div>


        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button
            type="button"
            className="pill-button-outline"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="button"
            className="pill-button"
            onClick={() => onConfirm(reason)}
            disabled={loading}
           
            title="Rechazar"
          >
            {loading ? 'Rechazando...' : 'Rechazar'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardWidgets() {
  const [pending, setPending] = useState([]); // pending groups
  const [loadingPending, setLoadingPending] = useState(true);

  const [missingClassify, setMissingClassify] = useState([]);
  const [loadingMissing, setLoadingMissing] = useState(true);

  const [actionBusyId, setActionBusyId] = useState(null);
  const [error, setError] = useState('');

  // ✅ Modal rechazo
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReservation, setRejectReservation] = useState(null);

  const loadPending = async () => {
    setLoadingPending(true);
    try {
      const res = await api.get('/reservations/pending-groups');
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

  const approveReservation = async (group) => {
    const busyKey = group?.type === 'SERIES' ? `S:${group.seriesId}` : `O:${group.reservationId}`;
    setActionBusyId(busyKey);
    setError('');
    try {
      if (group?.type === 'SERIES') {
        await api.patch(`/reservations/series/${group.seriesId}/approve`);
      } else {
        await api.patch(`/reservations/${group.reservationId}/approve`);
      }
      await loadPending();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo aprobar la reserva.');
    } finally {
      setActionBusyId(null);
    }
  };

  // ✅ Abrir modal de rechazo
  const openRejectModal = (group) => {
    setRejectReservation(group);
    setRejectOpen(true);
  };

  // ✅ Confirmar rechazo (con reason)
  const confirmRejectReservation = async (reason) => {
    if (!rejectReservation) return;
    const busyKey = rejectReservation?.type === 'SERIES'
      ? `S:${rejectReservation.seriesId}`
      : `O:${rejectReservation.reservationId}`;
    setActionBusyId(busyKey);
    setError('');

    try {
      if (rejectReservation?.type === 'SERIES') {
        await api.patch(`/reservations/series/${rejectReservation.seriesId}/reject`, { reason });
      } else {
        await api.patch(`/reservations/${rejectReservation.reservationId}/reject`, { reason });
      }
      setRejectOpen(false);
      setRejectReservation(null);
      await loadPending();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo rechazar la reserva.');
    } finally {
      setActionBusyId(null);
    }
  };

  const closeRejectModal = () => {
    // si está procesando, no cierres
    // si está procesando, no cierres
    if (actionBusyId) return;
    setRejectOpen(false);
    setRejectReservation(null);
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
            className="pill-button-outline"
            onClick={loadPending}
            disabled={loadingPending}
          >
            {loadingPending ? 'Actualizando...' : 'Actualizar'}
          </button>
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
                  <th>Recurrencia</th>
                  <th style={{ width: 220 }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {pending.map((g) => {
                  const r = g.firstReservation;
                  const rowKey = g.type === 'SERIES' ? `S:${g.seriesId}` : `O:${g.reservationId}`;
                  const busy = actionBusyId === rowKey;

                  return (
                    <tr key={rowKey}>
                      <td>{formatDate(r?.date)}</td>
                      <td>
                        {formatTime(r?.startTime)} - {formatTime(r?.endTime)}
                      </td>
                      <td>{r?.space?.name || (r ? `Espacio #${r.spaceId}` : '-')}</td>
                      <td>
                        {r?.user
                          ? `${r.user.name || ''} ${r.user.lastName || ''}`.trim() || r.user.email
                          : r
                          ? `Usuario #${r.userId}`
                          : '-'}
                      </td>
                      <td>
                        {g.type === 'SERIES' ? (
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '4px 10px',
                              borderRadius: 999,
                              background: '#eef2ff',
                              color: '#3730a3',
                              fontSize: '0.85rem',
                              whiteSpace: 'nowrap',
                            }}
                            title="Reserva recurrente"
                          >
                            Recurrente
                            <span style={{ opacity: 0.8 }}>
                              {g.pattern ? `${g.pattern} · ` : ''}{g.occurrences}
                            </span>
                          </span>
                        ) : (
                          <span style={{ color: '#6b7280' }}>—</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="pill-button-green"
                            onClick={() => approveReservation(g)}
                            disabled={busy}
                          >
                            {busy ? 'Procesando...' : 'Aprobar'}
                          </button>

                          <button
                            type="button"
                            className="pill-button-red"
                            onClick={() => openRejectModal(g)}
                            disabled={busy}
                            title={g.type === 'SERIES' ? 'Rechazar serie' : 'Rechazar'}
                          >
                            Rechazar
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

      {/* ✅ Modal para motivo de rechazo */}
      <RejectReservationModal
        open={rejectOpen}
        reservation={rejectReservation}
        loading={(() => {
          if (!rejectReservation || !actionBusyId) return false;
          const key = rejectReservation?.type === 'SERIES'
            ? `S:${rejectReservation.seriesId}`
            : `O:${rejectReservation.reservationId}`;
          return actionBusyId === key;
        })()}
        onClose={closeRejectModal}
        onConfirm={confirmRejectReservation}
      />
    </div>
  );
}
