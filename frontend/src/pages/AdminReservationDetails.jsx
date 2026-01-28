import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import api from '../api/axiosClient';
import Layout from '../components/Layout';

function isSharedType(spaceType) {
  const t = String(spaceType || '').toUpperCase();
  return t === 'FLEX' || t === 'SHARED_TABLE';
}

function formatDateTime(iso) {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    return d.toLocaleString([], {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return String(iso);
  }
}

function money(v) {
  if (v === null || v === undefined) return '-';
  const n = Number(v);
  if (Number.isNaN(n)) return String(v);
  return n.toLocaleString(undefined, { style: 'currency', currency: 'EUR' });
}

export default function AdminReservationDetails() {
  const { id } = useParams();
  const [sp] = useSearchParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [reservation, setReservation] = useState(null);

  // info del “slot” si el espacio es compartido
  const [slotInfo, setSlotInfo] = useState(null);

  // params opcionales (si vinieras desde algún link con query)
  const type = (sp.get('type') || '').toUpperCase();
  const seriesId = sp.get('seriesId') || '';
  const pattern = sp.get('pattern') || '';
  const occurrences = sp.get('occurrences') || '';

  // ✅ La serie se detecta por la reserva cargada (no depende del querystring)
  const effectiveSeriesId = reservation?.seriesId || seriesId || '';
  const isSeries = type === 'SERIES' || Boolean(effectiveSeriesId);

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/reservations/${id}`);
      setReservation(res.data);
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo cargar el detalle de la reserva.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Para espacios compartidos: mostrar cupo/capacidad y quién está en ese horario
  const loadSlotInfo = async (r) => {
    try {
      const space = r?.space || {};
      const spaceType = r?.spaceType ?? space.type ?? '';
      const shared = isSharedType(spaceType);

      if (!shared || !r?.spaceId || !r?.startTime || !r?.endTime || !r?.date) {
        setSlotInfo(null);
        return;
      }

      const capacity = Number(space.capacity) > 0 ? Number(space.capacity) : 1;

      // este endpoint ya existe y trae include user+space
      const all = await api.get(`/reservations/space/${r.spaceId}`);
      const list = Array.isArray(all.data) ? all.data : [];

      const startMs = new Date(r.startTime).getTime();
      const endMs = new Date(r.endTime).getTime();
      const dateStr = new Date(r.date).toDateString();

      const occupyingStatuses = new Set(['ACTIVE', 'PENDING', 'APPROVED']);

      // mismo slot = misma fecha + mismo start/end (a nivel ms)
      const sameSlot = list.filter((x) => {
        if (!x?.startTime || !x?.endTime || !x?.date) return false;
        const s = new Date(x.startTime).getTime();
        const e = new Date(x.endTime).getTime();
        const d = new Date(x.date).toDateString();
        const st = String(x.status || '').toUpperCase();
        return d === dateStr && s === startMs && e === endMs && occupyingStatuses.has(st);
      });

      // cupo ocupado = suma de attendees (mínimo 1)
      const occupied = sameSlot.reduce((acc, x) => acc + Math.max(1, Number(x.attendees || 1)), 0);
      const available = Math.max(0, capacity - occupied);

      setSlotInfo({
        shared: true,
        capacity,
        occupied,
        available,
        reservations: sameSlot,
      });
    } catch (e) {
      console.warn('No se pudo cargar info de cupo/participantes del slot', e);
      setSlotInfo(null);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (reservation) loadSlotInfo(reservation);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reservation?.id]);

  const header = useMemo(() => {
    if (!reservation) return 'Detalle de reserva';
    const space = reservation?.space?.name || `Espacio #${reservation.spaceId}`;
    const user = reservation?.user
      ? `${reservation.user.name || ''} ${reservation.user.lastName || ''}`.trim() || reservation.user.email
      : `Usuario #${reservation.userId}`;
    return `${space} · ${user}`;
  }, [reservation]);

  const approve = async () => {
  if (!reservation) return;
  setBusy(true);
  setError('');
  try {
    if (isSeries && effectiveSeriesId) {
      await api.patch(`/reservations/series/${effectiveSeriesId}/approve`);
    } else {
      await api.patch(`/reservations/${reservation.id}/approve`);
    }

    // ✅ volver automáticamente al dashboard admin
    navigate('/admin');
  } catch (e) {
    console.error(e);
    setError(e?.response?.data?.message || 'No se pudo aprobar.');
  } finally {
    setBusy(false);
  }
};


  const reject = async () => {
    if (!reservation) return;
    const reason = window.prompt('Motivo de rechazo (se enviará al usuario por email):', '');
    if (reason === null) return;

    setBusy(true);
    setError('');
    try {
      if (isSeries && effectiveSeriesId) {
        await api.patch(`/reservations/series/${effectiveSeriesId}/reject`, { reason });
      } else {
        await api.patch(`/reservations/${reservation.id}/reject`, { reason });
      }
      await load();
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo rechazar.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Layout>
       <div className="admin-container" style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: '75%', maxWidth: 1200 }}>
            <h1 margin-bottom='0.25rem'>Detalle de Reserva</h1>
          
          <div
            className="admin-card"
            style={{
              padding: 18,
              width: '75%',
              maxWidth: 1200,   // evita que se haga gigante en pantallas grandes
            }}
          >
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.1rem' }}>{header}</h1>
              <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
                <span style={{ marginRight: 10 }}>ID: #{id}</span>
                {isSeries && effectiveSeriesId ? <span title="Serie recurrente">Serie: {effectiveSeriesId}</span> : null}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <button type="button" className="pill-button-outline" onClick={() => navigate(-1)}>
                Volver
              </button>
            </div>
          </div>

          {error ? <div style={{ marginTop: 12, color: '#b91c1c' }}>{error}</div> : null}

          {loading ? (
            <p style={{ color: '#6b7280', marginTop: 12 }}>Cargando…</p>
          ) : !reservation ? (
            <p style={{ color: '#6b7280', marginTop: 12 }}>No se encontró la reserva.</p>
          ) : (
            <>
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                  gap: 12,
                  marginTop: 14,
                }}
              >
                <div className="admin-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Horario</div>
                  <div>Inicio: {formatDateTime(reservation.startTime)}</div>
                  <div>Fin: {formatDateTime(reservation.endTime)}</div>
                  <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
                    Duración: {reservation.durationMinutes ?? '-'} min
                  </div>
                </div>

                <div className="admin-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Estado</div>
                  <div>{reservation.status || '-'}</div>
                  <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
                    Asistentes: {reservation.attendees ?? '-'}
                  </div>

                  {slotInfo?.shared ? (
                    <div style={{ marginTop: 10, color: '#6b7280', fontSize: 13, lineHeight: 1.35 }}>
                      <div>Cupo total del espacio: {slotInfo.capacity}</div>
                      <div>Ocupado en ese horario: {slotInfo.occupied}</div>
                      <div>Disponible: {slotInfo.available}</div>
                    </div>
                  ) : null}
                </div>

                <div className="admin-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Importe</div>
                  <div>Costo/hora (snapshot): {money(reservation.hourlyRateSnapshot)}</div>
                  <div>Total: {money(reservation.totalAmount)}</div>
                </div>

                {isSeries ? (
                  <div className="admin-card" style={{ padding: 14 }}>
                    <div style={{ fontWeight: 800, marginBottom: 6 }}>Recurrencia</div>
                    <div>Pattern: {reservation.recurrencePattern || pattern || '-'}</div>
                    <div>SeriesId: {effectiveSeriesId || '-'}</div>
                    <div>Ocurrencias: {reservation.recurrenceCount || occurrences || '-'}</div>
                    <div style={{ marginTop: 6, color: '#6b7280', fontSize: 13 }}>
                      Fin:{' '}
                      {reservation.recurrenceEndDate
                        ? new Date(reservation.recurrenceEndDate).toLocaleDateString()
                        : '-'}
                    </div>
                  </div>
                ) : null}
              </div>

              {slotInfo?.shared && Array.isArray(slotInfo.reservations) && slotInfo.reservations.length > 0 ? (
                <div className="admin-card" style={{ padding: 14, marginTop: 12 }}>
                  <div style={{ fontWeight: 800, marginBottom: 8 }}>Participantes en el mismo horario</div>
                  <div style={{ color: '#6b7280', fontSize: 13, marginBottom: 10 }}>
                    Solo cuenta reservas que ocupan cupo (PENDING/APPROVED/ACTIVE).
                  </div>

                  <div style={{ display: 'grid', gap: 8 }}>
                    {slotInfo.reservations.map((x) => {
                      const uname = x?.user
                        ? `${x.user.name || ''} ${x.user.lastName || ''}`.trim() || x.user.email
                        : x?.userId
                        ? `Usuario #${x.userId}`
                        : '—';

                      return (
                        <div
                          key={x.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            gap: 12,
                            padding: '10px 12px',
                            border: '1px solid #e5e7eb',
                            borderRadius: 12,
                            background: '#fff',
                          }}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontWeight: 700,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {uname}
                            </div>
                            <div style={{ color: '#6b7280', fontSize: 13 }}>
                              Reserva #{x.id} · {String(x.status || '').toUpperCase()}
                            </div>
                          </div>

                          <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>👥 {x.attendees ?? 1}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div style={{ marginTop: 16, display: 'grid', gap: 12 }}>
                <div className="admin-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>Propósito</div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{reservation.purpose || '-'}</div>
                </div>

                <div className="admin-card" style={{ padding: 14 }}>
                  <div style={{ fontWeight: 800, marginBottom: 6 }}>
                    Notas {reservation.notes?.trim() ? <span title="Tiene notas">📝</span> : null}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap' }}>{reservation.notes || '-'}</div>
                </div>
              </div>

              {reservation.status === 'PENDING' || reservation.status === 'APPROVED' ? (
                <div style={{ marginTop: 16, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="pill-button-green" onClick={approve} disabled={busy}>
                    {busy ? 'Procesando…' : isSeries ? 'Aprobar serie' : 'Aprobar'}
                  </button>
                  <button type="button" className="pill-button-red" onClick={reject} disabled={busy}>
                    {busy ? 'Procesando…' : isSeries ? 'Rechazar serie' : 'Rechazar'}
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
        </div>
      </div>
    </Layout>
  );
}
