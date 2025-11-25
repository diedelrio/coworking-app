import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';

function formatDateInput(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getWeekRange(dateStr) {
  const base = new Date(`${dateStr}T00:00:00`);
  base.setHours(0, 0, 0, 0);

  const day = base.getDay() || 7; // domingo=0 => 7
  const monday = new Date(base);
  monday.setDate(base.getDate() - day + 1);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  return {
    from: formatDateInput(monday),
    to: formatDateInput(sunday),
  };
}

function getMonthRange(dateStr) {
  const base = new Date(`${dateStr}T00:00:00`);
  const year = base.getFullYear();
  const month = base.getMonth(); // 0-11

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0); // día 0 del mes siguiente

  return {
    from: formatDateInput(firstDay),
    to: formatDateInput(lastDay),
  };
}

const WEEKDAY_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

export default function SpaceCalendar() {
  const user = getCurrentUser();
  const [searchParams] = useSearchParams();
  const initialSpaceId = searchParams.get('spaceId') || '';

  const [spaces, setSpaces] = useState([]);
  const [selectedSpaceId, setSelectedSpaceId] = useState(initialSpaceId);
  const [date, setDate] = useState(formatDateInput(new Date())); // hoy
  const [viewMode, setViewMode] = useState('day'); // 'day' | 'week' | 'month'

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchSpaces() {
    const res = await api.get('/spaces');
    setSpaces(res.data);
    if (!selectedSpaceId && res.data.length > 0) {
      setSelectedSpaceId(String(res.data[0].id));
    }
  }

  async function fetchReservations() {
    if (!selectedSpaceId) return;

    setLoading(true);
    setError('');

    try {
      let from = date;
      let to = date;

      if (viewMode === 'week') {
        const range = getWeekRange(date);
        from = range.from;
        to = range.to;
      } else if (viewMode === 'month') {
        const range = getMonthRange(date);
        from = range.from;
        to = range.to;
      }

      const res = await api.get(`/reservations/space/${selectedSpaceId}`, {
        params: { from, to },
      });

      setReservations(res.data);
    } catch (err) {
      console.error(err);
      setError('Error al cargar las reservas del espacio');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchSpaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchReservations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSpaceId, date, viewMode]);

  function groupByDay(reservationsList) {
    const map = {};
    reservationsList.forEach((r) => {
      const d = new Date(r.date);
      const key = formatDateInput(d);
      if (!map[key]) map[key] = [];
      map[key].push(r);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort(
        (a, b) => new Date(a.startTime) - new Date(b.startTime)
      );
    });

    return map;
  }

  function renderDayView() {
    const dayReservations = reservations.filter((r) => {
      const d = formatDateInput(new Date(r.date));
      return d === date;
    });

    if (dayReservations.length === 0) {
      return (
        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          No hay reservas para esta fecha.
        </p>
      );
    }

    return (
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {dayReservations.map((r) => {
          const start = new Date(r.startTime);
          const end = new Date(r.endTime);
          const horaInicio = start.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const horaFin = end.toLocaleTimeString('es-ES', {
            hour: '2-digit',
            minute: '2-digit',
          });
          const userName = r.user
            ? `${r.user.name} ${r.user.lastName}`.trim()
            : '—';

          return (
            <li
              key={r.id}
              style={{
                padding: '0.6rem 0.8rem',
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                marginBottom: '0.5rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor:
                  r.status === 'CANCELLED' ? '#fef2f2' : '#f9fafb',
              }}
            >
              <div>
                <div style={{ fontWeight: 600 }}>
                  {horaInicio} - {horaFin}
                </div>
                <div style={{ fontSize: '0.85rem', color: '#4b5563' }}>
                  Usuario: {userName || '—'}
                </div>
              </div>
              <div>
                {r.status === 'CANCELLED' ? (
                  <span className="badge red">Cancelada</span>
                ) : (
                  <span className="badge green">Activa</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    );
  }

  function renderWeekView() {
    if (reservations.length === 0) {
      return (
        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          No hay reservas en esta semana.
        </p>
      );
    }

    const grouped = groupByDay(reservations);
    const range = getWeekRange(date);

    const days = [];
    const monday = new Date(`${range.from}T00:00:00`);
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '0.75rem',
        }}
      >
        {days.map((d) => {
          const key = formatDateInput(d);
          const items = grouped[key] || [];
          const label = `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`;

          return (
            <div
              key={key}
              style={{
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                padding: '0.5rem',
                backgroundColor: '#ffffff',
                minHeight: '80px',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                  color: '#374151',
                }}
              >
                {label}
              </div>
              {items.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  — Libre —
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    fontSize: '0.75rem',
                  }}
                >
                  {items.map((r) => {
                    const start = new Date(r.startTime);
                    const end = new Date(r.endTime);
                    const horaInicio = start.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const horaFin = end.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <li
                        key={r.id}
                        style={{
                          marginBottom: '0.25rem',
                          padding: '0.25rem 0.4rem',
                          borderRadius: '999px',
                          backgroundColor:
                            r.status === 'CANCELLED'
                              ? '#fee2e2'
                              : '#e0f2fe',
                          color:
                            r.status === 'CANCELLED'
                              ? '#b91c1c'
                              : '#0369a1',
                        }}
                      >
                        {horaInicio}–{horaFin}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  function renderMonthView() {
    if (reservations.length === 0) {
      return (
        <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
          No hay reservas en este mes.
        </p>
      );
    }

    const grouped = groupByDay(reservations);
    const range = getMonthRange(date);

    const days = [];
    const first = new Date(`${range.from}T00:00:00`);
    const last = new Date(`${range.to}T00:00:00`);

    for (let d = new Date(first); d <= last; d.setDate(d.getDate() + 1)) {
      days.push(new Date(d));
    }

    return (
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, minmax(0, 1fr))',
          gap: '0.75rem',
        }}
      >
        {days.map((d) => {
          const key = formatDateInput(d);
          const items = grouped[key] || [];
          const label = `${WEEKDAY_SHORT[d.getDay()]} ${d.getDate()}`;

          return (
            <div
              key={key}
              style={{
                borderRadius: '0.75rem',
                border: '1px solid #e5e7eb',
                padding: '0.5rem',
                backgroundColor: '#ffffff',
                minHeight: '90px',
              }}
            >
              <div
                style={{
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  marginBottom: '0.25rem',
                  color: '#374151',
                }}
              >
                {label}
              </div>
              {items.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: '#9ca3af' }}>
                  — Libre —
                </div>
              ) : (
                <ul
                  style={{
                    listStyle: 'none',
                    padding: 0,
                    margin: 0,
                    fontSize: '0.75rem',
                  }}
                >
                  {items.map((r) => {
                    const start = new Date(r.startTime);
                    const end = new Date(r.endTime);
                    const horaInicio = start.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });
                    const horaFin = end.toLocaleTimeString('es-ES', {
                      hour: '2-digit',
                      minute: '2-digit',
                    });

                    return (
                      <li
                        key={r.id}
                        style={{
                          marginBottom: '0.25rem',
                          padding: '0.25rem 0.4rem',
                          borderRadius: '999px',
                          backgroundColor:
                            r.status === 'CANCELLED'
                              ? '#fee2e2'
                              : '#e0f2fe',
                          color:
                            r.status === 'CANCELLED'
                              ? '#b91c1c'
                              : '#0369a1',
                        }}
                      >
                        {horaInicio}–{horaFin}
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const selectedSpace = spaces.find(
    (s) => String(s.id) === String(selectedSpaceId)
  );

  return (
    <div>
      <Header user={user} />

      <div className="admin-page">
        <div
          className="admin-header"
          style={{ justifyContent: 'space-between' }}
        >
          <div>
            <h1>Calendario por espacio</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Visualiza las reservas por día, semana o mes
            </span>
          </div>

          <Link
            to="/admin"
            style={{
              padding: '0.45rem 1rem',
              background: '#4f46e5',
              borderRadius: '0.5rem',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
            }}
          >
            ← Volver al Panel
          </Link>
        </div>

        <div className="admin-card" style={{ marginBottom: '1rem' }}>
          {/* Controles */}
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '1rem',
              marginBottom: '1rem',
              alignItems: 'center',
            }}
          >
            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: '#4b5563',
                  marginBottom: '0.25rem',
                }}
              >
                Espacio
              </label>
              <select
                value={selectedSpaceId}
                onChange={(e) => setSelectedSpaceId(e.target.value)}
                style={{
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.9rem',
                }}
              >
                {spaces.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {!s.active ? ' (inactivo)' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: '#4b5563',
                  marginBottom: '0.25rem',
                }}
              >
                Fecha base
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  borderRadius: '0.5rem',
                  border: '1px solid #d1d5db',
                  padding: '0.5rem 0.75rem',
                  fontSize: '0.9rem',
                }}
              />
            </div>

            <div>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.8rem',
                  color: '#4b5563',
                  marginBottom: '0.25rem',
                }}
              >
                Vista
              </label>
              <div
                style={{
                  display: 'inline-flex',
                  borderRadius: '999px',
                  border: '1px solid #d1d5db',
                  overflow: 'hidden',
                }}
              >
                <button
                  type="button"
                  onClick={() => setViewMode('day')}
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    background:
                      viewMode === 'day' ? '#4f46e5' : 'transparent',
                    color: viewMode === 'day' ? '#ffffff' : '#374151',
                  }}
                >
                  Día
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('week')}
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    background:
                      viewMode === 'week' ? '#4f46e5' : 'transparent',
                    color: viewMode === 'week' ? '#ffffff' : '#374151',
                  }}
                >
                  Semana
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('month')}
                  style={{
                    padding: '0.35rem 0.9rem',
                    fontSize: '0.85rem',
                    border: 'none',
                    cursor: 'pointer',
                    background:
                      viewMode === 'month' ? '#4f46e5' : 'transparent',
                    color: viewMode === 'month' ? '#ffffff' : '#374151',
                  }}
                >
                  Mes
                </button>
              </div>
            </div>
          </div>

          {selectedSpace && (
            <p
              style={{
                fontSize: '0.85rem',
                color: '#6b7280',
                marginBottom: '1rem',
              }}
            >
              Calendario para: <strong>{selectedSpace.name}</strong>
            </p>
          )}

          {error && (
            <div className="error" style={{ marginBottom: '0.5rem' }}>
              {error}
            </div>
          )}

          {loading ? (
            <p>Cargando calendario...</p>
          ) : viewMode === 'day' ? (
            renderDayView()
          ) : viewMode === 'week' ? (
            renderWeekView()
          ) : (
            renderMonthView()
          )}
        </div>
      </div>
    </div>
  );
}
