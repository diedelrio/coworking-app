import { useMemo, useState } from 'react';
import api from '../api/axiosClient';

const STATUS_LABEL = {
  ACTIVE: 'Activa',
  PENDING: 'Pendiente',
  APPROVED: 'Aprobada',
  REJECTED: 'Rechazada',
  CANCELLED: 'Cancelada',
};

function pad2(n) {
  return String(n).padStart(2, '0');
}
function formatDate(iso) {
  const d = new Date(iso);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
function formatTime(iso) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export default function ReservationsGrid({
  reservations = [],
  defaultStatus = 'ACTIVE',
  showStatusFilter = true,
  onCancelled, // opcional para refrescar afuera
}) {
  const [statusFilter, setStatusFilter] = useState(defaultStatus);
  const [cancellingId, setCancellingId] = useState(null);

  const filtered = useMemo(() => {
    if (!statusFilter) return reservations;
    return reservations.filter((r) => r.status === statusFilter);
  }, [reservations, statusFilter]);

  async function cancelReservation(id) {
    const ok = window.confirm('¿Seguro que querés cancelar esta reserva?');
    if (!ok) return;

    try {
      setCancellingId(id);
      await api.put(`/reservations/${id}/cancel`);
      onCancelled?.(id);
    } catch (e) {
      console.error(e);
      alert(e?.response?.data?.message || 'No se pudo cancelar la reserva.');
    } finally {
      setCancellingId(null);
    }
  }

  return (
    <div className="admin-card" style={{ padding: 18 }}>
      {showStatusFilter ? (
        <div className="reservations-toolbar">
          <div className="reservations-filters">
            <span className="filter-label">Estado:</span>

            {statusFilter ? (
              <span className={`filter-tag ${statusFilter === 'ACTIVE' ? 'is-active' : ''}`}>
                {STATUS_LABEL[statusFilter] || statusFilter}
                <button
                  type="button"
                  className="filter-tag-close"
                  aria-label="Quitar filtro de estado"
                  onClick={() => setStatusFilter('')}
                >
                  ×
                </button>
              </span>
            ) : (
              <span className="filter-tag is-all">Todos</span>
            )}

            <select
              className="filter-select"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos</option>
              <option value="ACTIVE">Activa</option>
              <option value="PENDING">Pendiente</option>
              <option value="APPROVED">Aprobada</option>
              <option value="REJECTED">Rechazada</option>
              <option value="CANCELLED">Cancelada</option>
            </select>
          </div>
        </div>
      ) : null}

      {filtered.length === 0 ? (
        <div style={{ padding: 10 }}>
          <div style={{ fontWeight: 800, marginBottom: 6 }}>No hay reservas</div>
          <div style={{ opacity: 0.75, fontSize: 13 }}>
            Probá quitando el filtro o agendá una nueva reserva.
          </div>
        </div>
      ) : (
        <div className="reservations-table-wrap">
          <table className="reservations-table">
            <thead>
              <tr>
                <th>Espacio</th>
                <th>Fecha</th>
                <th>Franja</th>
                <th>Estado</th>
                <th style={{ width: 120 }} />
              </tr>
            </thead>

            <tbody>
              {filtered.map((r) => {
                const date = formatDate(r.startTime);
                const start = formatTime(r.startTime);
                const end = formatTime(r.endTime);
                const statusLabel = STATUS_LABEL[r.status] || r.status;

                return (
                  <tr key={r.id}>
                    <td className="cell-strong">{r.space?.name || 'Espacio'}</td>
                    <td>{date}</td>
                    <td>{start} - {end}</td>
                    <td>
                      <span className={`status-pill status-${r.status}`}>
                        {statusLabel}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      {r.status === 'ACTIVE' ? (
                        <button
                          type="button"
                          className="btn-cancel"
                          onClick={() => cancelReservation(r.id)}
                          disabled={cancellingId === r.id}
                        >
                          {cancellingId === r.id ? 'Cancelando…' : 'Cancelar'}
                        </button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
