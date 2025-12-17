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
    () => items.find((x) => x.id === selectedId) || null,
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

      // Si estamos creando, no pisamos el form ni seleccionamos
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

  // Cuando cambia el seleccionado, cargamos el form en modo edición
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
    setSelectedId(null);
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

    // Volver a seleccionar algo (primer item) si existe
    if (items[0]) {
      setSelectedId(items[0].id);
    }
  }

  async function saveOrCreate() {
    setSaving(true);
    setError('');
    setInfo('');

    try {
      if (isCreating) {
        // Validación mínima en frontend (el backend también valida)
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

      // Modo edición
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
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '1rem' }}>
        <h1 style={{ marginTop: 0 }}>Email Templates</h1>
        <p style={{ marginTop: 0, color: '#6b7280' }}>
          Edita asunto y cuerpo de emails sin tocar código.
        </p>

        {loading ? (
          <div className="admin-card">Cargando…</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: '360px 1fr', gap: '1rem' }}>
            {/* LISTA */}
            <div className="admin-card">
              <h3 style={{ marginTop: 0 }}>Templates</h3>

              <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
                {!isCreating ? (
                  <button
                    onClick={startCreate}
                    className="pill-button"
                  >
                    + Nuevo template
                  </button>
                ) : (
                  <button
                    onClick={cancelCreate}
                    className="pill-button"
                  >
                    Cancelar
                  </button>
                )}
              </div>

              {items.length === 0 ? (
                <p style={{ color: '#6b7280' }}>No hay templates.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {items.map((t) => {
                    const active = t.id === selectedId && !isCreating;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelectedId(t.id)}
                        disabled={isCreating} // mientras creás, bloqueamos para evitar confusión
                        style={{
                          textAlign: 'left',
                          padding: '0.75rem',
                          borderRadius: '12px',
                          border: active ? '2px solid #111827' : '1px solid #e5e7eb',
                          background: active ? '#f3f4f6' : 'white',
                          cursor: isCreating ? 'not-allowed' : 'pointer',
                          opacity: isCreating ? 0.6 : 1,
                        }}
                      >
                        <div style={{ fontWeight: 800 }}>{t.name}</div>
                        <div style={{ fontSize: 12, color: '#6b7280' }}>{t.key}</div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* EDITOR (UNO SOLO) */}
            <div className="admin-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
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
                {/* KEY: editable solo en creación */}
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
    </Layout>
  );
}
