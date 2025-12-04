import { useEffect, useState } from 'react';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';
import Layout from '../components/Layout';

export default function AdminSettings() {
  const [settings, setSettings] = useState([]);
  const [loadingSettings, setLoadingSettings] = useState(true);
  const [error, setError] = useState('');

  const [selectedSetting, setSelectedSetting] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editStatus, setEditStatus] = useState('ACTIVE');

  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const user = getCurrentUser();

  useEffect(() => {
    loadSettings();
  }, []);

  async function loadSettings() {
    try {
      setError('');
      setLoadingSettings(true);
      const res = await api.get('/settings');
      setSettings(res.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar las reglas de negocio');
    } finally {
      setLoadingSettings(false);
    }
  }

  function startEdit(setting) {
    setSelectedSetting(setting);
    setEditValue(setting.value);
    setEditStatus(setting.status);
    setHistory([]);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!selectedSetting) return;

    try {
      setError('');
      const res = await api.put(`/settings/${selectedSetting.id}`, {
        value: editValue,
        status: editStatus,
      });

      // Actualizar lista en memoria
      setSettings((prev) =>
        prev.map((s) => (s.id === res.data.id ? res.data : s))
      );
      setSelectedSetting(null);
    } catch (err) {
      console.error(err);
      setError('Error al guardar los cambios');
    }
  }

  async function loadHistory(settingId) {
    try {
      setLoadingHistory(true);
      setError('');
      const res = await api.get(`/settings/${settingId}/history`);
      setHistory(res.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar el historial');
    } finally {
      setLoadingHistory(false);
    }
  }

  return (
      <Layout user={user}>

      <div className="admin-page">
        <div
          className="admin-header"
          style={{ justifyContent: 'space-between', alignItems: 'center' }}
        >
          <div>
            <h1>Reglas de negocio</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Configuración de límites de reservas y otras reglas globales
            </span>
          </div>


        </div>

        {error && (
          <div className="error" style={{ maxWidth: 600, marginBottom: '1rem' }}>
            {error}
          </div>
        )}

        {/* Lista de reglas */}
        <div className="admin-card">
          <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
            Reglas configurables
          </h2>

          {loadingSettings ? (
            <p>Cargando reglas...</p>
          ) : settings.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              No hay reglas configuradas todavía.
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Clave</th>
                  <th>Descripción</th>
                  <th>Valor</th>
                  <th>Tipo</th>
                  <th>Estado</th>
                  <th>Última actualización</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {settings.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '0.8rem',
                          backgroundColor: '#f3f4f6',
                          borderRadius: '999px',
                          padding: '0.1rem 0.6rem',
                        }}
                      >
                        {s.key}
                      </span>
                    </td>
                    <td>{s.description || '-'}</td>
                    <td>{s.value}</td>
                    <td>{s.valueType}</td>
                    <td>
                      {s.status === 'ACTIVE' ? (
                        <span className="badge green">Activa</span>
                      ) : (
                        <span className="badge gray">Inactiva</span>
                      )}
                    </td>
                    <td>
                      {s.updatedAt
                        ? new Date(s.updatedAt).toLocaleString()
                        : '-'}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => startEdit(s)}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-small"
                        onClick={() => loadHistory(s.id)}
                      >
                        Historial
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Formulario de edición */}
        {selectedSetting && (
          <div className="admin-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
              Editar regla: {selectedSetting.key}
            </h2>

            <form
              onSubmit={handleSave}
              style={{ maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '0.8rem' }}
            >
              <div>
                <label
                  htmlFor="value"
                  style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}
                >
                  Valor ({selectedSetting.valueType})
                </label>
                <input
                  id="value"
                  type="text"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  style={{ width: '100%', padding: '0.45rem 0.6rem' }}
                />
              </div>

              <div>
                <label
                  htmlFor="status"
                  style={{ display: 'block', fontSize: '0.85rem', marginBottom: '0.25rem' }}
                >
                  Estado
                </label>
                <select
                  id="status"
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  style={{ padding: '0.45rem 0.6rem' }}
                >
                  <option value="ACTIVE">ACTIVA</option>
                  <option value="INACTIVE">INACTIVA</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button type="submit" className="button" style={{ maxWidth: 180 }}>
                  Guardar cambios
                </button>
                <button
                  type="button"
                  className="btn-secondary"
                  style={{ maxWidth: 140 }}
                  onClick={() => setSelectedSetting(null)}
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Historial de cambios */}
        {loadingHistory && (
          <p style={{ marginTop: '1rem' }}>Cargando historial...</p>
        )}

        {history.length > 0 && (
          <div className="admin-card" style={{ marginTop: '1.5rem' }}>
            <h2 style={{ marginTop: 0, marginBottom: '1rem', fontSize: '1.1rem' }}>
              Historial de cambios
            </h2>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {history.map((h) => (
                <li
                  key={h.id}
                  style={{
                    borderBottom: '1px solid #e5e7eb',
                    paddingBottom: '0.4rem',
                    marginBottom: '0.4rem',
                    fontSize: '0.9rem',
                  }}
                >
                  <div>
                    <strong>{h.action}</strong> –{' '}
                    {new Date(h.createdAt).toLocaleString()}
                  </div>
                  <div
                    style={{
                      fontFamily: 'monospace',
                      fontSize: '0.8rem',
                      marginTop: '0.2rem',
                    }}
                  >
                    {h.oldValue ?? '∅'} → {h.newValue}
                  </div>
                  <div
                    style={{
                      fontSize: '0.75rem',
                      color: '#6b7280',
                      marginTop: '0.1rem',
                    }}
                  >
                    Por:{' '}
                    {h.changedBy
                      ? `${h.changedBy.name || ''} (${h.changedBy.email})`
                      : 'sistema'}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Layout>
  );
}
