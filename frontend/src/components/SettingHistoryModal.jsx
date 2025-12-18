import { useEffect, useState } from 'react';
import api from '../api/axiosClient';

export default function SettingHistoryModal({ setting, onClose }) {
  const [loading, setLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        setError('');
        const res = await api.get(`/settings/${setting.id}/history`);
        setHistory(res.data || []);
      } catch (e) {
        console.error(e);
        setError('Error al obtener historial');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [setting.id]);

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(15, 23, 42, 0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 60,
        padding: '1rem',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 900,
          background: 'white',
          borderRadius: 16,
          boxShadow: '0 20px 45px rgba(15, 23, 42, 0.35)',
          padding: '1.25rem',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '1rem',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <div>
            <div style={{ fontWeight: 800, fontSize: '1.05rem' }}>
              Historial — {setting.key}
            </div>
            <div style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: 4 }}>
              Cambios registrados del setting.
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              border: 'none',
              borderRadius: 999,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: '#f3f4f6',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        </div>

        {error ? <div className="error">{error}</div> : null}

        <div className="admin-card" style={{ padding: '0.75rem' }}>
          {loading ? (
            <div style={{ padding: '1rem', textAlign: 'center' }}>Cargando…</div>
          ) : history.length === 0 ? (
            <div style={{ padding: '1rem', color: '#6b7280' }}>
              Aún no hay historial para este setting.
            </div>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: 160 }}>Fecha</th>
                  <th style={{ width: 120 }}>Acción</th>
                  <th>Valor anterior</th>
                  <th>Valor nuevo</th>
                  <th style={{ width: 220 }}>Usuario</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => {
                  const dt = h.createdAt ? new Date(h.createdAt) : null;
                  const when = dt
                    ? dt.toLocaleString('es-ES', { hour: '2-digit', minute: '2-digit' })
                    : '—';

                  const user = h.changedBy
                    ? `${h.changedBy.name || ''} ${h.changedBy.email ? `(${h.changedBy.email})` : ''}`.trim()
                    : 'Sistema';

                  return (
                    <tr key={h.id}>
                      <td>{when}</td>
                      <td>
                        <span className="badge">{h.action}</span>
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {h.oldValue ?? '—'}
                      </td>
                      <td style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                        {h.newValue ?? '—'}
                      </td>
                      <td>{user}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <button className="pill-button-outline" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
