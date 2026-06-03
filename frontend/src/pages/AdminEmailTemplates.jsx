import { useEffect, useMemo, useState } from 'react';
import Layout from '../components/Layout';
import api from '../api/axiosClient';

export default function AdminEmailTemplates() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [isCreating, setIsCreating] = useState(false);

  const selected = useMemo(
    () => items.find((x) => String(x.id) === String(selectedId)) || null,
    [items, selectedId]
  );

  const [form, setForm] = useState({
    key: '',
    name: '',
    subject: '',
    body: '',
  });

  async function load() {
    setLoading(true);
    setError('');
    setInfo('');
    try {
      const res = await api.get('/admin/email-templates');
      const data = res.data || [];
      setItems(data);

      if (!isCreating) {
        const first = data[0];
        if (first) setSelectedId(first.id);
      }
    } catch (e) {
      setError(e?.response?.data?.message || 'Error cargando templates');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;

    setIsCreating(false);
    setError('');
    setInfo('');

    setForm({
      key: selected.key || '',
      name: selected.name || '',
      subject: selected.subject || '',
      body: selected.body || '',
    });
  }, [selectedId, selected]);

  function startCreate() {
    setIsCreating(true);
    setSelectedId('');
    setError('');
    setInfo('');
    setForm({
      key: '',
      name: '',
      subject: '',
      body: '',
    });
  }

  function cancelCreate() {
    setIsCreating(false);
    setError('');
    setInfo('');

    if (items[0]) {
      setSelectedId(items[0].id);
    }
  }

  function handleSelectTemplate(value) {
    if (!value) return;
    setSelectedId(value);
    setIsCreating(false);
  }

  async function saveOrCreate() {
    setSaving(true);
    setError('');
    setInfo('');

    try {
      if (isCreating) {
        if (!form.key?.trim() || !form.name?.trim() || !form.subject?.trim() || !form.body?.trim()) {
          setSaving(false);
          setError('key, nombre, asunto y body son obligatorios');
          return;
        }

        const res = await api.post('/admin/email-templates', {
          key: form.key.trim(),
          name: form.name.trim(),
          subject: form.subject.trim(),
          body: form.body.trim(),
        });

        const created = res.data?.template;

        setItems((prev) => {
          const next = [...prev, created];
          next.sort((a, b) => (a.key || '').localeCompare(b.key || ''));
          return next;
        });

        setSelectedId(created.id);
        setIsCreating(false);
        setInfo('Template creado ✅');
        return;
      }

      if (!selected) {
        setSaving(false);
        setError('Selecciona un template para editar');
        return;
      }

      if (!form.name?.trim() || !form.subject?.trim() || !form.body?.trim()) {
        setSaving(false);
        setError('nombre, asunto y body son obligatorios');
        return;
      }

      const res = await api.put(`/admin/email-templates/${selected.id}`, {
        name: form.name.trim(),
        subject: form.subject.trim(),
        body: form.body.trim(),
      });

      const updated = res.data?.template;

      setItems((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setInfo('Template actualizado ✅');
    } catch (e) {
      setError(e?.response?.data?.message || (isCreating ? 'Error creando template' : 'Error guardando template'));
    } finally {
      setSaving(false);
    }
  }

  const headerTitle = isCreating ? 'Nuevo Email Template' : (selected?.name || 'Email Templates');
  const headerKey = isCreating ? '(crear nuevo)' : (selected?.key ? `key: ${selected.key}` : '');

  return (
    <Layout>
      <div className="admin-page" style={{ width: '100%', maxWidth: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', marginBottom: '1rem' }}>
          <div>
            <h1 style={{ margin: 0 }}>Email Templates</h1>
            <p style={{ margin: '0.45rem 0 0', color: '#6b7280' }}>
              Edita asunto y cuerpo de emails sin tocar código.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="admin-card">Cargando…</div>
        ) : (
          <div style={{ display: 'grid', gap: '1rem' }}>
            <div className="admin-card">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(260px, 1fr) auto',
                  gap: '1rem',
                  alignItems: 'end',
                }}
                className="admin-email-template-selector-row"
              >
                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Templates</span>
                  <select
                    value={isCreating ? '' : (selectedId || '')}
                    onChange={(e) => handleSelectTemplate(e.target.value)}
                    disabled={items.length === 0 || isCreating}
                    style={{
                      width: '100%',
                      minHeight: 42,
                      padding: '0 0.75rem',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      background: '#fff',
                    }}
                  >
                    <option value="">
                      {isCreating ? 'Creando nuevo template…' : 'Selecciona un template…'}
                    </option>
                    {items.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} · {t.key}
                      </option>
                    ))}
                  </select>
                </label>

                {!isCreating ? (
                  <button onClick={startCreate} className="pill-button">
                    + Nuevo template
                  </button>
                ) : (
                  <button onClick={cancelCreate} className="pill-button-outline">
                    Cancelar
                  </button>
                )}
              </div>

              {items.length === 0 && !isCreating && (
                <p style={{ margin: '0.75rem 0 0', color: '#6b7280' }}>No hay templates.</p>
              )}
            </div>

            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'flex-start' }}>
                <div>
                  <h3 style={{ marginTop: 0, marginBottom: 4 }}>{headerTitle}</h3>
                  <div style={{ fontSize: 12, color: '#6b7280' }}>{headerKey}</div>
                </div>

                <button
                  onClick={saveOrCreate}
                  disabled={saving || (!isCreating && !selected)}
                  className="pill-button"
                >
                  {saving ? (isCreating ? 'Creando…' : 'Guardando…') : (isCreating ? 'Crear' : 'Guardar')}
                </button>
              </div>

              <div style={{ marginTop: '1rem', display: 'grid', gap: '0.75rem' }}>
                {isCreating ? (
                  <label style={{ display: 'grid', gap: 6 }}>
                    <span style={{ fontWeight: 700 }}>Key (único)</span>
                    <input
                      value={form.key}
                      onChange={(e) => setForm((p) => ({ ...p, key: e.target.value }))}
                      placeholder="reservation_pending_approval"
                      style={{ padding: '0.65rem', borderRadius: 10, border: '1px solid #e5e7eb' }}
                    />
                  </label>
                ) : (
                  <div style={{ fontSize: 12, color: '#6b7280' }}>
                    key: <b>{selected?.key || '-'}</b>
                  </div>
                )}

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Nombre</span>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                    style={{ padding: '0.65rem', borderRadius: 10, border: '1px solid #e5e7eb' }}
                    placeholder="Reserva pendiente de aprobación"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Asunto</span>
                  <input
                    value={form.subject}
                    onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
                    style={{ padding: '0.65rem', borderRadius: 10, border: '1px solid #e5e7eb' }}
                    placeholder="Reserva pendiente: {{userName}}"
                  />
                </label>

                <label style={{ display: 'grid', gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>Body</span>
                  <textarea
                    value={form.body}
                    onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
                    rows={14}
                    style={{
                      padding: '0.65rem',
                      borderRadius: 10,
                      border: '1px solid #e5e7eb',
                      fontFamily: 'inherit',
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                    placeholder="Hola {{adminName}}, ..."
                  />
                  <span style={{ fontSize: 12, color: '#6b7280' }}>
                    Sugerencia: usa variables tipo <code>{'{{userName}}'}</code>, <code>{'{{date}}'}</code>, etc.
                    (las conectamos en el backend después).
                  </span>
                </label>

                {error && <div style={{ color: '#b91c1c', fontWeight: 700 }}>{error}</div>}
                {info && <div style={{ color: '#047857', fontWeight: 800 }}>{info}</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media (max-width: 768px) {
          .admin-email-template-selector-row {
            grid-template-columns: 1fr !important;
          }

          .admin-email-template-selector-row .pill-button,
          .admin-email-template-selector-row .pill-button-outline {
            width: 100%;
          }
        }
      `}</style>
    </Layout>
  );
}
