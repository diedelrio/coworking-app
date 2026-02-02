import { useEffect, useMemo, useState } from 'react';
import api from '../../api/axiosClient';
import AlertBanner from './OperationsAlertBanner';

const pad2 = (n) => String(n).padStart(2, '0');
const toYMD = (d) => {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return '';
  return `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
};

const todayYMD = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return toYMD(d);
};

export default function OperationsOfficeClosures() {
  const [from, setFrom] = useState(() => todayYMD());
  const [to, setTo] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 60);
    d.setHours(0, 0, 0, 0);
    return toYMD(d);
  });
  const [q, setQ] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  // create/edit form
  const [mode, setMode] = useState('create'); // create | edit
  const [editId, setEditId] = useState(null);
  const [startDate, setStartDate] = useState(() => todayYMD());
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [active, setActive] = useState(true);

  const hasRange = useMemo(() => !!endDate, [endDate]);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/office-closures', {
        params: {
          from: from || undefined,
          to: to || undefined,
          includeInactive: includeInactive ? 'true' : 'false',
          q: q || undefined,
        },
      });
      setRows(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error cargando cierres');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resetForm = () => {
    setMode('create');
    setEditId(null);
    setStartDate(todayYMD());
    setEndDate('');
    setReason('');
    setActive(true);
  };

  const startEdit = (r) => {
    setMode('edit');
    setEditId(r.id);
    setStartDate(toYMD(r.date));
    setEndDate('');
    setReason(r.reason || '');
    setActive(r.active !== false);
    setMessage(null);
    setError(null);
  };

  const submitCreate = async (e) => {
    e?.preventDefault?.();
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      if (!startDate) {
        setError('Seleccioná una fecha de inicio');
        return;
      }

      const body = {
        reason,
      };

      if (hasRange) {
        body.startDate = startDate;
        body.endDate = endDate;
      } else {
        body.date = startDate;
      }

      const res = await api.post('/office-closures', body);
      const created = res.data?.created ?? 0;
      const errs = Array.isArray(res.data?.errors) ? res.data.errors : [];

      if (errs.length) {
        setMessage(`Cierres creados: ${created}. Hubo ${errs.length} errores (ver consola).`);
        console.warn('office-closures create errors', errs);
      } else {
        setMessage(hasRange ? `Cierres creados/actualizados: ${created}` : 'Cierre creado/actualizado');
      }

      resetForm();
      await load();
    } catch (e2) {
      console.error(e2);
      setError(e2?.response?.data?.message || e2?.message || 'Error guardando cierre');
    } finally {
      setSaving(false);
    }
  };

  const submitEdit = async (e) => {
    e?.preventDefault?.();
    if (!editId) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const res = await api.put(`/office-closures/${editId}`, {
        date: startDate,
        reason,
        active,
      });
      setMessage(`Cierre actualizado (#${res.data?.id || editId})`);
      resetForm();
      await load();
    } catch (e2) {
      console.error(e2);
      setError(e2?.response?.data?.message || e2?.message || 'Error actualizando cierre');
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id) => {
    if (!window.confirm('¿Desactivar este cierre?')) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.delete(`/office-closures/${id}`);
      setMessage('Cierre desactivado');
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error desactivando');
    } finally {
      setSaving(false);
    }
  };

  const reactivate = async (r) => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      await api.put(`/office-closures/${r.id}`, {
        active: true,
      });
      setMessage('Cierre reactivado');
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || e?.message || 'Error reactivando');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: '1rem', padding: '1rem' }}>
      <h2 style={{ marginTop: 0 }}>Cierres del coworking</h2>
      <p style={{ marginTop: 6, color: '#6b7280' }}>
        Gestioná cierres/feriados. Afecta disponibilidad y validación de reservas.
      </p>

      <AlertBanner error={error} message={message} />

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: '0.75rem',
          alignItems: 'end',
          marginBottom: '1rem',
        }}
      >
        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
          />
        </div>

        <div>
          <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Buscar (motivo)</label>
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ej: feriado, mantenimiento"
            style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
          />
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', justifyContent: 'space-between' }}>
          <label style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', fontSize: '0.9rem', color: '#111827' }}>
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
            Ver inactivos
          </label>
          <button
            type="button"
            onClick={load}
            disabled={loading || saving}
            style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
          >
            {loading ? 'Cargando...' : 'Buscar'}
          </button>
        </div>
      </div>

      {/* Form */}
      <div style={{ border: '1px solid #e5e7eb', borderRadius: '0.9rem', padding: '0.75rem', marginBottom: '1rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <strong>{mode === 'create' ? 'Crear cierres' : `Editar cierre #${editId}`}</strong>
            <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: 4 }}>
              {mode === 'create'
                ? 'Podés crear un día o un rango (inclusive). Si una fecha ya existía como inactiva, se reactiva.'
                : 'Editá fecha, motivo o estado.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {mode === 'edit' && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{ padding: '0.55rem 0.85rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
              >
                Cancelar
              </button>
            )}
          </div>
        </div>

        <form onSubmit={mode === 'create' ? submitCreate : submitEdit} style={{ marginTop: '0.75rem' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: mode === 'create' ? 'repeat(3, minmax(0, 1fr))' : 'repeat(3, minmax(0, 1fr))',
              gap: '0.75rem',
              alignItems: 'end',
            }}
          >
            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                {mode === 'create' ? 'Fecha inicio' : 'Fecha'}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                required
              />
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>
                {mode === 'create' ? 'Fecha fin (opcional)' : 'Estado'}
              </label>

              {mode === 'create' ? (
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  min={startDate || undefined}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                />
              ) : (
                <select
                  value={active ? 'true' : 'false'}
                  onChange={(e) => setActive(e.target.value === 'true')}
                  style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
                >
                  <option value="true">Activo</option>
                  <option value="false">Inactivo</option>
                </select>
              )}
            </div>

            <div>
              <label style={{ display: 'block', marginBottom: '0.25rem', fontSize: '0.9rem' }}>Motivo</label>
              <input
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: feriado, mantenimiento"
                style={{ width: '100%', padding: '0.5rem', borderRadius: '0.5rem', border: '1px solid #e5e7eb' }}
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem' }}>
            <button
              type="submit"
              disabled={saving}
              style={{
                padding: '0.6rem 0.9rem',
                borderRadius: '0.6rem',
                border: '1px solid #e5e7eb',
                cursor: 'pointer',
                background: '#33576f',
                color: 'white',
                opacity: saving ? 0.7 : 1,
              }}
            >
              {saving ? 'Guardando...' : mode === 'create' ? 'Crear cierres' : 'Guardar cambios'}
            </button>

            {mode === 'create' && (
              <button
                type="button"
                onClick={resetForm}
                disabled={saving}
                style={{ padding: '0.6rem 0.9rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
              >
                Limpiar
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '0.5rem' }}>Fecha</th>
              <th style={{ padding: '0.5rem' }}>Motivo</th>
              <th style={{ padding: '0.5rem' }}>Estado</th>
              <th style={{ padding: '0.5rem' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.5rem' }}>{toYMD(r.date)}</td>
                <td style={{ padding: '0.5rem' }}>{r.reason || <span style={{ color: '#6b7280' }}>—</span>}</td>
                <td style={{ padding: '0.5rem' }}>
                  {r.active ? (
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.6rem', border: '1px solid #bbf7d0', background: '#f0fdf4', color: '#166534' }}>
                      Activo
                    </span>
                  ) : (
                    <span style={{ padding: '0.2rem 0.5rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', background: '#f9fafb', color: '#6b7280' }}>
                      Inactivo
                    </span>
                  )}
                </td>
                <td style={{ padding: '0.5rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    disabled={saving}
                    style={{ padding: '0.45rem 0.7rem', borderRadius: '0.6rem', border: '1px solid #e5e7eb', cursor: 'pointer' }}
                  >
                    Editar
                  </button>

                  {r.active ? (
                    <button
                      type="button"
                      onClick={() => deactivate(r.id)}
                      disabled={saving}
                      style={{ padding: '0.45rem 0.7rem', borderRadius: '0.6rem', border: '1px solid #fecaca', background: '#fef2f2', cursor: 'pointer' }}
                    >
                      Desactivar
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => reactivate(r)}
                      disabled={saving}
                      style={{ padding: '0.45rem 0.7rem', borderRadius: '0.6rem', border: '1px solid #bbf7d0', background: '#f0fdf4', cursor: 'pointer' }}
                    >
                      Reactivar
                    </button>
                  )}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={4} style={{ padding: '0.75rem', color: '#6b7280' }}>
                  {loading ? 'Cargando...' : 'No hay cierres para mostrar.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
