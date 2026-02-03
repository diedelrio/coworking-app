import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axiosClient';
import AlertBanner from './OperationsAlertBanner';

const CLASSIFY_OPTIONS = [
  { value: 'GOOD', label: 'GOOD' },
  { value: 'REGULAR', label: 'REGULAR' },
  { value: 'BAD', label: 'BAD' },
];

export default function OperationsBulkEmail() {
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [loadingRun, setLoadingRun] = useState(false);

  const [templates, setTemplates] = useState([]);
  const [tags, setTags] = useState([]);

  const [templateKey, setTemplateKey] = useState('');
  const [audienceType, setAudienceType] = useState('CLIENT');
  const [classify, setClassify] = useState('GOOD');
  const [tagSlug, setTagSlug] = useState('');

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [processRun, setProcessRun] = useState(null);

  const canRun = useMemo(() => {
    if (!templateKey) return false;
    if (audienceType === 'TAG' && !tagSlug) return false;
    if (audienceType === 'CLASSIFY' && !classify) return false;
    return true;
  }, [templateKey, audienceType, tagSlug, classify]);

  const loadMeta = async () => {
    setLoadingMeta(true);
    setError(null);
    try {
      const [tplRes, tagRes] = await Promise.all([
        api.get('/admin/operations/email-templates'),
        api.get('/admin/operations/tags'),
      ]);
      setTemplates(tplRes.data?.templates || []);
      setTags(tagRes.data?.tags || []);
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Error cargando metadatos');
    } finally {
      setLoadingMeta(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const execute = async () => {
    setError(null);
    setMessage(null);
    setProcessRun(null);

    if (!canRun) {
      setError('Completá template y segmento');
      return;
    }

    setLoadingRun(true);
    try {
      const audience =
        audienceType === 'CLIENT'
          ? { type: 'CLIENT' }
          : audienceType === 'CLASSIFY'
          ? { type: 'CLASSIFY', classify }
          : { type: 'TAG', tagSlug };

      const res = await api.post('/admin/operations/bulk-email/execute', {
        templateKey,
        audience,
      });

      setProcessRun(res.data?.processRun || null);
      setMessage('Proceso ejecutado');
    } catch (e) {
      setError(e?.response?.data?.message || e.message || 'Error ejecutando');
    } finally {
      setLoadingRun(false);
    }
  };

  return (
    <div>
      <h2 style={{ marginTop: 0 }}>Envío masivo de emails</h2>
      <p style={{ marginTop: 0, color: '#6b7280' }}>
        Envía un template por <b>key</b> a un segmento de usuarios (clientes, por clasificación o por tag).
      </p>

      <AlertBanner error={error} message={message} />

      <div style={{ display: 'grid', gap: '0.75rem', maxWidth: 720 }}>
        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Template</label>
          <select
            value={templateKey}
            onChange={(e) => setTemplateKey(e.target.value)}
            disabled={loadingMeta}
            style={{ padding: '0.6rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}
          >
            <option value="">Seleccionar…</option>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.key} — {t.name}
              </option>
            ))}
          </select>
          {loadingMeta && <span style={{ color: '#6b7280', fontSize: '0.85rem' }}>Cargando templates/tags…</span>}
        </div>

        <div style={{ display: 'grid', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.9rem' }}>Segmento</label>
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setAudienceType('CLIENT')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                background: audienceType === 'CLIENT' ? '#111827' : 'white',
                color: audienceType === 'CLIENT' ? 'white' : '#111827',
              }}
            >
              Clientes
            </button>
            <button
              type="button"
              onClick={() => setAudienceType('CLASSIFY')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                background: audienceType === 'CLASSIFY' ? '#111827' : 'white',
                color: audienceType === 'CLASSIFY' ? 'white' : '#111827',
              }}
            >
              Clasificación
            </button>
            <button
              type="button"
              onClick={() => setAudienceType('TAG')}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                background: audienceType === 'TAG' ? '#111827' : 'white',
                color: audienceType === 'TAG' ? 'white' : '#111827',
              }}
            >
              Tag
            </button>
          </div>

          {audienceType === 'CLASSIFY' && (
            <select
              value={classify}
              onChange={(e) => setClassify(e.target.value)}
              style={{ padding: '0.6rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}
            >
              {CLASSIFY_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          )}

          {audienceType === 'TAG' && (
            <select
              value={tagSlug}
              onChange={(e) => setTagSlug(e.target.value)}
              disabled={loadingMeta}
              style={{ padding: '0.6rem', borderRadius: '0.75rem', border: '1px solid #e5e7eb' }}
            >
              <option value="">Seleccionar tag…</option>
              {tags.map((t) => (
                <option key={t.slug} value={t.slug}>
                  {t.slug} — {t.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <button
          type="button"
          onClick={execute}
          disabled={!canRun || loadingRun}
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.9rem',
            border: '1px solid #111827',
            background: !canRun || loadingRun ? '#9ca3af' : '#111827',
            color: 'white',
            cursor: !canRun || loadingRun ? 'not-allowed' : 'pointer',
          }}
        >
          {loadingRun ? 'Ejecutando…' : 'Enviar emails'}
        </button>

        {processRun && (
          <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '0.75rem' }}>
            <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>Resultado</div>
            <div style={{ color: '#374151' }}>
              <div>
                <b>Status:</b> {processRun.status}
              </div>
              <div>
                <b>Total:</b> {processRun.totalRecords} — <b>OK:</b> {processRun.successRecords} — <b>Error:</b>{' '}
                {processRun.errorRecords}
              </div>
              <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
                Ejecutado: {processRun.executedAt ? new Date(processRun.executedAt).toLocaleString() : ''}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
