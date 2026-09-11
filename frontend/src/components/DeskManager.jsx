import { useEffect, useState } from 'react';
import api from '../api/axiosClient';
import './desks.css';
function displayDate(value, inclusiveEnd = false) {
  if (!value) return 'Sin fecha final';
  return new Date(new Date(value).getTime() - (inclusiveEnd ? 1 : 0)).toLocaleDateString('es-ES', { timeZone: 'Europe/Madrid' });
}
export default function DeskManager({ space, onClose, onChanged }) {
  const [desks, setDesks] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true);
    api.get('/spaces/' + space.id + '/desks').then(r => { if (alive) setDesks(r.data); }).catch(e => { if (alive) setError(e.response?.data?.message || 'No se pudieron cargar las mesas.'); }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [space.id, reload]);
  async function mutate(action) {
    setBusy(true); setError('');
    try { await action(); setReload(n => n+1); await onChanged(); }
    catch(e) { setError(e.response?.data?.message || 'No se pudo guardar el cambio.'); }
    finally { setBusy(false); }
  }
  return <div className="settings-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="desk-manager-title">
    <div className="settings-modal desk-manager">
      <div className="settings-modal-header"><h2 id="desk-manager-title">Mesas · {space.name}</h2><button type="button" onClick={onClose} disabled={busy}>Cerrar</button></div>
      <div className="settings-modal-body">
        <p>Cada mesa corresponde a una persona. Las asignaciones fijas bloquean el puesto todo el día durante el período indicado, incluida la fecha final.</p>
        <p>Para añadir mesas, aumentá la capacidad al editar el espacio. Deshabilitar una mesa reduce su capacidad.</p>
        {error && <p role="alert" className="desk-error">{error}</p>}
        {loading && <p role="status">Cargando mesas…</p>}
        {!loading && desks.map(d => <div className="desk-manager-row" key={d.id}>
          <div className="desk-manager-actions"><strong>Mesa {d.number} · {d.active ? 'Habilitada' : 'Deshabilitada'}</strong>
            <button type="button" disabled={busy} onClick={() => mutate(() => api.put('/spaces/' + space.id + '/desks/' + d.id, {active: !d.active}))}>{d.active ? 'Deshabilitar' : 'Habilitar'}</button>
          </div>
          <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); mutate(() => api.put('/spaces/' + space.id + '/desks/' + d.id, {number: Number(form.get('number'))})); }}>
            <label>Número de mesa<input aria-label={'Número de mesa ' + d.number} name="number" type="number" min="1" defaultValue={d.number} required disabled={busy}/></label><button disabled={busy}>Cambiar número</button>
          </form>
          {d.fixedAssignments.map(a => <div key={a.id} className="desk-manager-actions"><p><strong>{a.occupantName}</strong> · {displayDate(a.startTime)} — {displayDate(a.endTime,true)}</p><button type="button" disabled={busy} onClick={() => mutate(() => api.delete('/spaces/' + space.id + '/desks/' + d.id + '/fixed/' + a.id))}>Quitar asignación fija</button></div>)}
          {d.active && <form onSubmit={e => { e.preventDefault(); const form = new FormData(e.currentTarget); mutate(() => api.post('/spaces/' + space.id + '/desks/' + d.id + '/fixed', Object.fromEntries(form))); }}>
            <label>Ocupante fijo<input name="occupantName" required maxLength="200" disabled={busy}/></label>
            <label>Desde<input name="startDate" type="date" required disabled={busy}/></label>
            <label>Hasta (opcional)<input name="endDate" type="date" disabled={busy}/></label>
            <button disabled={busy}>Asignar puesto fijo</button>
          </form>}
        </div>)}
      </div>
    </div>
  </div>;
}
