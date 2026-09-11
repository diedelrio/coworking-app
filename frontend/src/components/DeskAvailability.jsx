import { useEffect, useState } from 'react';
import api from '../api/axiosClient';
import './desks.css';

export default function DeskAvailability({ space, date, startTime, endTime, attendees, editId, admin = false, deskIds, onSelection, readOnly, assignedDesks, onAvailability, refreshKey, recurring }) {
  const [result, setResult] = useState(null);
  const [failure, setFailure] = useState(null);
  const [retry, setRetry] = useState(0);
  const key = [space?.id, date, startTime, endTime, editId, refreshKey, retry].join('|');
  useEffect(() => {
    if (!space?.numberedDesks || readOnly) return;
    let disposed = false;
    let controller;
    const load = async () => {
      controller?.abort();
      controller = new AbortController();
      if (!date || !startTime || !endTime || endTime <= startTime) {
        setResult(null); onAvailability(null); return;
      }
      try {
        const response = await api.get('/spaces/' + space.id + '/desks/availability', {
          params: { date, startTime, endTime, ...(editId ? { excludeReservationId: editId } : {}) }, signal: controller.signal,
        });
        if (disposed) return;
        setResult({ key, data: response.data }); setFailure(null); onAvailability({ key, ...response.data });
      } catch (e) {
        if (disposed || e.code === 'ERR_CANCELED') return;
        setResult(null); onAvailability(null); setFailure({ key, message: e.response?.data?.message || 'No se pudo consultar la disponibilidad.' });
      }
    };
    load();
    const timer = setInterval(load, 30000);
    return () => { disposed = true; controller?.abort(); clearInterval(timer); };
  }, [space?.id, space?.numberedDesks, date, startTime, endTime, editId, readOnly, key, onAvailability]);
  if (!space?.numberedDesks && !assignedDesks?.length) return null;
  if (readOnly) return <section className="desk-panel full"><strong>Mesas asignadas: {assignedDesks?.map(d => d.desk.number).join(', ') || 'Sin asignación'}</strong></section>;
  const data = result?.key === key ? result.data : null;
  const error = failure?.key === key ? failure.message : '';
  const selectedAvailable = deskIds.filter(id => data?.desks.some(d => d.id === id && d.status === 'FREE'));
  function toggle(id) {
    if (selectedAvailable.includes(id)) onSelection(selectedAvailable.filter(value => value !== id));
    else if (selectedAvailable.length < Number(attendees)) onSelection([...selectedAvailable,id]);
    else if (Number(attendees) === 1) onSelection([id]);
  }
  return <section className="desk-panel full" aria-label="Disponibilidad de mesas">
    <h3>Mesas para tu reserva</h3>
    <div role="status" aria-live="polite">
      {error ? <p className="desk-error">{error} <button type="button" onClick={() => setRetry(n => n+1)}>Reintentar</button></p> : !data ? <p>{!date || !startTime || !endTime || endTime <= startTime ? 'Elegí fecha y horario para ver las mesas disponibles.' : 'Consultando disponibilidad…'}</p> : <>
        <strong>{data.available === 0 ? 'Completo para este horario' : data.available + ' de ' + data.capacity + ' puestos disponibles'}</strong>
        <p>{data.occupied} ocupados o con asignación fija para parte o todo el horario.</p>
        {data.available > 0 && data.available / data.capacity <= 0.2 && <p className="desk-urgency">¡Últimos {data.available} puestos disponibles!</p>}
      </>}
    </div>
    {data && <>
      <div className="desk-grid">{data.desks.map(d => {
        const selected = selectedAvailable.includes(d.id);
        const label = d.status === 'FIXED' ? 'Fija' : d.status === 'OCCUPIED' ? 'Ocupada' : selected && admin ? 'Seleccionada' : 'Libre';
        const className = 'desk-tile desk-' + d.status.toLowerCase() + (selected && admin ? ' desk-selected' : '');
        return admin ? <button type="button" className={className} key={d.id} disabled={d.status !== 'FREE'} aria-pressed={selected} onClick={() => toggle(d.id)}><strong>Mesa {d.number}</strong><span>{label}</span></button> : <div className={className} key={d.id}><strong>Mesa {d.number}</strong><span>{label}</span></div>;
      })}</div>
      <p>{admin ? 'Seleccioná una mesa por asistente: ' + selectedAvailable.length + ' de ' + attendees + '.' : 'Te asignaremos una mesa libre por persona al guardar la reserva.'}</p>
      {Number(attendees) > data.available && <p className="desk-error">No hay suficientes mesas para esa cantidad de asistentes.</p>}
      <small>Disponibilidad durante todo el horario. Se actualiza cada 30 segundos y se comprueba al guardar.</small>
      {recurring && <p><small>Esta vista corresponde a la fecha elegida. Al guardar se comprobarán todas las fechas de la serie.{admin ? ' Las mesas seleccionadas deben estar libres en todas ellas.' : ' El número de mesa puede variar entre fechas.'}</small></p>}
    </>}
  </section>;
}
