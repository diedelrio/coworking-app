import { useEffect, useMemo, useState } from 'react';
import {
  createPopupMessage,
  deletePopupMessage,
  listAdminPopupMessages,
  updatePopupMessage,
} from '../../api/popupMessages';

const EMPTY_FORM = {
  title: '',
  description: '',
  portal: 'BOTH',
  category: 'SYSTEM',
  active: true,
  showFrom: '',
  showUntil: '',
  showOnce: true,
  requireConfirmation: true,
};

const PORTAL_LABELS = {
  ADMIN: 'Administrador',
  CLIENT: 'Cliente',
  BOTH: 'Ambos portales',
};

const CATEGORY_LABELS = {
  SYSTEM: 'Sistema',
  RELEASE: 'Novedades / versión',
  COMMERCIAL: 'Comercial',
  SOCIAL: 'Social',
  OTHER: 'Otro',
};

function toInputDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatDate(value) {
  if (!value) return 'Sin límite';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sin límite';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getStatus(message) {
  const now = new Date();
  if (!message.active) return { label: 'Inactivo', className: 'admin-popup-status--inactive' };
  if (message.showFrom && new Date(message.showFrom) > now) return { label: 'Programado', className: 'admin-popup-status--scheduled' };
  if (message.showUntil && new Date(message.showUntil) < now) return { label: 'Vencido', className: 'admin-popup-status--expired' };
  return { label: 'Visible', className: 'admin-popup-status--active' };
}

