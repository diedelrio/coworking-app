import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axiosClient';
import AlertBanner from './OperationsAlertBanner';

const prettyDateTime = (iso) => {
  try {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
  } catch {
    return iso;
  }
};

const prettyMoney = (v) => {
  const n = Number(v ?? 0);
  if (!Number.isFinite(n)) return String(v ?? '');
  return n.toFixed(2);
};

export default function OperationsCompleteReservations() {
  const [users, setUsers] = useState([]);
  const [spaces, setSpaces] = useState([]);

  const [filterUserId, setFilterUserId] = useState('');
  const [filterSpaceId, setFilterSpaceId] = useState('');
  const [endBefore, setEndBefore] = useState(() => {
    const d = new Date();
    d.setSeconds(0, 0);
    const pad = (n) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  });

  const [preview, setPreview] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          api.get('/users', { params: { includeInactive: true } }).catch(() => ({ data: [] })),
          api.get('/spaces').catch(() => ({ data: [] })),
        ]);
        setUsers(Array.isArray(uRes.data) ? uRes.data : []);
        setSpaces(Array.isArray(sRes.data) ? sRes.data : []);
      } catch {
        // ignore
      }
    };
    load();
  }, []);

  const endBeforeISO = useMemo(() => {
    if (!endBefore) return null;
    const d = new Date(endBefore);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [endBefore]);

  const loadPreview = async () => {
    setError(null);
    setMessage(null);
    setLoadingPreview(true);
    setSelectedIds(new Set());
    try {
      const res = await api.get('/admin/operations/complete-preview', {
        params: {
          userId: filterUserId || undefined,
          spaceId: filterSpaceId || undefined,
          endBefore: endBeforeISO || undefined,
        },
      });
      setPreview(res.data);
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Error cargando preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const toggleSelected = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllSample = () => {
    if (!preview?.sample?.length) return;
    setSelectedIds(new Set(preview.sample.map((r) => r.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const execute = async ({ bySelection }) => {
    setError(null);
    setMessage(null);
    setLoadingAction(true);
    try {
      const payload = bySelection
        ? { ids: Array.from(selectedIds) }
        : {
            userId: filterUserId || undefined,
            spaceId: filterSpaceId || undefined,
            endBefore: endBeforeISO || undefined,
          };

      const res = await api.post('/admin/operations/complete-execute', payload);
      setMessage(`Proceso ejecutado. Reservas actualizadas: ${res.data?.updated ?? 0}`);
      await loadPreview();
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || 'Error ejecutando proceso');
    } finally {
      setLoadingAction(false);
    }
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>Completar reservas</h2>
      <p style={{ marginTop: 6, color: '#6b7280' }}>RF-OPER-01 — Pasar reservas ACTIVE a COMPLETED según filtros o selección.</p>

      <AlertBanner error={error} message={message} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '0.75rem', marginBottom: '0.75rem' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Usuario</label>
          <select value={filterUserId} onChange={(e) => setFilterUserId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
            <option value="">Todos</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name} {u.lastName} ({u.email})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Espacio</label>
          <select value={filterSpaceId} onChange={(e) => setFilterSpaceId(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}>
            <option value="">Todos</option>
            {spaces.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Fin antes de</label>
          <input type="datetime-local" value={endBefore} onChange={(e) => setEndBefore(e.target.value)} style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
        <button type="button" onClick={loadPreview} disabled={loadingPreview || loadingAction} style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
          {loadingPreview ? 'Cargando...' : 'Preview'}
        </button>

        <button type="button" onClick={selectAllSample} disabled={!preview?.sample?.length || loadingAction} style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
          Seleccionar muestra (50)
        </button>

        <button type="button" onClick={clearSelection} disabled={!selectedIds.size || loadingAction} style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
          Limpiar selección
        </button>

        <button
          type="button"
          onClick={() => execute({ bySelection: true })}
          disabled={!selectedIds.size || loadingAction}
          style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer', background: '#33576f', color: 'white' }}
        >
          {loadingAction ? 'Ejecutando...' : `Ejecutar selección (${selectedIds.size})`}
        </button>

        <button type="button" onClick={() => execute({ bySelection: false })} disabled={!preview?.count || loadingAction} style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}>
          {loadingAction ? 'Ejecutando...' : `Ejecutar por filtro (${preview?.count ?? 0})`}
        </button>
      </div>

      <div style={{ marginBottom: '0.75rem', color: '#6b7280', fontSize: '0.95rem' }}>
        {preview ? (
          <>
            <strong>Coincidencias:</strong> {preview.count} | <strong>Fin antes de:</strong> {prettyDateTime(preview.endBefore)}
            {preview.note ? <span> — {preview.note}</span> : null}
          </>
        ) : (
          'Cargá un preview para ver reservas afectadas.'
        )}
      </div>

      {!!preview?.sample?.length && (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.5rem' }} />
                <th style={{ padding: '0.5rem' }}>Reserva</th>
                <th style={{ padding: '0.5rem' }}>Usuario</th>
                <th style={{ padding: '0.5rem' }}>Espacio</th>
                <th style={{ padding: '0.5rem' }}>Fin</th>
                <th style={{ padding: '0.5rem' }}>Monto</th>
              </tr>
            </thead>
            <tbody>
              {preview.sample.map((r) => (
                <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.5rem' }}>
                    <input type="checkbox" checked={selectedIds.has(r.id)} onChange={() => toggleSelected(r.id)} />
                  </td>
                  <td style={{ padding: '0.5rem' }}>#{r.id}</td>
                  <td style={{ padding: '0.5rem' }}>
                    {r.user?.name} {r.user?.lastName}
                    <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{r.user?.email}</div>
                  </td>
                  <td style={{ padding: '0.5rem' }}>{r.space?.name}</td>
                  <td style={{ padding: '0.5rem' }}>{prettyDateTime(r.endTime)}</td>
                  <td style={{ padding: '0.5rem' }}>{prettyMoney(r.totalAmount ?? 0)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
