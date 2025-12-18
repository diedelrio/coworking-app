import { useEffect, useMemo, useState } from 'react';
import api from '../api/axiosClient';
import Layout from '../components/Layout';

const VALUE_TYPES = [
  { value: 'STRING', label: 'STRING' },
  { value: 'NUMBER', label: 'NUMBER' },
  { value: 'BOOL', label: 'BOOL' },
  { value: 'JSON', label: 'JSON' },
];

const STATUS_OPTIONS = [
  { value: 'ACTIVE', label: 'Activos' },
  { value: 'INACTIVE', label: 'Inactivos' },
  { value: 'ALL', label: 'Todos' },
];

function safeString(v) {
  if (v == null) return '';
  return String(v);
}

function prettyValue(value, valueType) {
  if (value == null) return '';
  if (valueType === 'JSON') {
    try {
      const obj = typeof value === 'string' ? JSON.parse(value) : value;
      return JSON.stringify(obj, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

export default function AdminSettings() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // filtros
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');

  // modal create/edit
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null); // setting | null

  const [formKey, setFormKey] = useState('');
  const [formValueType, setFormValueType] = useState('STRING');
  const [formValue, setFormValue] = useState('');
  const [formStatus, setFormStatus] = useState('ACTIVE');
  const [formDescription, setFormDescription] = useState('');

  // historial
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState('');
  const [historyRows, setHistoryRows] = useState([]);
  const [historySetting, setHistorySetting] = useState(null);

  async function load() {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/settings');
      setRows(res.data || []);
    } catch (e) {
      console.error(e);
      setError('Error al cargar las reglas de negocio');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();

    return (rows || [])
      .filter((r) => {
        if (statusFilter === 'ALL') return true;
        return r.status === statusFilter;
      })
      .filter((r) => {
        if (!q) return true;
        const hay =
          `${safeString(r.key)} ${safeString(r.value)} ${safeString(r.description)} ${safeString(r.valueType)}`
            .toLowerCase();
        return hay.includes(q);
      })
      .sort((a, b) => safeString(a.key).localeCompare(safeString(b.key)));
  }, [rows, query, statusFilter]);

  function openCreate() {
    setEditing(null);
    setFormKey('');
    setFormValueType('STRING');
    setFormValue('');
    setFormStatus('ACTIVE');
    setFormDescription('');
    setModalOpen(true);
    setError('');
  }

  function openEdit(row) {
    setEditing(row);
    setFormKey(row.key || '');
    setFormValueType(row.valueType || 'STRING');
    setFormValue(prettyValue(row.value, row.valueType));
    setFormStatus(row.status || 'ACTIVE');
    setFormDescription(row.description || '');
    setModalOpen(true);
    setError('');
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setSaving(false);
  }

  async function onSave() {
    try {
      setSaving(true);
      setError('');

      const payload = {
        key: formKey.trim(),
        valueType: formValueType,
        value: formValueType === 'JSON' ? formValue.trim() : safeString(formValue).trim(),
        status: formStatus,
        description: formDescription?.trim() || null,
      };

      // validaciones mínimas
      if (!editing) {
        if (!payload.key || !payload.valueType || payload.value === '') {
          setError('Completa Key, Tipo y Valor.');
          setSaving(false);
          return;
        }
      } else {
        // en edición permitimos cambiar value/status/description; key y type quedan bloqueados en UI
        if (payload.value === '') {
          setError('El valor no puede estar vacío.');
          setSaving(false);
          return;
        }
      }

      // valida JSON si aplica
      if (payload.valueType === 'JSON') {
        try {
          JSON.parse(payload.value);
        } catch {
          setError('El JSON no es válido.');
          setSaving(false);
          return;
        }
      }

      if (!editing) {
        await api.post('/settings', {
          key: payload.key,
          value: payload.value,
          valueType: payload.valueType,
          description: payload.description,
        });
      } else {
        await api.put(`/settings/${editing.id}`, {
          value: payload.value,
          status: payload.status,
          description: payload.description,
        });
      }

      await load();
      closeModal();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar el setting.');
      setSaving(false);
    }
  }

  async function openHistory(row) {
    try {
      setHistoryOpen(true);
      setHistorySetting(row);
      setHistoryRows([]);
      setHistoryError('');
      setHistoryLoading(true);

      const res = await api.get(`/settings/${row.id}/history`);
      setHistoryRows(res.data || []);
    } catch (e) {
      console.error(e);
      setHistoryError('No se pudo cargar el historial.');
    } finally {
      setHistoryLoading(false);
    }
  }

  function closeHistory() {
    setHistoryOpen(false);
    setHistorySetting(null);
    setHistoryRows([]);
    setHistoryError('');
    setHistoryLoading(false);
  }

  return (
    <Layout>
      <div className="admin-page settings-page">
        <div className="settings-header">
          <div>
            <h1 className="settings-title">Reglas de negocio</h1>
            <div className="settings-subtitle">
              Configuración dinámica del sistema (horarios, validaciones y límites).
            </div>
          </div>

          <button className="pill-button" type="button" onClick={openCreate} title="Crear setting">
            + Crear Regla
          </button>
        </div>

        {error ? <div className="error settings-error">{error}</div> : null}

        <div className="admin-card settings-card">
          <div className="settings-toolbar">
            <div className="settings-search">
              <div className="settings-label">Buscar</div>
              <input
                className="settings-input"
                placeholder="Buscar por key, valor, descripción..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </div>

            <div className="settings-filter">
              <div className="settings-label">Estado</div>
              <select
                className="settings-input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
              >
                {STATUS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {loading ? (
            <div className="settings-loading">Cargando settings...</div>
          ) : filtered.length === 0 ? (
            <div className="settings-empty">No hay reglas configuradas todavía.</div>
          ) : (
            <div className="settings-table-wrap">
              <table className="admin-table settings-table">
                <thead>
                  <tr>
                    <th style={{ width: '42%' }}>Key</th>
                    <th style={{ width: '14%' }}>Tipo</th>
                    <th style={{ width: '24%' }}>Valor</th>
                    <th style={{ width: '10%' }}>Estado</th>
                    <th style={{ width: '10%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={r.id}>
                      <td className="settings-key">{r.key}</td>
                      <td>{r.valueType}</td>
                      <td className="settings-value">{safeString(r.value)}</td>
                      <td>
                        {r.status === 'ACTIVE' ? (
                          <span className="badge green">Activo</span>
                        ) : (
                          <span className="badge">Inactivo</span>
                        )}
                      </td>
                      <td className="settings-actions">
                        <button
                          type="button"
                          className="pill-button-outline small"
                          onClick={() => openHistory(r)}
                        >
                          Historial
                        </button>
                        <button
                          type="button"
                          className="pill-button-outline small"
                          onClick={() => openEdit(r)}
                        >
                          Editar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ===== Modal Create/Edit ===== */}
        {modalOpen && (
          <div className="settings-modal-overlay" onClick={closeModal}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <div>
                  <div className="settings-modal-title">
                    {editing ? 'Editar Regla' : 'Nueva Regla'}
                  </div>
                  <div className="settings-modal-subtitle">
                    Cambios impactan reglas en tiempo real (cache ~60s).
                  </div>
                </div>

                <button className="settings-modal-close" type="button" onClick={closeModal}>
                  ✕
                </button>
              </div>

              <div className="settings-modal-body">
                <div className="settings-modal-grid">
                  <div className="settings-field">
                    <label>Key {editing ? '(no editable)' : '*'}</label>
                    <input
                      className="settings-input"
                      value={formKey}
                      onChange={(e) => setFormKey(e.target.value)}
                      disabled={!!editing || saving}
                      placeholder="OFFICE_OPEN_HOUR"
                    />
                  </div>

                  <div className="settings-field">
                    <label>Tipo *</label>
                    <select
                      className="settings-input"
                      value={formValueType}
                      onChange={(e) => setFormValueType(e.target.value)}
                      disabled={!!editing || saving}
                    >
                      {VALUE_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="settings-field settings-field-full">
                    <label>Valor *</label>
                    <textarea
                      className="settings-textarea"
                      value={formValue}
                      onChange={(e) => setFormValue(e.target.value)}
                      rows={formValueType === 'JSON' ? 7 : 3}
                      disabled={saving}
                      placeholder={formValueType === 'JSON' ? '{ "a": 1 }' : 'Ej: 9'}
                    />
                  </div>

                  <div className="settings-field">
                    <label>Estado</label>
                    <select
                      className="settings-input"
                      value={formStatus}
                      onChange={(e) => setFormStatus(e.target.value)}
                      disabled={saving}
                    >
                      <option value="ACTIVE">ACTIVO</option>
                      <option value="INACTIVE">INACTIVO</option>
                    </select>
                  </div>

                  <div className="settings-field">
                    <label>Descripción</label>
                    <input
                      className="settings-input"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      disabled={saving}
                      placeholder="Ej: Hora de apertura del coworking (24h)"
                    />
                  </div>
                </div>

                {error ? <div className="error settings-modal-error">{error}</div> : null}
              </div>

              <div className="settings-modal-footer">
                <button
                  className="pill-button-outline"
                  type="button"
                  onClick={closeModal}
                  disabled={saving}
                >
                  Cancelar
                </button>
                <button className="pill-button" type="button" onClick={onSave} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ===== Modal Historial ===== */}
        {historyOpen && (
          <div className="settings-modal-overlay" onClick={closeHistory}>
            <div className="settings-modal history-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <div>
                  <div className="settings-modal-title">Historial</div>
                  <div className="settings-modal-subtitle">
                    {historySetting?.key || ''}
                  </div>
                </div>

                <button className="settings-modal-close" type="button" onClick={closeHistory}>
                  ✕
                </button>
              </div>

              <div className="settings-modal-body">
                {historyLoading ? (
                  <div className="settings-loading">Cargando historial…</div>
                ) : historyError ? (
                  <div className="error">{historyError}</div>
                ) : historyRows.length === 0 ? (
                  <div className="settings-empty">Sin cambios registrados.</div>
                ) : (
                  <div className="settings-history-list">
                    {historyRows.map((h) => (
                      <div className="settings-history-item" key={h.id}>
                        <div className="settings-history-top">
                          <div className="settings-history-meta">
                            <span className="settings-history-date">
                              {new Date(h.createdAt).toLocaleString('es-ES')}
                            </span>
                            <span className="settings-history-badge">
                              {h.action || 'UPDATE'}
                            </span>
                          </div>
                        </div>

                        <div className="settings-history-grid">
                          <div>
                            <div className="settings-history-label">Valor</div>
                            <pre className="settings-history-pre">
                              {prettyValue(h.value, h.valueType)}
                            </pre>
                          </div>

                          <div>
                            <div className="settings-history-label">Estado</div>
                            <div>{h.status || '-'}</div>

                            <div className="settings-history-label" style={{ marginTop: 10 }}>
                              Tipo
                            </div>
                            <div>{h.valueType || '-'}</div>
                          </div>
                        </div>

                        {h.description ? (
                          <div className="settings-history-desc">
                            <div className="settings-history-label">Descripción</div>
                            <div>{h.description}</div>
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="settings-modal-footer">
                <button className="pill-button-outline" type="button" onClick={closeHistory}>
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
