import { useEffect, useState } from 'react';
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

export default function OperationsBilling() {
  const [eligibleUsers, setEligibleUsers] = useState([]);
  const [billingUserId, setBillingUserId] = useState('');
  const [billingPreview, setBillingPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    const loadEligible = async () => {
      try {
        const res = await api.get('/admin/operations/liquidations/eligible-users');
        setEligibleUsers(Array.isArray(res.data) ? res.data : []);
      } catch {
        setEligibleUsers([]);
      }
    };
    loadEligible();
  }, []);

  const loadBillingPreview = async () => {
    setError(null);
    setMessage(null);
    setLoadingPreview(true);
    setBillingPreview(null);

    try {
      const res = await api.get('/admin/operations/liquidations/preview', {
        params: { userId: billingUserId || undefined },
      });
      setBillingPreview(res.data);
      if (!res.data?.count) {
        setMessage('No hay reservas pendientes de facturación para los filtros seleccionados.');
      }
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error generando preview de facturación');
    } finally {
      setLoadingPreview(false);
    }
  };

  const generateLiquidations = async () => {
    setError(null);
    setMessage(null);
    setLoadingAction(true);
    try {
      const res = await api.post('/admin/operations/liquidations/generate', {
        userId: billingUserId || undefined,
      });

      setMessage(
        res.data?.message ||
          `Liquidaciones: ${res.data?.createdLiquidations ?? 0} | Items: ${res.data?.createdItems ?? 0} | Reservas INVOICED: ${
            res.data?.updatedReservations ?? 0
          }`
      );

      await loadBillingPreview();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error generando liquidaciones');
    } finally {
      setLoadingAction(false);
    }
  };

  const billingHasSomethingToInvoice = !!billingPreview?.count;

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>Facturación</h2>
      <p style={{ marginTop: 6, color: '#6b7280' }}>
        RF-OPER-02 — Generación manual de liquidaciones para reservas COMPLETED/PENALIZED no facturadas.
      </p>

      <AlertBanner error={error} message={message} />

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
            disabled={loadingPreview || loadingAction}
            style={{ padding: '0.6rem 0.9rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer', height: 40 }}
          >
            {loadingPreview ? 'Cargando...' : 'Preview'}
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'end' }}>
          <button
            type="button"
            onClick={generateLiquidations}
            disabled={loadingAction || loadingPreview || !billingHasSomethingToInvoice}
            style={{
              padding: '0.6rem 0.9rem',
              borderRadius: '0.6rem',
              border: '1px solid #e5e7eb',
              cursor: loadingAction || loadingPreview || !billingHasSomethingToInvoice ? 'not-allowed' : 'pointer',
              background: '#33576f',
              color: 'white',
              height: 40,
              opacity: loadingAction || loadingPreview || !billingHasSomethingToInvoice ? 0.65 : 1,
            }}
            title={!billingHasSomethingToInvoice ? 'Primero generá un preview con reservas pendientes' : ''}
          >
            {loadingAction ? 'Generando...' : 'Generar liquidaciones'}
          </button>
        </div>
      </div>

      <div style={{ marginTop: '1rem', color: '#6b7280' }}>
        Se consideran sólo reservas <strong>COMPLETED</strong> o <strong>PENALIZED</strong> sin liquidación previa. Al generar, se marcan como{' '}
        <strong>INVOICED</strong>.
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
  );
}
