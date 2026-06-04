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
  const [detailSaving, setDetailSaving] = useState(false);
  const [error, setError] = useState('');
  const [detailMessage, setDetailMessage] = useState('');

  // filtros
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [selectedId, setSelectedId] = useState('');

  // modal create
  const [modalOpen, setModalOpen] = useState(false);
  const [formKey, setFormKey] = useState('');
  const [formValueType, setFormValueType] = useState('STRING');
  const [formValue, setFormValue] = useState('');
  const [formDescription, setFormDescription] = useState('');

  // detalle seleccionado
  const [detailValue, setDetailValue] = useState('');
  const [detailStatus, setDetailStatus] = useState('ACTIVE');
  const [detailDescription, setDetailDescription] = useState('');

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

  const selected = useMemo(() => {
    if (!filtered.length) return null;
    return filtered.find((r) => String(r.id) === String(selectedId)) || filtered[0];
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId('');
      return;
    }

    const exists = filtered.some((r) => String(r.id) === String(selectedId));
    if (!selectedId || !exists) {
      setSelectedId(String(filtered[0].id));
    }
  }, [filtered, selectedId]);

  useEffect(() => {
    if (!selected) {
      setDetailValue('');
      setDetailStatus('ACTIVE');
      setDetailDescription('');
      return;
    }

    setDetailValue(prettyValue(selected.value, selected.valueType));
    setDetailStatus(selected.status || 'ACTIVE');
    setDetailDescription(selected.description || '');
    setDetailMessage('');
  }, [selected?.id]);

  function openCreate() {
    setFormKey('');
    setFormValueType('STRING');
    setFormValue('');
    setFormDescription('');
    setModalOpen(true);
    setError('');
    setDetailMessage('');
  }

  function closeModal() {
    setModalOpen(false);
    setSaving(false);
  }

  async function onCreate() {
    try {
      setSaving(true);
      setError('');

      const payload = {
        key: formKey.trim(),
        valueType: formValueType,
        value: formValueType === 'JSON' ? formValue.trim() : safeString(formValue).trim(),
        description: formDescription?.trim() || null,
      };

      if (!payload.key || !payload.valueType || payload.value === '') {
        setError('Completa Key, Tipo y Valor.');
        setSaving(false);
        return;
      }

      if (payload.valueType === 'JSON') {
        try {
          JSON.parse(payload.value);
        } catch {
          setError('El JSON no es válido.');
          setSaving(false);
          return;
        }
      }

      const res = await api.post('/settings', payload);
      await load();

      if (res?.data?.id) {
        setSelectedId(String(res.data.id));
      }

      closeModal();
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar el setting.');
      setSaving(false);
    }
  }

  async function onSaveSelected() {
    if (!selected) return;

    try {
      setDetailSaving(true);
      setError('');
      setDetailMessage('');

      const payload = {
        value: selected.valueType === 'JSON' ? detailValue.trim() : safeString(detailValue).trim(),
        status: detailStatus,
        description: detailDescription?.trim() || null,
      };

      if (payload.value === '') {
        setError('El valor no puede estar vacío.');
        setDetailSaving(false);
        return;
      }

      if (selected.valueType === 'JSON') {
        try {
          JSON.parse(payload.value);
        } catch {
          setError('El JSON no es válido.');
          setDetailSaving(false);
          return;
        }
      }

      await api.put(`/settings/${selected.id}`, payload);
      await load();
      setSelectedId(String(selected.id));
      setDetailMessage('Regla actualizada correctamente.');
    } catch (e) {
      console.error(e);
      setError('No se pudo guardar el setting.');
    } finally {
      setDetailSaving(false);
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
        </div>

        {error ? <div className="error settings-error">{error}</div> : null}
        {detailMessage ? <div className="form-success settings-error">{detailMessage}</div> : null}

        <div className="admin-card settings-card settings-selector-card">
          <div className="settings-toolbar settings-toolbar--combo">
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

            <div className="settings-combo">
              <div className="settings-label">Regla</div>
              <select
                className="settings-input"
                value={selected?.id || ''}
                onChange={(e) => setSelectedId(e.target.value)}
                disabled={loading || filtered.length === 0}
              >
                {filtered.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.key}
                  </option>
                ))}
              </select>
            </div>

            <div className="settings-create-action">
              <button className="pill-button" type="button" onClick={openCreate}>
                + Crear Regla
              </button>
            </div>
          </div>

          <div className="settings-results-count">
            {loading ? 'Cargando reglas...' : `${filtered.length} regla${filtered.length === 1 ? '' : 's'} encontrada${filtered.length === 1 ? '' : 's'}`}
          </div>
        </div>

        <div className="admin-card settings-card settings-detail-card">
          {loading ? (
            <div className="settings-loading">Cargando settings...</div>
          ) : !selected ? (
            <div className="settings-empty">No hay reglas configuradas todavía.</div>
          ) : (
            <>
              <div className="settings-detail-head">
                <div>
                  <h2 class="responsive-title">{selected.key}</h2>
                  <p>
                    Tipo: <strong>{selected.valueType}</strong>
                  </p>
                </div>

                <div className="settings-detail-actions">
                  <button
                    type="button"
                    className="pill-button-outline"
                    onClick={() => openHistory(selected)}
                  >
                    Historial
                  </button>
                  <button
                    type="button"
                    className="pill-button"
                    onClick={onSaveSelected}
                    disabled={detailSaving}
                  >
                    {detailSaving ? 'Guardando…' : 'Guardar'}
                  </button>
                </div>
              </div>

              <div className="settings-modal-grid settings-detail-grid">
                <div className="settings-field">
                  <label>Key</label>
                  <input className="settings-input" value={selected.key || ''} disabled />
                </div>

                <div className="settings-field">
                  <label>Tipo</label>
                  <input className="settings-input" value={selected.valueType || ''} disabled />
                </div>

                <div className="settings-field">
                  <label>Estado</label>
                  <select
                    className="settings-input"
                    value={detailStatus}
                    onChange={(e) => setDetailStatus(e.target.value)}
                    disabled={detailSaving}
                  >
                    <option value="ACTIVE">ACTIVO</option>
                    <option value="INACTIVE">INACTIVO</option>
                  </select>
                </div>

                <div className="settings-field">
                  <label>Descripción</label>
                  <input
                    className="settings-input"
                    value={detailDescription}
                    onChange={(e) => setDetailDescription(e.target.value)}
                    disabled={detailSaving}
                    placeholder="Ej: Hora de apertura del coworking (24h)"
                  />
                </div>

                <div className="settings-field settings-field-full">
                  <label>Valor</label>
                  <textarea
                    className="settings-textarea settings-detail-value"
                    value={detailValue}
                    onChange={(e) => setDetailValue(e.target.value)}
                    rows={selected.valueType === 'JSON' ? 10 : 5}
                    disabled={detailSaving}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* ===== Modal Create ===== */}
        {modalOpen && (
          <div className="settings-modal-overlay" onClick={closeModal}>
            <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
              <div className="settings-modal-header">
                <div>
                  <div className="settings-modal-title">Nueva Regla</div>
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
                    <label>Key *</label>
                    <input
                      className="settings-input"
                      value={formKey}
                      onChange={(e) => setFormKey(e.target.value)}
                      disabled={saving}
                      placeholder="OFFICE_OPEN_HOUR"
                    />
                  </div>

                  <div className="settings-field">
                    <label>Tipo *</label>
                    <select
                      className="settings-input"
                      value={formValueType}
                      onChange={(e) => setFormValueType(e.target.value)}
                      disabled={saving}
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

                  <div className="settings-field settings-field-full">
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
                <button className="pill-button" type="button" onClick={onCreate} disabled={saving}>
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
