import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';
import calendarImg from '../images/calendar-illustration.png'; 


export default function UserReservations() {
  const navigate = useNavigate();
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(null); // Date | null

  const user = getCurrentUser();

  async function fetchReservations() {
    const res = await api.get('/reservations/my');
    setReservations(res.data);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        await fetchReservations();
      } catch (err) {
        console.error(err);
        setError('Error al cargar tus reservas');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function handleCancel(id) {
    if (!window.confirm('¿Seguro que quieres cancelar esta reserva?')) return;

    try {
      await api.delete(`/reservations/${id}`);
      await fetchReservations();
    } catch (err) {
      console.error(err);
      setError('Error al cancelar la reserva');
    }
  }

  // --------- HELPERS CALENDARIO ---------
  function formatKeyFromDate(dateObj) {
    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  const reservationDates = useMemo(() => {
    const map = new Map();
    reservations.forEach((r) => {
      const dateObj = new Date(r.date);
      const key = formatKeyFromDate(dateObj);
      map.set(key, true);
    });
    return map;
  }, [reservations]);

  const selectedDateKey = selectedDate ? formatKeyFromDate(selectedDate) : null;

  // Generar semanas del mes actual (Lunes a Domingo)
  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDayNumber = new Date(year, month + 1, 0).getDate();

    const startWeekday = (firstDay.getDay() + 6) % 7; // 0 = lunes ... 6 = domingo

    const result = [];
    let day = 1;

    while (day <= lastDayNumber) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        if (result.length === 0 && i < startWeekday) {
          week.push(null);
        } else if (day > lastDayNumber) {
          week.push(null);
        } else {
          week.push(new Date(year, month, day));
          day++;
        }
      }
      result.push(week);
    }

    return result;
  }, [currentMonth]);

  const monthLabel = currentMonth.toLocaleDateString('es-ES', {
    month: 'long',
    year: 'numeric',
  });

  function goToPrevMonth() {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m - 1, 1);
    });
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => {
      const y = prev.getFullYear();
      const m = prev.getMonth();
      return new Date(y, m + 1, 1);
    });
  }

  // Click en un día: selecciona / des-selecciona y abre/cierra popup
  function handleDayClick(day) {
    const key = formatKeyFromDate(day);
    if (selectedDate && selectedDateKey === key) {
      setSelectedDate(null); // clic de nuevo sobre el mismo día → cierra popup
    } else {
      setSelectedDate(day);
    }
  }

  // Info del día seleccionado: reservas y franjas
  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return null;

    const dayKey = formatKeyFromDate(selectedDate);
    const dayReservations = reservations.filter((r) => {
      const d = new Date(r.date);
      return formatKeyFromDate(d) === dayKey;
    });

    const today = new Date();
    const endOfToday = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate(),
      23,
      59,
      59,
      999
    );
    const isFuture = selectedDate > endOfToday;

    const slots = [];
    const startHour = 9;
    const endHour = 18;

    for (let h = startHour; h < endHour; h++) {
      const slotStart = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h,
        0,
        0,
        0
      );
      const slotEnd = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h + 1,
        0,
        0,
        0
      );

      let status = 'DISPONIBLE';

      for (const r of dayReservations) {
        if (r.status === 'CANCELLED') continue;
        const resStart = new Date(r.startTime);
        const resEnd = new Date(r.endTime);

        if (slotStart < resEnd && slotEnd > resStart) {
          status = 'RESERVADO';
          break;
        }
      }

      const startLabel = `${String(h).padStart(2, '0')}:00`;
      const endLabel = `${String(h + 1).padStart(2, '0')}:00`;

      slots.push({
        label: `${startLabel} - ${endLabel}`,
        start: startLabel,
        end: endLabel,
        status,
      });
    }

    return { dayReservations, slots, isFuture };
  }, [selectedDate, reservations]);

  // Click en franja "Disponible" → ir al formulario con datos precargados
  function handleSlotClick(slot) {
    if (!selectedDate || slot.status !== 'DISPONIBLE') return;
    const dateParam = formatKeyFromDate(selectedDate); // YYYY-MM-DD
    navigate(
      `/user/reservar?date=${encodeURIComponent(
        dateParam
      )}&start=${encodeURIComponent(slot.start)}&end=${encodeURIComponent(
        slot.end
      )}`
    );
  }
  function handleEditReservation(id) {
    navigate(`/user/reservar?edit=${encodeURIComponent(id)}`);
  }


  function closeModal() {
    setSelectedDate(null);
  }

  if (loading) {
    return (
      <div>
        <Header user={user} />
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          Cargando tus reservas...
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header user={user} />

      <div
        className="admin-page"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.5rem 1rem 2rem',
        }}
      >
        {/* ENCABEZADO ALINEADO */}
        <div
          style={{
            width: '75vw',
            maxWidth: '960px',
            margin: '0 auto 1.5rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1 style={{ marginBottom: '0.25rem' }}>Mis reservas</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Consulta y gestiona tus reservas en Conworking Sinergia
            </span>
          </div>

          <Link
            to="/user"
            style={{
              padding: '0.45rem 1rem',
              background: '#4f46e5',
              borderRadius: '0.5rem',
              color: 'white',
              textDecoration: 'none',
              fontSize: '0.85rem',
              fontWeight: '600',
              whiteSpace: 'nowrap',
            }}
          >
            ← Volver al inicio
          </Link>
        </div>

        {/* MENSAJE DE ERROR */}
        {error && (
          <div
            className="error"
            style={{
              width: '75vw',
              maxWidth: '960px',
              marginBottom: '0.5rem',
            }}
          >
            {error}
          </div>
        )}

        {/* CARD DEL CALENDARIO + ILUSTRACIÓN (75vw) */}
        <div
          className="admin-card"
          style={{
            width: '75vw',
            maxWidth: '960px',
            margin: '0 auto 1rem',
            padding: '1.5rem 1.5rem 1.25rem',
            display: 'flex',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {/* ILUSTRACIÓN A LA IZQUIERDA */}
          <div
            style={{
              flex: '0 0 220px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={calendarImg}
              alt="Calendario"
              style={{
                width: '100%',
                maxWidth: '220px',
                height: 'auto',
                objectFit: 'contain',
              }}
            />
          </div>

          {/* CALENDARIO A LA DERECHA */}
          <div
            style={{
              flex: '1 1 auto',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Barra superior mes + navegación */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1rem',
              }}
            >
              <button
                type="button"
                onClick={goToPrevMonth}
                style={{
                  borderRadius: '999px',
                  border: 'none',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e5e7eb',
                  color: '#111827',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                ‹
              </button>

              <div
                style={{
                  fontWeight: 600,
                  textTransform: 'capitalize',
                  fontSize: '0.95rem',
                }}
              >
                {monthLabel}
              </div>

              <button
                type="button"
                onClick={goToNextMonth}
                style={{
                  borderRadius: '999px',
                  border: 'none',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#e5e7eb',
                  color: '#111827',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                ›
              </button>
            </div>

            {/* Cabecera días de la semana */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                fontSize: '0.8rem',
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: '0.3rem',
              }}
            >
              {['L', 'M', 'X', 'J', 'V', 'S', 'D'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            {/* Días del mes */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                rowGap: '0.25rem',
                columnGap: '0.25rem',
                fontSize: '0.8rem',
              }}
            >
              {weeks.map((week, wi) =>
                week.map((day, di) => {
                  if (!day) {
                    return (
                      <div
                        key={`${wi}-${di}`}
                        style={{
                          height: 26,
                        }}
                      />
                    );
                  }

                  const key = formatKeyFromDate(day);
                  const hasReservation = reservationDates.has(key);
                  const isSelected = selectedDateKey === key;

                  let background = 'transparent';
                  let color = '#111827';

                  if (hasReservation) {
                    background = '#e0f2fe';
                    color = '#1d4ed8';
                  }
                  if (isSelected) {
                    background = '#4f46e5';
                    color = '#ffffff';
                  }

                  return (
                    <div
                      key={key}
                      onClick={() => handleDayClick(day)}
                      style={{
                        height: 26,
                        borderRadius: '999px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background,
                        color,
                        fontWeight: hasReservation || isSelected ? 600 : 400,
                        cursor: 'pointer',
                        transition: 'background 0.15s ease, color 0.15s ease',
                      }}
                    >
                      {day.getDate()}
                    </div>
                  );
                })
              )}
            </div>

            {/* Leyenda */}
            <div
              style={{
                marginTop: '0.6rem',
                fontSize: '0.8rem',
                color: '#6b7280',
              }}
            >
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: '999px',
                    background: '#e0f2fe',
                    display: 'inline-block',
                  }}
                />
                Día con reserva
              </span>
            </div>
          </div>
        </div>

        {/* CARD DE LISTADO DE RESERVAS (75vw) */}
        <div
          className="admin-card"
          style={{
            width: '75vw',
            maxWidth: '960px',
            margin: '0 auto',
            padding: '2rem',
          }}
        >
          {reservations.length === 0 ? (
            <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
              Aún no tienes reservas. Puedes crear una desde "Agendar una reserva".
            </p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Espacio</th>
                  <th>Fecha</th>
                  <th>Franja</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {reservations.map((r) => {
                  const date = new Date(r.date);
                  const start = new Date(r.startTime);
                  const end = new Date(r.endTime);

                  const fecha = date.toLocaleDateString('es-ES');
                  const horaInicio = start.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });
                  const horaFin = end.toLocaleTimeString('es-ES', {
                    hour: '2-digit',
                    minute: '2-digit',
                  });

                  const isPast = start <= new Date();

                  return (
                    <tr key={r.id}>
                      <td>{r.space?.name}</td>
                      <td>{fecha}</td>
                      <td>
                        {horaInicio} - {horaFin}
                      </td>
                      <td>
                        {r.status === 'CANCELLED' ? (
                          <span className="badge red">Cancelada</span>
                        ) : isPast ? (
                          <span className="badge">Pasada</span>
                        ) : (
                          <span className="badge green">Activa</span>
                        )}
                      </td>
                      <td>
                        {!isPast && r.status === 'ACTIVE' && (
                          <button
                            className="btn-small btn-danger"
                            onClick={() => handleCancel(r.id)}
                          >
                            Cancelar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL DETALLE DEL DÍA */}
      {selectedDate && selectedDayInfo && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 40,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '90%',
              maxWidth: '640px',
              background: 'white',
              borderRadius: '1rem',
              boxShadow: '0 20px 45px rgba(15, 23, 42, 0.35)',
              padding: '1.5rem 1.75rem',
            }}
          >
            {/* Header modal */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                    fontSize: '1.05rem',
                  }}
                >
                  Detalle del{' '}
                  {selectedDate.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
                <p
                  style={{
                    margin: 0,
                    marginTop: '0.15rem',
                    fontSize: '0.8rem',
                    color: '#6b7280',
                  }}
                >
                  Revisa tus reservas y selecciona una franja disponible para
                  crear una nueva.
                </p>
              </div>

              <button
                type="button"
                onClick={closeModal}
                style={{
                  border: 'none',
                  borderRadius: '999px',
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: '#f3f4f6',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                }}
              >
                ✕
              </button>
            </div>

            {/* Cuerpo modal: 2 columnas */}
            <div
              style={{
                display: 'flex',
                gap: '1.25rem',
                alignItems: 'flex-start',
              }}
            >
              {/* Columna izquierda: reservas del día */}
              <div style={{ flex: '1 1 auto', fontSize: '0.82rem' }}>
                <div
                  style={{
                    fontWeight: 600,
                    marginBottom: '0.35rem',
                  }}
                >
                  Reservas de este día
                </div>

                {selectedDayInfo.dayReservations.length === 0 ? (
                  <p style={{ color: '#6b7280', marginTop: 0 }}>
                    {selectedDayInfo.isFuture
                      ? 'No tienes reservas para este día.'
                      : 'No tuviste reservas este día.'}
                  </p>
                ) : (
                  <ul
                    style={{
                      paddingLeft: '1.1rem',
                      marginTop: 0,
                      marginBottom: 0,
                    }}
                  >
                    {selectedDayInfo.dayReservations.map((r) => {
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
      marginBottom: '0.2rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: '0.5rem',
    }}
  >
    <div>
      <strong>{r.space?.name}</strong> ({horaInicio}–{horaFin}) –{' '}
      {r.status === 'CANCELLED' ? 'Cancelada' : 'Activa'}
    </div>

    {r.status === 'ACTIVE' && new Date(r.startTime) > new Date() && (
      <button
        type="button"
        onClick={() => handleEditReservation(r.id)}
        style={{
          fontSize: '0.75rem',
          padding: '0.15rem 0.6rem',
          borderRadius: '999px',
          border: '1px solid #3b82f6',
          background: '#eff6ff',
          color: '#1d4ed8',
          cursor: 'pointer',
        }}
      >
        Editar
      </button>
    )}
  </li>
);

                    })}
                  </ul>
                )}
              </div>

              {/* Columna derecha: franjas disponibles / reservadas */}
              {selectedDayInfo.isFuture && (
                <div
                  style={{
                    flex: '0 0 230px',
                    fontSize: '0.78rem',
                  }}
                >
                  <div
                    style={{
                      fontWeight: 600,
                      marginBottom: '0.3rem',
                    }}
                  >
                    Franjas (09:00 – 18:00)
                  </div>
                  <div
                    style={{
                      maxHeight: 190,
                      overflowY: 'auto',
                      borderRadius: '0.75rem',
                      border: '1px solid #e5e7eb',
                      padding: '0.4rem 0.6rem',
                      background: '#f9fafb',
                    }}
                  >
                    {selectedDayInfo.slots.map((slot) => (
                      <div
                        key={slot.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '0.18rem 0',
                          cursor:
                            slot.status === 'DISPONIBLE'
                              ? 'pointer'
                              : 'default',
                        }}
                        onClick={() => {
                          if (slot.status === 'DISPONIBLE') {
                            handleSlotClick(slot);
                          }
                        }}
                      >
                        <span>{slot.label}</span>
                        <span
                          style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            background:
                              slot.status === 'RESERVADO'
                                ? '#fee2e2'
                                : '#dcfce7',
                            color:
                              slot.status === 'RESERVADO'
                                ? '#b91c1c'
                                : '#166534',
                            whiteSpace: 'nowrap',
                            fontWeight: 500,
                          }}
                        >
                          {slot.status === 'RESERVADO'
                            ? 'Reservado'
                            : 'Disponible'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p
                    style={{
                      marginTop: '0.4rem',
                      fontSize: '0.75rem',
                      color: '#6b7280',
                    }}
                  >
                    Haz clic en una franja <strong>Disponible</strong> para ir al
                    formulario de reserva con los datos precargados.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
