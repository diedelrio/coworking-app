import { useEffect, useMemo, useState } from 'react';
import { FiDownload, FiFileText, FiPlus, FiRefreshCw, FiSave, FiShield } from 'react-icons/fi';
import api from '../api/axiosClient';
import Layout from '../components/Layout';

const CONSENT_TYPES = [
  { value: 'TERMS_AND_POLICIES', label: 'Términos y políticas' },
  { value: 'COMMERCIAL_COMMUNICATIONS', label: 'Comunicaciones comerciales' },
  { value: 'SOCIAL_COMMUNICATIONS', label: 'Comunicaciones sociales' },
  { value: 'OTHER', label: 'Otro' },
];

function emptyForm() {
  return {
    id: null,
    key: '',
    title: '',
    type: 'TERMS_AND_POLICIES',
    version: 'v1.0',
    description: '',
    active: true,
    required: true,
    requiresAcceptance: true,
    showDocumentsToUser: true,
    allowUserDownloadDocuments: true,
    defaultAcceptedForNonAdmins: false,
    documents: [],
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || '').split(',')[1] || '');
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function typeLabel(type) {
  return CONSENT_TYPES.find((x) => x.value === type)?.label || type;
}

export default function AdminConsents() {
  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState('NEW');
  const [form, setForm] = useState(emptyForm());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const selected = useMemo(() => items.find((x) => String(x.id) === String(selectedId)) || null, [items, selectedId]);

  useEffect(() => { fetchItems(); }, []);

  useEffect(() => {
    if (selectedId === 'NEW') {
      setForm(emptyForm());
      return;
    }
    if (!selected) return;
    setForm({
      id: selected.id,
      key: selected.key || '',
      title: selected.title || '',
      type: selected.type || 'OTHER',
      version: selected.version || '',
      description: selected.description || '',
      active: Boolean(selected.active),
      required: Boolean(selected.required),
      requiresAcceptance: selected.requiresAcceptance !== false,
      showDocumentsToUser: selected.showDocumentsToUser !== false,
      allowUserDownloadDocuments: selected.allowUserDownloadDocuments !== false,
      defaultAcceptedForNonAdmins: Boolean(selected.defaultAcceptedForNonAdmins),
      documents: (selected.documents || []).map((doc) => ({
        ...doc,
        existing: true,
        contentBase64: '',
      })),
    });
  }, [selectedId, selected]);

  async function fetchItems() {
    try {
      setLoading(true);
      setError('');
      const { data } = await api.get('/admin/consents');
      setItems(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudieron cargar los consentimientos.');
    } finally {
      setLoading(false);
    }
  }

  function setField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function onFilesSelected(event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    const mapped = [];
    for (const file of files) {
      const contentBase64 = await fileToBase64(file);
      mapped.push({
        title: file.name.replace(/\.[^.]+$/, ''),
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        contentBase64,
        active: true,
        downloadEnabled: true,
      });
    }
    setForm((prev) => ({ ...prev, documents: [...prev.documents, ...mapped] }));
    event.target.value = '';
  }

  function removeDocument(index) {
    setForm((prev) => ({ ...prev, documents: prev.documents.filter((_, i) => i !== index) }));
  }

  function updateDocument(index, field, value) {
    setForm((prev) => ({
      ...prev,
      documents: prev.documents.map((doc, i) => (i === index ? { ...doc, [field]: value } : doc)),
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      if (!form.title.trim() || !form.version.trim()) {
        setError('Completá título y versión.');
        return;
      }

      const payload = {
        ...form,
        documents: form.documents.filter((doc) => doc.contentBase64),
      };

      const { data } = form.id
        ? await api.put(`/admin/consents/${form.id}`, payload)
        : await api.post('/admin/consents', payload);

      setNotice('Consentimiento guardado correctamente.');
      await fetchItems();
      setSelectedId(String(data.id));
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo guardar el consentimiento.');
    } finally {
      setSaving(false);
    }
  }

  function downloadDoc(doc) {
    window.open(`${api.defaults.baseURL}/consents/documents/${doc.id}/download`, '_blank', 'noopener,noreferrer');
  }

  return (
    <Layout>
      <div className="admin-page admin-consents-page">
        <section className="admin-consents-hero">
          <div>
            <p className="admin-crm-eyebrow">Legal y comunicaciones</p>
            <h1>Consentimientos</h1>
            <p>Administra términos, políticas y permisos de comunicación que luego debe aceptar cada usuario.</p>
          </div>
          <button className="admin-crm-primary" type="button" onClick={() => setSelectedId('NEW')}>
            <FiPlus /> Nuevo consentimiento
          </button>
        </section>

        {error ? <div className="admin-crm-message admin-crm-message--error">{error}</div> : null}
        {notice ? <div className="admin-crm-message admin-crm-message--success">{notice}</div> : null}

        <section className="admin-card admin-consents-selector-card">
          <label className="settings-label">Consentimiento</label>
          <select className="settings-input" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
            <option value="NEW">Crear nuevo consentimiento…</option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>{item.title} · {item.version} {item.active ? '' : '(inactivo)'}</option>
            ))}
          </select>
          <button className="admin-crm-secondary" type="button" onClick={fetchItems} disabled={loading}>
            <FiRefreshCw /> {loading ? 'Cargando…' : 'Recargar'}
          </button>
        </section>

        <section className="admin-card admin-consents-form-card">
          <div className="admin-consents-form-head">
            <div className="admin-user-form-icon"><FiShield /></div>
            <div>
              <h2>{form.id ? form.title || 'Editar consentimiento' : 'Nuevo consentimiento'}</h2>
              <p>Define versión, obligatoriedad, documentos descargables y estado.</p>
            </div>
          </div>

          <div className="admin-user-form-grid admin-user-form-grid--three">
            <label>Título *<input value={form.title} onChange={(e) => setField('title', e.target.value)} placeholder="Términos y condiciones" /></label>
            <label>Key<input value={form.key} onChange={(e) => setField('key', e.target.value)} placeholder="TERMS_AND_CONDITIONS" /></label>
            <label>Versión *<input value={form.version} onChange={(e) => setField('version', e.target.value)} placeholder="v1.0" /></label>
            <label>Tipo<select value={form.type} onChange={(e) => setField('type', e.target.value)}>{CONSENT_TYPES.map((x) => <option key={x.value} value={x.value}>{x.label}</option>)}</select></label>
            <label>Estado<select value={form.active ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setField('active', e.target.value === 'ACTIVE')}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
            <label>Obligatorio<select value={form.required ? 'YES' : 'NO'} onChange={(e) => setField('required', e.target.value === 'YES')}><option value="YES">Sí</option><option value="NO">No</option></select></label>
          </div>

          <label className="admin-consents-description">Descripción<textarea value={form.description} onChange={(e) => setField('description', e.target.value)} placeholder="Texto visible para el usuario…" /></label>

          <div className="admin-consents-switch-grid">
            <label><input type="checkbox" checked={form.requiresAcceptance} onChange={(e) => setField('requiresAcceptance', e.target.checked)} /> Requiere aceptación explícita</label>
            <label><input type="checkbox" checked={form.showDocumentsToUser} onChange={(e) => setField('showDocumentsToUser', e.target.checked)} /> Mostrar documentos al usuario</label>
            <label><input type="checkbox" checked={form.allowUserDownloadDocuments} onChange={(e) => setField('allowUserDownloadDocuments', e.target.checked)} /> Permitir descarga</label>
            <label><input type="checkbox" checked={form.defaultAcceptedForNonAdmins} onChange={(e) => setField('defaultAcceptedForNonAdmins', e.target.checked)} /> Aceptado por defecto para usuarios no administradores</label>
          </div>

          {form.defaultAcceptedForNonAdmins ? (
            <div className="admin-consents-default-notice">
              Al guardar, los usuarios no administradores activos quedarán marcados como aceptados para esta versión.
              Si luego un usuario no desea mantenerlo, podrá desmarcarlo desde su perfil cuando el consentimiento no sea obligatorio.
            </div>
          ) : null}

          <div className="admin-consents-documents">
            <div className="admin-consents-documents-head">
              <div>
                <h3>Documentos asociados</h3>
                <p>Podés adjuntar uno o más PDFs/documentos. Para términos, adjunta TyC, cookies y datos sensibles.</p>
              </div>
              <label className="admin-crm-secondary admin-consents-file-button">
                <FiFileText /> Adjuntar
                <input type="file" multiple onChange={onFilesSelected} style={{ display: 'none' }} />
              </label>
            </div>

            {form.documents.length === 0 ? (
              <div className="admin-dashboard-v2__empty-state"><strong>No hay documentos adjuntos</strong><p>Adjunta documentos si deben mostrarse o descargarse por el usuario.</p></div>
            ) : (
              <div className="admin-consents-document-list">
                {form.documents.map((doc, index) => (
                  <div className="admin-consents-document-row" key={`${doc.fileName}-${index}`}>
                    <input value={doc.title || ''} onChange={(e) => updateDocument(index, 'title', e.target.value)} placeholder="Título visible" />
                    <span>{doc.fileName}</span>
                    <label><input type="checkbox" checked={doc.downloadEnabled !== false} onChange={(e) => updateDocument(index, 'downloadEnabled', e.target.checked)} /> Descarga</label>
                    {doc.existing && doc.id ? <button type="button" className="admin-crm-secondary" onClick={() => downloadDoc(doc)}><FiDownload /></button> : null}
                    <button type="button" className="admin-crm-danger-soft" onClick={() => removeDocument(index)}>Quitar</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="admin-user-form-footer">
            <button type="button" className="admin-crm-secondary" onClick={() => setSelectedId('NEW')}>Cancelar</button>
            <button type="button" className="admin-crm-primary" onClick={save} disabled={saving}><FiSave /> {saving ? 'Guardando…' : 'Guardar'}</button>
          </div>
        </section>

        <section className="admin-card admin-consents-list-card">
          <h2>Consentimientos configurados</h2>
          <div className="admin-consents-list">
            {items.map((item) => (
              <button key={item.id} type="button" className="admin-consents-list-item" onClick={() => setSelectedId(String(item.id))}>
                <strong>{item.title}</strong>
                <span>{typeLabel(item.type)} · {item.version} · {item.active ? 'Activo' : 'Inactivo'}</span>
                <small>{item.documents?.length || 0} documento(s){item.defaultAcceptedForNonAdmins ? ' · default aceptado' : ''}</small>
              </button>
            ))}
          </div>
        </section>
      </div>
    </Layout>
  );
}
