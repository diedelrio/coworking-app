import { useEffect, useMemo, useState } from 'react';
import api from '../api/axiosClient';
import Layout from '../components/Layout';

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

function AlertBanner({ error, message }) {
  if (!error && !message) return null;
  const isError = !!error;

  return (
    <div
      style={{
        padding: '0.75rem',
        borderRadius: '0.75rem',
        border: '1px solid',
        borderColor: isError ? '#fecaca' : '#bbf7d0',
        background: isError ? '#fef2f2' : '#f0fdf4',
        color: isError ? '#991b1b' : '#166534',
        marginBottom: '1rem',
      }}
    >
      {error || message}
    </div>
  );
}

export default function AdminOperations() {
  const [tab, setTab] = useState('complete'); // complete | billing | userBatch

  // Data global para completar
  const [users, setUsers] = useState([]);
  const [spaces, setSpaces] = useState([]);

  // Data específica para facturación
  const [eligibleUsers, setEligibleUsers] = useState([]);

  // -----------------------------
  // Completar (RF-OPER-01)
  // -----------------------------
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
  const [loadingCompleteAction, setLoadingCompleteAction] = useState(false);

  const [completeMessage, setCompleteMessage] = useState(null);
  const [completeError, setCompleteError] = useState(null);

  // -----------------------------
  // Facturación (RF-OPER-02)
  // -----------------------------
  const [billingUserId, setBillingUserId] = useState('');
  const [billingPreview, setBillingPreview] = useState(null);
  const [loadingBillingPreview, setLoadingBillingPreview] = useState(false);
  const [loadingBillingAction, setLoadingBillingAction] = useState(false);

  const [billingMessage, setBillingMessage] = useState(null);
  const [billingError, setBillingError] = useState(null);

  // -----------------------------
  // Alta masiva usuarios
  // -----------------------------
  const [batchFile, setBatchFile] = useState(null);
  const [batchPreview, setBatchPreview] = useState(null);
  const [batchLoadingPreview, setBatchLoadingPreview] = useState(false);
  const [batchLoadingExecute, setBatchLoadingExecute] = useState(false);
  const [batchMessage, setBatchMessage] = useState(null);
  const [batchError, setBatchError] = useState(null);
  const [batchResult, setBatchResult] = useState(null);
  const [onExistingEmail, setOnExistingEmail] = useState('ERROR');

  // -----------------------------
  // Cargas iniciales
  // -----------------------------
  useEffect(() => {
    const load = async () => {
      try {
        const [uRes, sRes] = await Promise.all([
          api.get('/users', { params: { includeInactive: true } }).catch(() => ({ data: [] })),
          api.get('/spaces').catch(() => ({ data: [] })),
        ]);

        setUsers(Array.isArray(uRes.data) ? uRes.data : []);
        setSpaces(Array.isArray(sRes.data) ? sRes.data : []);
      } catch (e) {
        console.error(e);
      }
    };
    load();
  }, []);

  // Cargar usuarios elegibles de facturación cuando se entra a la pestaña
  useEffect(() => {
    const loadEligible = async () => {
      try {
        const res = await api.get('/admin/operations/liquidations/eligible-users');
        setEligibleUsers(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        // fallback (solo para no romper si backend aún no tiene endpoint)
        const fallback = Array.isArray(users)
          ? users.filter((u) => String(u.role || '').toUpperCase() === 'CLIENT')
          : [];
        setEligibleUsers(fallback);
      }
    };

    if (tab === 'billing') {
      loadEligible();
    }
  }, [tab, users]);

  // Limpieza de mensajes/errores al cambiar de pestaña
  useEffect(() => {
    if (tab === 'complete') {
      setBillingError(null);
      setBillingMessage(null);
      setBatchError(null);
      setBatchMessage(null);
    } else if (tab === 'billing') {
      setCompleteError(null);
      setCompleteMessage(null);
      setBatchError(null);
      setBatchMessage(null);
    } else {
      setCompleteError(null);
      setCompleteMessage(null);
      setBillingError(null);
      setBillingMessage(null);
    }
  }, [tab]);

  const endBeforeISO = useMemo(() => {
    if (!endBefore) return null;
    const d = new Date(endBefore);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }, [endBefore]);

  // -----------------------------
  // RF-OPER-01: Preview + ejecución
  // -----------------------------
  const loadPreview = async () => {
    setCompleteError(null);
    setCompleteMessage(null);
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
      console.error(e);
      setCompleteError(e?.response?.data?.message || e?.message || 'Error cargando preview');
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

  const executeComplete = async ({ bySelection }) => {
    setCompleteError(null);
    setCompleteMessage(null);
    setLoadingCompleteAction(true);
    try {
      const payload = bySelection
        ? { ids: Array.from(selectedIds) }
        : {
            userId: filterUserId || undefined,
            spaceId: filterSpaceId || undefined,
            endBefore: endBeforeISO || undefined,
          };

      const res = await api.post('/admin/operations/complete-execute', payload);
      setCompleteMessage(`Proceso ejecutado. Reservas actualizadas: ${res.data?.updated ?? 0}`);
      await loadPreview();
    } catch (e) {
      console.error(e);
      setCompleteError(e?.response?.data?.message || e?.message || 'Error ejecutando proceso');
    } finally {
      setLoadingCompleteAction(false);
    }
  };

  // -----------------------------
  // RF-OPER-02: Preview + generar
  // -----------------------------
  const loadBillingPreview = async () => {
    setBillingError(null);
    setBillingMessage(null);
    setLoadingBillingPreview(true);
    setBillingPreview(null);

    try {
      const res = await api.get('/admin/operations/liquidations/preview', {
        params: {
          userId: billingUserId || undefined,
        },
      });
      setBillingPreview(res.data);
      if (!res.data?.count) {
        setBillingMessage('No hay reservas pendientes de facturación para los filtros seleccionados.');
      }
    } catch (e) {
      console.error(e);
      setBillingError(e?.response?.data?.message || e?.message || 'Error generando preview de facturación');
    } finally {
      setLoadingBillingPreview(false);
    }
  };

  const generateLiquidations = async () => {
    setBillingError(null);
    setBillingMessage(null);
    setLoadingBillingAction(true);
    try {
      const res = await api.post('/admin/operations/liquidations/generate', {
        userId: billingUserId || undefined,
      });

      if (res.data?.message) {
        setBillingMessage(res.data.message);
      } else {
        setBillingMessage(
          `Liquidaciones creadas: ${res.data?.createdLiquidations ?? 0} | Items creados: ${res.data?.createdItems ?? 0} | Reservas marcadas INVOICED: ${
            res.data?.updatedReservations ?? 0
          }`
        );
      }

      await loadBillingPreview();

      try {
        const elig = await api.get('/admin/operations/liquidations/eligible-users');
        setEligibleUsers(Array.isArray(elig.data) ? elig.data : []);
      } catch {
        // ignore
      }
    } catch (e) {
      console.error(e);
      setBillingError(e?.response?.data?.message || e?.message || 'Error generando liquidaciones');
    } finally {
      setLoadingBillingAction(false);
    }
  };

  const billingHasSomethingToInvoice = !!billingPreview?.count;

  // -----------------------------
  // Alta masiva usuarios (preview + ejecutar)
  // -----------------------------
  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Error leyendo archivo'));
      reader.readAsText(file);
    });

  const loadBatchPreview = async () => {
    setBatchError(null);
    setBatchMessage(null);
    setBatchResult(null);
    if (!batchFile) {
      setBatchError('Seleccioná un archivo .csv o .txt');
      return;
    }
    setBatchLoadingPreview(true);
    try {
      const content = await readFileAsText(batchFile);
      const res = await api.post('/admin/operations/users-batch/preview', {
        fileName: batchFile.name,
        content,
      });
      setBatchPreview(res.data);
    } catch (e) {
      console.error(e);
      setBatchError(e?.response?.data?.message || e?.message || 'Error generando preview');
    } finally {
      setBatchLoadingPreview(false);
    }
  };

  const executeBatch = async () => {
    if (!batchPreview?.validRows?.length) {
      setBatchError('No hay registros válidos para procesar.');
      return;
    }

    setBatchError(null);
    setBatchMessage(null);
    setBatchLoadingExecute(true);
    try {
      const res = await api.post('/admin/operations/users-batch/execute', {
        fileMeta: batchPreview.fileMeta,
        validRows: batchPreview.validRows,
        options: { onExistingEmail },
      });
      setBatchResult(res.data);
      setBatchMessage(
        `Proceso finalizado. OK: ${res.data?.summary?.created ?? 0} | Errores: ${res.data?.summary?.errors ?? 0} | Skip: ${res.data?.summary?.skipped ?? 0}`
      );
    } catch (e) {
      console.error(e);
      setBatchError(e?.response?.data?.message || e?.message || 'Error ejecutando alta masiva');
    } finally {
      setBatchLoadingExecute(false);
    }
  };

  const downloadCsv = (rows, fileName) => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    // usamos headers del archivo original (si existen)
    const headers = Array.isArray(batchPreview?.fileMeta?.headers) ? batchPreview.fileMeta.headers : null;
    const baseHeaders = headers && headers.length ? headers : Object.keys(rows[0]?.raw || {});

    const allHeaders = [...baseHeaders, 'observacion'];
    const escapeCsv = (v) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes(';') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const sep = ';';
    const lines = [];
    lines.push(allHeaders.join(sep));
    for (const r of rows) {
      const raw = r.raw || {};
      const line = allHeaders
        .map((h) => (h === 'observacion' ? escapeCsv(r.observacion || '') : escapeCsv(raw[h] ?? '')))
        .join(sep);
      lines.push(line);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div style={{ padding: '1.5rem', maxWidth: 1100, margin: '0 auto' }}>
        <h1 style={{ marginBottom: '0.25rem' }}>Operaciones</h1>
        <p style={{ marginTop: 0, color: '#6b7280' }}>Procesos de backoffice (workarounds y acciones masivas).</p>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '0.5rem', margin: '1rem 0' }}>
          <button
            type="button"
            onClick={() => setTab('complete')}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              background: tab === 'complete' ? '#e5e7eb' : 'white',
              cursor: 'pointer',
            }}
          >
            Completar reservas
          </button>
          <button
            type="button"
            onClick={() => setTab('billing')}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              background: tab === 'billing' ? '#e5e7eb' : 'white',
              cursor: 'pointer',
            }}
          >
            Facturación
          </button>

          <button
            type="button"
            onClick={() => setTab('userBatch')}
            style={{
              padding: '0.5rem 0.75rem',
              borderRadius: '0.5rem',
              border: '1px solid #e5e7eb',
              background: tab === 'userBatch' ? '#e5e7eb' : 'white',
              cursor: 'pointer',
            }}
          >
            Alta masiva usuarios
          </button>
        </div>

        {/* Alerts por pestaña */}
        {tab === 'complete' && <AlertBanner error={completeError} message={completeMessage} />}
        {tab === 'billing' && <AlertBanner error={billingError} message={billingMessage} />}
        {tab === 'userBatch' && <AlertBanner error={batchError} message={batchMessage} />}

        {/* -------------------- COMPLETAR -------------------- */}
        {tab === 'complete' && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>RF-OPER-01 — Pasar reservas ACTIVE a COMPLETED</h2>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                gap: '0.75rem',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Usuario</label>
                <select
                  value={filterUserId}
                  onChange={(e) => setFilterUserId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                >
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
                <select
                  value={filterSpaceId}
                  onChange={(e) => setFilterSpaceId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                >
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
                <input
                  type="datetime-local"
                  value={endBefore}
                  onChange={(e) => setEndBefore(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
              <button
                type="button"
                onClick={loadPreview}
                disabled={loadingPreview || loadingCompleteAction}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
              >
                {loadingPreview ? 'Cargando...' : 'Preview'}
              </button>

              <button
                type="button"
                onClick={selectAllSample}
                disabled={!preview?.sample?.length || loadingCompleteAction}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
              >
                Seleccionar muestra (50)
              </button>

              <button
                type="button"
                onClick={clearSelection}
                disabled={!selectedIds.size || loadingCompleteAction}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
              >
                Limpiar selección
              </button>

              <button
                type="button"
                onClick={() => executeComplete({ bySelection: true })}
                disabled={!selectedIds.size || loadingCompleteAction}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '0.6rem',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  background: '#33576f',
                  color: 'white',
                }}
              >
                {loadingCompleteAction ? 'Ejecutando...' : `Ejecutar selección (${selectedIds.size})`}
              </button>

              <button
                type="button"
                onClick={() => executeComplete({ bySelection: false })}
                disabled={!preview?.count || loadingCompleteAction}
                style={{
                  padding: '0.55rem 0.85rem',
                  borderRadius: '0.6rem',
                  border: '1px solid #e5e7eb',
                  cursor: 'pointer',
                }}
                title="Ejecuta por filtro (puede afectar más de 50)"
              >
                {loadingCompleteAction ? 'Ejecutando...' : `Ejecutar por filtro (${preview?.count ?? 0})`}
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
        )}

        {/* -------------------- FACTURACIÓN -------------------- */}
        {tab === 'billing' && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>RF-OPER-02 — Proceso manual de facturación</h2>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto auto', gap: '0.75rem', maxWidth: 900 }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Usuario (opcional)</label>
                <select
                  value={billingUserId}
                  onChange={(e) => setBillingUserId(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                >
                  <option value="">Todos (crea una liquidación por usuario)</option>
                  {eligibleUsers.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} {u.lastName} ({u.email})
                    </option>
                  ))}
                </select>

                <div style={{ marginTop: '0.35rem', fontSize: '0.85rem', color: '#6b7280' }}>
                  El combo muestra solo usuarios <strong>CLIENT</strong> con al menos 1 reserva facturable.
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  type="button"
                  onClick={loadBillingPreview}
                  disabled={loadingBillingPreview || loadingBillingAction}
                  style={{
                    padding: '0.6rem 0.9rem',
                    borderRadius: '0.6rem',
                    border: '1px solid #e5e7eb',
                    cursor: 'pointer',
                    height: 40,
                  }}
                >
                  {loadingBillingPreview ? 'Cargando...' : 'Preview'}
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'end' }}>
                <button
                  type="button"
                  onClick={generateLiquidations}
                  disabled={loadingBillingAction || loadingBillingPreview || !billingHasSomethingToInvoice}
                  style={{
                    padding: '0.6rem 0.9rem',
                    borderRadius: '0.6rem',
                    border: '1px solid #e5e7eb',
                    cursor: loadingBillingAction || loadingBillingPreview || !billingHasSomethingToInvoice ? 'not-allowed' : 'pointer',
                    background: '#33576f',
                    color: 'white',
                    height: 40,
                    opacity: loadingBillingAction || loadingBillingPreview || !billingHasSomethingToInvoice ? 0.65 : 1,
                  }}
                  title={!billingHasSomethingToInvoice ? 'Primero generá un preview con reservas pendientes' : ''}
                >
                  {loadingBillingAction ? 'Generando...' : 'Generar liquidaciones'}
                </button>
              </div>
            </div>

            <div style={{ marginTop: '1rem', color: '#6b7280' }}>
              Se consideran sólo reservas en estado <strong>COMPLETED</strong> o <strong>PENALIZED</strong> que aún no tengan una
              liquidación generada. Al generar, se marcan como <strong>INVOICED</strong>.
            </div>

            <div style={{ marginTop: '1rem' }}>
              {billingPreview ? (
                <>
                  <div style={{ color: '#111827', marginBottom: '0.5rem' }}>
                    <strong>Reservas a facturar:</strong> {billingPreview.count ?? 0} &nbsp;|&nbsp; <strong>Total:</strong>{' '}
                    {prettyMoney(billingPreview.totalAmount ?? 0)}
                  </div>

                  {!billingPreview.count ? (
                    <div style={{ color: '#6b7280' }}>No hay reservas pendientes para los filtros seleccionados.</div>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {(billingPreview.byUser || []).map((g) => (
                        <div key={g.user?.id} style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                            <div>
                              <strong>
                                {g.user?.name} {g.user?.lastName}
                              </strong>
                              <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>{g.user?.email}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div>
                                <strong>{g.count}</strong> reservas
                              </div>
                              <div>
                                Total: <strong>{prettyMoney(g.total)}</strong>
                              </div>
                            </div>
                          </div>

                          <div style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
                            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                              <thead>
                                <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                                  <th style={{ padding: '0.5rem' }}>Reserva</th>
                                  <th style={{ padding: '0.5rem' }}>Fin</th>
                                  <th style={{ padding: '0.5rem' }}>Estado</th>
                                  <th style={{ padding: '0.5rem' }}>Monto</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(g.reservations || []).map((r) => (
                                  <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                                    <td style={{ padding: '0.5rem' }}>#{r.id}</td>
                                    <td style={{ padding: '0.5rem' }}>{prettyDateTime(r.endTime)}</td>
                                    <td style={{ padding: '0.5rem' }}>{r.status}</td>
                                    <td style={{ padding: '0.5rem' }}>{prettyMoney(r.totalAmount)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ color: '#6b7280' }}>Generá un preview para ver qué se va a liquidar.</div>
              )}
            </div>
          </div>
        )}

        {/* -------------------- ALTA MASIVA USUARIOS -------------------- */}
        {tab === 'userBatch' && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
            <h2 style={{ marginTop: 0 }}>RF-OPER-03 — Alta masiva de usuarios (CSV/TXT)</h2>

            <div style={{ color: '#6b7280', marginBottom: '0.75rem' }}>
              Archivo con encabezados. Campos soportados (case-insensitive): <code>name</code>, <code>lastname</code>, <code>email</code>, <code>phone</code>.
              También se aceptan <code>nombre</code>, <code>apellido</code>, <code>telefono</code>.
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px auto auto', gap: '0.75rem', alignItems: 'end' }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Archivo</label>
                <input
                  type="file"
                  accept=".csv,.txt"
                  onChange={(e) => {
                    setBatchFile(e.target.files?.[0] || null);
                    setBatchPreview(null);
                    setBatchResult(null);
                  }}
                />
                {batchFile && <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 6 }}>{batchFile.name}</div>}
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Si el email ya existe</label>
                <select
                  value={onExistingEmail}
                  onChange={(e) => setOnExistingEmail(e.target.value)}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                >
                  <option value="ERROR">Marcar error</option>
                  <option value="SKIP">Skip (no crear)</option>
                </select>
              </div>

              <button
                type="button"
                onClick={loadBatchPreview}
                disabled={batchLoadingPreview || batchLoadingExecute}
                style={{ padding: '0.6rem 0.9rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer', height: 40 }}
              >
                {batchLoadingPreview ? 'Procesando...' : 'Preview'}
              </button>

              <button
                type="button"
                onClick={executeBatch}
                disabled={batchLoadingExecute || batchLoadingPreview || !batchPreview?.validRows?.length}
                style={{
                  padding: '0.6rem 0.9rem',
                  borderRadius: '0.6rem',
                  border: '1px solid #e5e7eb',
                  cursor: batchLoadingExecute || batchLoadingPreview || !batchPreview?.validRows?.length ? 'not-allowed' : 'pointer',
                  background: '#33576f',
                  color: 'white',
                  height: 40,
                  opacity: batchLoadingExecute || batchLoadingPreview || !batchPreview?.validRows?.length ? 0.65 : 1,
                }}
              >
                {batchLoadingExecute ? 'Ejecutando...' : 'Crear usuarios'}
              </button>
            </div>

            {batchPreview && (
              <div style={{ marginTop: '1rem' }}>
                <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                  <div>
                    <strong>Total:</strong> {batchPreview.fileMeta?.total ?? 0}
                  </div>
                  <div>
                    <strong>Válidos:</strong> {batchPreview.validRows?.length ?? 0}
                  </div>
                  <div>
                    <strong>Con error:</strong> {batchPreview.invalidRows?.length ?? 0}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>Preview válidos (muestra 20)</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '0.35rem' }}>#</th>
                            <th style={{ padding: '0.35rem' }}>Nombre</th>
                            <th style={{ padding: '0.35rem' }}>Apellido</th>
                            <th style={{ padding: '0.35rem' }}>Email</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(batchPreview.validRows || []).slice(0, 20).map((r) => (
                            <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.35rem' }}>{r.rowNumber}</td>
                              <td style={{ padding: '0.35rem' }}>{r.normalized?.name}</td>
                              <td style={{ padding: '0.35rem' }}>{r.normalized?.lastName}</td>
                              <td style={{ padding: '0.35rem' }}>{r.normalized?.email}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem' }}>
                    <h3 style={{ marginTop: 0, marginBottom: 8 }}>Con inconsistencias (muestra 20)</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                            <th style={{ padding: '0.35rem' }}>#</th>
                            <th style={{ padding: '0.35rem' }}>Email</th>
                            <th style={{ padding: '0.35rem' }}>Errores</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(batchPreview.invalidRows || []).slice(0, 20).map((r) => (
                            <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f3f4f6' }}>
                              <td style={{ padding: '0.35rem' }}>{r.rowNumber}</td>
                              <td style={{ padding: '0.35rem' }}>{r.normalized?.email || ''}</td>
                              <td style={{ padding: '0.35rem' }}>{(r.errors || []).join('; ')}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {batchResult && (
              <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
                <h3 style={{ marginTop: 0 }}>Resultados</h3>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => downloadCsv(batchResult.successRows, 'usuarios_batch_exitosos.csv')}
                    style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                  >
                    Descargar OK
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadCsv(batchResult.errorRows, 'usuarios_batch_errores.csv')}
                    style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                  >
                    Descargar Errores
                  </button>
                </div>
                <div style={{ marginTop: 8, color: '#6b7280', fontSize: '0.9rem' }}>
                  ID corrida: <strong>{batchResult.processRunId}</strong>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
