import { useState } from 'react';
import api from '../../api/axiosClient';
import AlertBanner from './OperationsAlertBanner';

export default function OperationsUserBatchImport() {
  const [batchFile, setBatchFile] = useState(null);
  const [batchPreview, setBatchPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingExecute, setLoadingExecute] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [onExistingEmail, setOnExistingEmail] = useState('ERROR');

  const readFileAsText = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(reader.error || new Error('Error leyendo archivo'));
      reader.readAsText(file);
    });

  const loadPreview = async () => {
    setError(null);
    setMessage(null);
    setResult(null);

    if (!batchFile) {
      setError('Seleccioná un archivo .csv o .txt');
      return;
    }

    setLoadingPreview(true);
    try {
      const content = await readFileAsText(batchFile);
      const res = await api.post('/admin/operations/users-batch/preview', {
        fileName: batchFile.name,
        content,
      });
      setBatchPreview(res.data);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error generando preview');
    } finally {
      setLoadingPreview(false);
    }
  };

  const execute = async () => {
    if (!batchPreview?.validRows?.length) {
      setError('No hay registros válidos para procesar.');
      return;
    }

    setError(null);
    setMessage(null);
    setLoadingExecute(true);
    try {
      const res = await api.post('/admin/operations/users-batch/execute', {
        fileMeta: batchPreview.fileMeta,
        validRows: batchPreview.validRows,
        options: { onExistingEmail },
      });
      setResult(res.data);
      setMessage(
        `Proceso finalizado. OK: ${res.data?.summary?.created ?? 0} | Errores: ${res.data?.summary?.errors ?? 0} | Skip: ${
          res.data?.summary?.skipped ?? 0
        }`
      );
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error ejecutando alta masiva');
    } finally {
      setLoadingExecute(false);
    }
  };

  const downloadCsv = (rows, fileName) => {
    if (!Array.isArray(rows) || rows.length === 0) return;

    const headers = Array.isArray(batchPreview?.fileMeta?.headers) ? batchPreview.fileMeta.headers : null;
    const baseHeaders = headers && headers.length ? headers : Object.keys(rows[0]?.raw || {});
    const allHeaders = [...baseHeaders, 'observacion'];

    const escapeCsv = (v) => {
      const s = String(v ?? '');
      if (s.includes('"') || s.includes(',') || s.includes(';') || s.includes('\n')) {
        return `"${s.replace(/"/g, '""')}"`;
      }
      return s;
    };

    const sep = ';';
    const lines = [];
    lines.push(allHeaders.join(sep));

    for (const r of rows) {
      const raw = r.raw || {};
      const line = allHeaders
        .map((h) => (h === 'observacion' ? escapeCsv(r.observacion || '') : escapeCsv(raw[h] ?? '')))
        .join(sep);
      lines.push(line);
    }

    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>Alta masiva de usuarios</h2>
      <p style={{ marginTop: 6, color: '#6b7280' }}>
        Importá CSV/TXT, generá preview, creá usuarios y enviá activación.
      </p>

      <AlertBanner error={error} message={message} />

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 220px auto auto', gap: '0.75rem', alignItems: 'end' }}>
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Archivo</label>
          <input
            type="file"
            accept=".csv,.txt"
            onChange={(e) => {
              setBatchFile(e.target.files?.[0] || null);
              setBatchPreview(null);
              setResult(null);
            }}
          />
          {batchFile && <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 6 }}>{batchFile.name}</div>}
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Si el email ya existe</label>
          <select
            value={onExistingEmail}
            onChange={(e) => setOnExistingEmail(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
          >
            <option value="ERROR">Marcar error</option>
            <option value="SKIP">Skip (no crear)</option>
          </select>
        </div>

        <button
          type="button"
          onClick={loadPreview}
          disabled={loadingPreview || loadingExecute}
          style={{ padding: '0.6rem 0.9rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer', height: 40 }}
        >
          {loadingPreview ? 'Procesando...' : 'Preview'}
        </button>

        <button
          type="button"
          onClick={execute}
          disabled={loadingExecute || loadingPreview || !batchPreview?.validRows?.length}
          style={{
            padding: '0.6rem 0.9rem',
            borderRadius: '0.6rem',
            border: '1px solid #e5e7eb',
            cursor: loadingExecute || loadingPreview || !batchPreview?.validRows?.length ? 'not-allowed' : 'pointer',
            background: '#33576f',
            color: 'white',
            height: 40,
            opacity: loadingExecute || loadingPreview || !batchPreview?.validRows?.length ? 0.65 : 1,
          }}
        >
          {loadingExecute ? 'Ejecutando...' : 'Crear usuarios'}
        </button>
      </div>

      {batchPreview && (
        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
            <div>
              <strong>Total:</strong> {batchPreview.fileMeta?.total ?? 0}
            </div>
            <div>
              <strong>Válidos:</strong> {batchPreview.validRows?.length ?? 0}
            </div>
            <div>
              <strong>Con error:</strong> {batchPreview.invalidRows?.length ?? 0}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Preview válidos (muestra 20)</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.35rem' }}>#</th>
                      <th style={{ padding: '0.35rem' }}>Nombre</th>
                      <th style={{ padding: '0.35rem' }}>Apellido</th>
                      <th style={{ padding: '0.35rem' }}>Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batchPreview.validRows || []).slice(0, 20).map((r) => (
                      <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.35rem' }}>{r.rowNumber}</td>
                        <td style={{ padding: '0.35rem' }}>{r.normalized?.name}</td>
                        <td style={{ padding: '0.35rem' }}>{r.normalized?.lastName}</td>
                        <td style={{ padding: '0.35rem' }}>{r.normalized?.email}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.75rem', padding: '0.75rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: 8 }}>Con inconsistencias (muestra 20)</h3>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                      <th style={{ padding: '0.35rem' }}>#</th>
                      <th style={{ padding: '0.35rem' }}>Email</th>
                      <th style={{ padding: '0.35rem' }}>Errores</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(batchPreview.invalidRows || []).slice(0, 20).map((r) => (
                      <tr key={r.rowNumber} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '0.35rem' }}>{r.rowNumber}</td>
                        <td style={{ padding: '0.35rem' }}>{r.normalized?.email || ''}</td>
                        <td style={{ padding: '0.35rem' }}>{(r.errors || []).join('; ')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {result && (
        <div style={{ marginTop: '1rem', borderTop: '1px solid #e5e7eb', paddingTop: '1rem' }}>
          <h3 style={{ marginTop: 0 }}>Resultados</h3>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => downloadCsv(result.successRows, 'usuarios_batch_exitosos.csv')}
              style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
            >
              Descargar OK
            </button>
            <button
              type="button"
              onClick={() => downloadCsv(result.errorRows, 'usuarios_batch_errores.csv')}
              style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
            >
              Descargar Errores
            </button>
          </div>
          <div style={{ marginTop: 8, color: '#6b7280', fontSize: '0.9rem' }}>
            ID corrida: <strong>{result.processRunId}</strong>
          </div>
        </div>
      )}
    </div>
  );
}
