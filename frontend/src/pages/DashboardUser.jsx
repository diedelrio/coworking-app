import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';

export default function DashboardUser() {
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeSlide, setActiveSlide] = useState(0); // 0 = estado usuario, 1 = mensaje admin

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

  // --------- LÓGICA DEL BANNER PERSONALIZADO ---------
  function getBannerMessage() {
    if (reservations.length === 0) {
      return {
        title: `¡Hola${user?.name ? ', ' + user.name : ''}!`,
        text: 'Vamos, estamos cerca de tu próxima reserva para trabajar en el sitio ideal.',
      };
    }

    const now = new Date();

    const activeReservations = reservations.filter(
      (r) => r.status === 'ACTIVE'
    );

    const upcoming = activeReservations
      .filter((r) => new Date(r.startTime) > now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    const past = activeReservations
      .filter((r) => new Date(r.startTime) <= now)
      .sort((a, b) => new Date(b.startTime) - new Date(a.startTime));

    if (upcoming.length > 0) {
      const next = upcoming[0];
      const start = new Date(next.startTime);
      const fecha = start.toLocaleDateString('es-ES');
      const hora = start.toLocaleTimeString('es-ES', {
        hour: '2-digit',
        minute: '2-digit',
      });

      return {
        title: 'Tu próxima reserva',
        text: `Tienes una reserva el ${fecha} a las ${hora} en "${next.space?.name}".`,
      };
    }

    if (past.length > 0) {
      const last = past[0];
      const start = new Date(last.startTime);
      const fecha = start.toLocaleDateString('es-ES');

      return {
        title: `Hola${user?.name ? ', ' + user.name : ''}, te extrañamos 👋`,
        text: `No te vemos desde tu última visita el ${fecha}. ¿Agendamos una nueva reserva?`,
      };
    }

    return {
      title: `¡Hola${user?.name ? ', ' + user.name : ''}!`,
      text: 'Vamos, estamos cerca de tu próxima reserva para trabajar en el sitio ideal.',
    };
  }

  const banner = getBannerMessage();

  // Slides del carrusel
  const slides = [
    {
      id: 'status',
      background:
        'linear-gradient(135deg, #EEF2FF 0%, #E0F2FE 50%, #ECFDF5 100%)',
      color: '#111827',
      title: banner.title,
      text: banner.text,
      footer:
        'Gestiona tus reservas y mantén tu rutina de trabajo en el mejor entorno.',
    },
    {
      id: 'admin',
      background: '#111827',
      color: '#F9FAFB',
      title: 'Mensaje del administrador',
      text:
        'Muy pronto tendremos nuevas ofertas y planes especiales para miembros frecuentes de Conworking Sinergia.',
      footer:
        'Descuentos en salas de reuniones, puestos fijos y acceso prioritario a eventos exclusivos.',
    },
  ];

  function goToPrevSlide() {
    setActiveSlide((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  }

  function goToNextSlide() {
    setActiveSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  }
  // AUTO SLIDE: cambia de slide automáticamente cada 4 segundos
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveSlide((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
    }, 4000);

    return () => clearInterval(interval);
  }, [slides.length]);

  if (loading) {
    return (
      <div>
        <Header user={user} />
        <div
          style={{
            padding: '2rem 1rem',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          Cargando tu panel...
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header user={user} />

      {/* Contenedor principal: centrado horizontal, arriba vertical */}
      <div
        style={{
          padding: '1.5rem 1rem 2rem',
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            width: '100%',
            maxWidth: '1100px',
          }}
        >
          {/* Cabecera del home */}
          <div
            style={{
              marginBottom: '1.5rem',
              textAlign: 'center',
            }}
          >
            <h1 style={{ marginBottom: '0.25rem' }}>Inicio</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Bienvenido a Conworking Sinergia
            </span>

            {error && (
              <div
                className="error"
                style={{
                  maxWidth: 600,
                  margin: '0.75rem auto 0',
                }}
              >
                {error}
              </div>
            )}
          </div>

          {/* CARRUSEL (3/4 de pantalla), con botones a los lados SIN solaparse */}
          <div
            style={{
              width: '75vw',
              maxWidth: '960px',
              margin: '0 auto 1.5rem',
              display: 'flex',
              alignItems: 'stretch',
              gap: '0.75rem',
            }}
          >
            {/* Botón anterior (izquierda, fuera de la card) */}
            <button
              type="button"
              onClick={goToPrevSlide}
              style={{
                flex: '0 0 auto',
                alignSelf: 'center',
                borderRadius: '999px',
                border: 'none',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e5e7eb',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              ‹
            </button>

            {/* Contenedor del carrusel */}
            <div
              style={{
                flex: '1 1 auto',
                position: 'relative',
                overflow: 'hidden',
                borderRadius: '1.5rem',
                boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  transform: `translateX(-${activeSlide * 100}%)`,
                  transition: 'transform 0.4s ease',
                }}
              >
                {slides.map((slide) => (
                  <div
                    key={slide.id}
                    style={{
                      minWidth: '100%',
                      padding: '1.75rem 2.25rem',
                      background: slide.background,
                      color: slide.color,
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      rowGap: '0.75rem',
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin: 0,
                          marginBottom: '0.5rem',
                          fontSize: '1.25rem',
                        }}
                      >
                        {slide.title}
                      </h2>
                      <p
                        style={{
                          margin: 0,
                          marginBottom: '0.75rem',
                          fontSize: '0.98rem',
                        }}
                      >
                        {slide.text}
                      </p>
                    </div>
                    <p
                      style={{
                        margin: 0,
                        fontSize: '0.85rem',
                        opacity: 0.85,
                      }}
                    >
                      {slide.footer}
                    </p>
                  </div>
                ))}
              </div>

              {/* Dots indicadores en la parte inferior, dentro del carrusel */}
              <div
                style={{
                  position: 'absolute',
                  bottom: '0.6rem',
                  left: '50%',
                  transform: 'translateX(-50%)',
                  display: 'flex',
                  gap: '0.4rem',
                }}
              >
                {slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => setActiveSlide(index)}
                    type="button"
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '999px',
                      border: 'none',
                      cursor: 'pointer',
                      background:
                        index === activeSlide
                          ? '#4f46e5'
                          : 'rgba(148, 163, 184, 0.7)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Botón siguiente (derecha, fuera de la card) */}
            <button
              type="button"
              onClick={goToNextSlide}
              style={{
                flex: '0 0 auto',
                alignSelf: 'center',
                borderRadius: '999px',
                border: 'none',
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#e5e7eb',
                color: '#111827',
                cursor: 'pointer',
              }}
            >
              ›
            </button>
          </div>

          {/* BOTONES (mitad de pantalla aprox.), centrados */}
          <div
            style={{
              width: '50vw',
              maxWidth: '640px',
              margin: '0 auto',
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '1rem',
            }}
          >
            <Link
              to="/user/reservas"
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.2rem 1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
                color: '#111827',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '999px',
                  background: '#eff6ff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                }}
              >
                📋
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Mis reservas</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Consulta tus reservas actuales y pasadas.
                </div>
              </div>
            </Link>

            <Link
              to="/user/reservar"
              style={{
                background: 'white',
                borderRadius: '1rem',
                padding: '1.2rem 1rem',
                boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                textAlign: 'left',
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                textDecoration: 'none',
                color: '#111827',
              }}
            >
              <div
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: '999px',
                  background: '#ecfdf5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '1.5rem',
                }}
              >
                📅
              </div>
              <div>
                <div style={{ fontWeight: 600 }}>Agendar una reserva</div>
                <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                  Elige fecha, horario y espacio ideal para trabajar.
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