export default function OperationsPopupMessages() {
  const [messages, setMessages] = useState([]);
  const [selectedId, setSelectedId] = useState('NEW');
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selected = useMemo(
    () => messages.find((m) => String(m.id) === String(selectedId)) || null,
    [messages, selectedId]
  );

  async function load() {
    setLoading(true);
    setError('');
    try {
      const { data } = await listAdminPopupMessages();
      setMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudieron cargar los mensajes emergentes.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (selectedId === 'NEW') {
      setForm(EMPTY_FORM);
      return;
    }
    if (selected) {
      setForm({
        title: selected.title || '',
        description: selected.description || '',
        portal: selected.portal || 'BOTH',
        category: selected.category || 'SYSTEM',
        active: Boolean(selected.active),
        showFrom: toInputDateTime(selected.showFrom),
        showUntil: toInputDateTime(selected.showUntil),
        showOnce: Boolean(selected.showOnce),
        requireConfirmation: Boolean(selected.requireConfirmation),
      });
    }
  }, [selected, selectedId]);

  function setField(name, value) {
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        ...form,
        showFrom: form.showFrom || null,
        showUntil: form.showUntil || null,
      };

      if (selectedId === 'NEW') {
        const { data } = await createPopupMessage(payload);
        setSuccess('Mensaje emergente creado correctamente.');
        await load();
        setSelectedId(String(data.id));
      } else {
        await updatePopupMessage(selectedId, payload);
        setSuccess('Mensaje emergente actualizado correctamente.');
        await load();
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo guardar el mensaje emergente.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!selected || !window.confirm('¿Eliminar este mensaje emergente?')) return;
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await deletePopupMessage(selected.id);
      setSuccess('Mensaje emergente eliminado correctamente.');
      setSelectedId('NEW');
      await load();
    } catch (err) {
      setError(err?.response?.data?.message || 'No se pudo eliminar el mensaje emergente.');
    } finally {
      setSaving(false);
    }
  }

  const status = selected ? getStatus(selected) : null;

  return (
    <div className="admin-popup-manager">
      <div className="admin-card admin-popup-selector-card">
        <div className="admin-popup-selector-row">
          <label className="admin-popup-field">
            <span>Mensaje emergente</span>
            <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="NEW">+ Crear nuevo mensaje</option>
              {messages.map((message) => (
                <option key={message.id} value={message.id}>
                  {message.title} · {PORTAL_LABELS[message.portal] || message.portal}
                </option>
              ))}
            </select>
          </label>
          <button type="button" className="pill-button" onClick={() => setSelectedId('NEW')}>
            Nuevo mensaje
          </button>
        </div>
        {loading ? <p className="admin-popup-muted">Cargando mensajes…</p> : null}
        {!loading ? <p className="admin-popup-muted">{messages.length} mensajes configurados</p> : null}
      </div>

      {error ? <div className="form-error">{error}</div> : null}
      {success ? <div className="form-success">{success}</div> : null}

      <form className="admin-card admin-popup-form-card" onSubmit={handleSubmit}>
        <div className="admin-popup-form-head">
          <div>
            <h3>{selectedId === 'NEW' ? 'Crear mensaje emergente' : 'Editar mensaje emergente'}</h3>
            <p>Definí dónde, cuándo y cómo debe mostrarse el pop-up.</p>
          </div>
          {status ? <span className={`admin-popup-status ${status.className}`}>{status.label}</span> : null}
        </div>

        <div className="admin-popup-grid">
          <label className="admin-popup-field admin-popup-field--full">
            <span>Título</span>
            <input value={form.title} onChange={(e) => setField('title', e.target.value)} required maxLength={140} />
          </label>

          <label className="admin-popup-field admin-popup-field--full">
            <span>Descripción</span>
            <textarea value={form.description} onChange={(e) => setField('description', e.target.value)} required rows={7} />
          </label>

          <label className="admin-popup-field">
            <span>Portal</span>
            <select value={form.portal} onChange={(e) => setField('portal', e.target.value)}>
              <option value="BOTH">Ambos portales</option>
              <option value="CLIENT">Cliente</option>
              <option value="ADMIN">Administrador</option>
            </select>
          </label>

          <label className="admin-popup-field">
            <span>Categoría</span>
            <select value={form.category} onChange={(e) => setField('category', e.target.value)}>
              <option value="SYSTEM">Sistema</option>
              <option value="RELEASE">Novedades / versión</option>
              <option value="COMMERCIAL">Comercial</option>
              <option value="SOCIAL">Social</option>
              <option value="OTHER">Otro</option>
            </select>
          </label>

          <label className="admin-popup-field">
            <span>Mostrar desde</span>
            <input type="datetime-local" value={form.showFrom} onChange={(e) => setField('showFrom', e.target.value)} />
          </label>

          <label className="admin-popup-field">
            <span>Mostrar hasta</span>
            <input type="datetime-local" value={form.showUntil} onChange={(e) => setField('showUntil', e.target.value)} />
          </label>
        </div>

        <div className="admin-popup-options">
          <label>
            <input type="checkbox" checked={form.active} onChange={(e) => setField('active', e.target.checked)} />
            Activo
          </label>
          <label>
            <input type="checkbox" checked={form.showOnce} onChange={(e) => setField('showOnce', e.target.checked)} />
            Mostrar una sola vez por usuario
          </label>
          <label>
            <input type="checkbox" checked={form.requireConfirmation} onChange={(e) => setField('requireConfirmation', e.target.checked)} />
            Requiere confirmación “Entendido”
          </label>
        </div>

        {selected ? (
          <div className="admin-popup-preview">
            <strong>Resumen</strong>
            <p>
              {CATEGORY_LABELS[selected.category] || selected.category} · {PORTAL_LABELS[selected.portal] || selected.portal} · desde{' '}
              {formatDate(selected.showFrom)} · hasta {formatDate(selected.showUntil)}
            </p>
            <p>{selected.reads?.length ? `${selected.reads.length} últimas lecturas registradas` : 'Sin lecturas registradas aún.'}</p>
          </div>
        ) : null}

        <div className="admin-popup-actions">
          {selected ? (
            <button type="button" className="pill-button-outline" onClick={handleDelete} disabled={saving}>
              Eliminar
            </button>
          ) : null}
          <button type="submit" className="pill-button" disabled={saving}>
            {saving ? 'Guardando…' : selectedId === 'NEW' ? 'Crear mensaje' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
