import { useMemo, useState } from 'react';
import calendarImg from '../images/calendar-illustration.png';

function pad2(n) {
  return String(n).padStart(2, '0');
}

function formatKeyFromDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

export default function ReservationsCalendar({
  reservations = [],
  onEditReservation,
  onSlotClick, // (slot, selectedDate) => void
}) {
  const [currentMonth, setCurrentMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const [selectedDate, setSelectedDate] = useState(null);

  // Días con reserva (por startTime)
  const reservationDates = useMemo(() => {
    const map = new Map();
    reservations.forEach((r) => {
      if (!r?.startTime) return;
      if (r.status === 'CANCELLED') return;
      const dateObj = new Date(r.startTime);
      map.set(formatKeyFromDate(dateObj), true);
    });
    return map;
  }, [reservations]);

  const selectedDateKey = selectedDate ? formatKeyFromDate(selectedDate) : null;

  // Semanas del mes (Lunes a Domingo)
  const weeks = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDayNumber = new Date(year, month + 1, 0).getDate();

    const startWeekday = (firstDay.getDay() + 6) % 7; // 0=lunes..6=domingo

    const result = [];
    let day = 1;

    while (day <= lastDayNumber) {
      const week = [];
      for (let i = 0; i < 7; i++) {
        if (result.length === 0 && i < startWeekday) week.push(null);
        else if (day > lastDayNumber) week.push(null);
        else {
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
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrentMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  function handleDayClick(day) {
    const key = formatKeyFromDate(day);
    if (selectedDate && selectedDateKey === key) setSelectedDate(null);
    else setSelectedDate(day);
  }

  function closeModal() {
    setSelectedDate(null);
  }

  // Info día seleccionado
  const selectedDayInfo = useMemo(() => {
    if (!selectedDate) return null;

    const dayKey = formatKeyFromDate(selectedDate);

    const dayReservations = reservations.filter((r) => {
      if (!r?.startTime) return false;
      const d = new Date(r.startTime);
      return formatKeyFromDate(d) === dayKey;
    });

    const today = new Date();
    const isFuture = startOfDay(selectedDate).getTime() > endOfDay(today).getTime();

    // Franjas 09:00–18:00
    const slots = [];
    const startHour = 9;
    const endHour = 18;

    for (let h = startHour; h < endHour; h++) {
      const slotStart = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h, 0, 0, 0
      );
      const slotEnd = new Date(
        selectedDate.getFullYear(),
        selectedDate.getMonth(),
        selectedDate.getDate(),
        h + 1, 0, 0, 0
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

      const startLabel = `${pad2(h)}:00`;
      const endLabel = `${pad2(h + 1)}:00`;

      slots.push({
        label: `${startLabel} - ${endLabel}`,
        start: startLabel,
        end: endLabel,
        status,
      });
    }

    return { dayReservations, slots, isFuture };
  }, [selectedDate, reservations]);

  return (
    <>
      {/* CARD CALENDARIO + ILUSTRACIÓN */}
      <div
        className="admin-card"
        style={{
          width: '100%',
          margin: '0 auto 1rem',
          padding: '1.5rem 1.5rem 1.25rem',
          display: 'flex',
          gap: '1.5rem',
          alignItems: 'stretch',
        }}
      >
        {/* Ilustración */}
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

        {/* Calendario */}
        <div style={{ flex: '1 1 auto', display: 'flex', flexDirection: 'column' }}>
          {/* Barra superior */}
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

            <div style={{ fontWeight: 600, textTransform: 'capitalize', fontSize: '0.95rem' }}>
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

          {/* Días semana */}
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

          {/* Días */}
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
                if (!day) return <div key={`${wi}-${di}`} style={{ height: 26 }} />;

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
          <div style={{ marginTop: '0.6rem', fontSize: '0.8rem', color: '#6b7280' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
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

      {/* MODAL */}
      {selectedDate && selectedDayInfo ? (
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
                <h2 style={{ margin: 0, fontSize: '1.05rem' }}>
                  Detalle del{' '}
                  {selectedDate.toLocaleDateString('es-ES', {
                    day: '2-digit',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h2>
                <p style={{ margin: 0, marginTop: '0.15rem', fontSize: '0.8rem', color: '#6b7280' }}>
                  Revisa tus reservas y selecciona una franja disponible para crear una nueva.
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

            <div style={{ display: 'flex', gap: '1.25rem', alignItems: 'flex-start' }}>
              {/* Reservas del día */}
              <div style={{ flex: '1 1 auto', fontSize: '0.82rem' }}>
                <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>
                  Reservas de este día
                </div>

                {selectedDayInfo.dayReservations.length === 0 ? (
                  <p style={{ color: '#6b7280', marginTop: 0 }}>
                    {selectedDayInfo.isFuture ? 'No tienes reservas para este día.' : 'No tuviste reservas este día.'}
                  </p>
                ) : (
                  <ul style={{ paddingLeft: '1.1rem', marginTop: 0, marginBottom: 0 }}>
                    {selectedDayInfo.dayReservations.map((r) => {
                      const start = new Date(r.startTime);
                      const end = new Date(r.endTime);
                      const horaInicio = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                      const horaFin = end.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

                      const canEdit = r.status === 'ACTIVE' && new Date(r.startTime) > new Date();

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
                            <strong>{r.space?.name || 'Espacio'}</strong> ({horaInicio}–{horaFin}) –{' '}
                            {r.status === 'CANCELLED' ? 'Cancelada' : 'Activa'}
                          </div>

                          {canEdit ? (
                            <button
                              type="button"
                              onClick={() => onEditReservation?.(r.id)}
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
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Franjas */}
              {selectedDayInfo.isFuture ? (
                <div style={{ flex: '0 0 230px', fontSize: '0.78rem' }}>
                  <div style={{ fontWeight: 600, marginBottom: '0.3rem' }}>
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
                          cursor: slot.status === 'DISPONIBLE' ? 'pointer' : 'default',
                        }}
                        onClick={() => {
                          if (slot.status === 'DISPONIBLE') onSlotClick?.(slot, selectedDate);
                        }}
                      >
                        <span>{slot.label}</span>
                        <span
                          style={{
                            padding: '0.15rem 0.55rem',
                            borderRadius: '999px',
                            background: slot.status === 'RESERVADO' ? '#fee2e2' : '#dcfce7',
                            color: slot.status === 'RESERVADO' ? '#b91c1c' : '#166534',
                            whiteSpace: 'nowrap',
                            fontWeight: 500,
                          }}
                        >
                          {slot.status === 'RESERVADO' ? 'Reservado' : 'Disponible'}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p style={{ marginTop: '0.4rem', fontSize: '0.75rem', color: '#6b7280' }}>
                    Haz clic en una franja <strong>Disponible</strong> para ir al formulario con datos precargados.
                  </p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
