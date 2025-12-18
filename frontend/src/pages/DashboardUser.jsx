import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';
import { FiCalendar, FiPlusCircle } from 'react-icons/fi';

// ✅ Auto-load imágenes desde el repo (Vite)
// Poné imágenes en: src/assets/dashboard/*.(jpg|png|webp)
const imageModules = import.meta.glob('../assets/dashboard/*.{png,jpg,jpeg,webp}', { eager: true });
const carouselImages = Object.values(imageModules).map((m) => m.default);

function pad2(n) {
  return String(n).padStart(2, '0');
}
function formatDateTime(iso) {
  const d = new Date(iso);
  const dd = pad2(d.getDate());
  const mm = pad2(d.getMonth() + 1);
  const yyyy = d.getFullYear();
  const hh = pad2(d.getHours());
  const mi = pad2(d.getMinutes());
  return { date: `${dd}/${mm}/${yyyy}`, time: `${hh}:${mi}` };
}

export default function DashboardUser() {
  const user = getCurrentUser();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Carousel
  const [slide, setSlide] = useState(0);

  async function fetchReservations() {
    const res = await api.get('/reservations/my');
    setReservations(Array.isArray(res.data) ? res.data : []);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        await fetchReservations();
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(err?.response?.data?.message || 'Error al cargar tus reservas');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  // ✅ Próxima reserva vigente (sin /spaces)
  const nextReservation = useMemo(() => {
    const now = Date.now();
    const actives = reservations
      .filter((r) => r.status === 'ACTIVE')
      .filter((r) => new Date(r.startTime).getTime() >= now)
      .sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

    return actives[0] || null;
  }, [reservations]);

  const messageTitle = useMemo(() => {
    if (!nextReservation) {
      return 'No tenés reservas';
    }
    const { date, time } = formatDateTime(nextReservation.startTime);
    const spaceName = nextReservation.space?.name || 'Espacio';
    return `Tu próxima reserva será el ${date} a las ${time} en ${spaceName}`;
  }, [nextReservation]);

  const messageSubtitle = useMemo(() => {
    if (!nextReservation) {
      return 'Reservá tu espacio ideal para trabajar';
    }
    return 'Gestiona tus reservas y mantén tu rutina de trabajo en el mejor entorno.';
  }, [nextReservation]);

  // ✅ Carousel auto-rotate
  useEffect(() => {
    if (!carouselImages.length) return;
    const id = setInterval(() => {
      setSlide((s) => (s + 1) % carouselImages.length);
    }, 4500);
    return () => clearInterval(id);
  }, []);

  if (loading) {
    return (
      <div>
        <Header user={user} />
        <div style={{ padding: '2rem 1rem', display: 'flex', justifyContent: 'center' }}>
          Cargando tu panel...
        </div>
      </div>
    );
  }

  return (
    <div>
      <Header user={user} />

      <div className="page-container dashboard-page">
        <div className="dashboard-container">
          {/* Encabezado */}
          <div className="dashboard-header">
            <h1>Bienvenido</h1>
            <p>Gestioná tus espacios de trabajo</p>

            {error ? <div className="form-error">{error}</div> : null}
          </div>

          {/* Card mensaje */}
          <div className="admin-card dashboard-message-card">
            <div className="dashboard-message-title">{messageTitle}</div>
            <div className="dashboard-message-subtitle">{messageSubtitle}</div>
          </div>

          {/* Carousel full width */}
          <div className="dashboard-carousel-fullbleed">
            <div className="dashboard-carousel">
              {carouselImages.length ? (
                <>
                  <img
                    className="dashboard-carousel-img"
                    src={carouselImages[slide]}
                    alt={`slide-${slide + 1}`}
                  />

                  <div className="dashboard-carousel-dots">
                    {carouselImages.map((_, i) => (
                      <button
                        key={i}
                        className={`dashboard-dot ${i === slide ? 'active' : ''}`}
                        onClick={() => setSlide(i)}
                        aria-label={`Ir a imagen ${i + 1}`}
                        type="button"
                      />
                    ))}
                  </div>
                </>
              ) : (
                <div className="admin-card" style={{ padding: 18 }}>
                  No hay imágenes en <code>src/assets/dashboard</code>
                </div>
              )}
            </div>
          </div>

          {/* Cards acciones (misma funcionalidad) */}
          <div className="dashboard-actions">
            <Link className="dashboard-action-card" to="/user/reservas">
              <div className="dashboard-action-icon">
                <FiCalendar />
              </div>
              <div>
                <div className="dashboard-action-title">Mis reservas</div>
                <div className="dashboard-action-subtitle">
                  Ver y gestionar tus reservas actuales
                </div>
              </div>
            </Link>

            <Link className="dashboard-action-card" to="/user/reservar">
              <div className="dashboard-action-icon">
                <FiPlusCircle />
              </div>
              <div>
                <div className="dashboard-action-title">Agendar reserva</div>
                <div className="dashboard-action-subtitle">
                  Reservá un nuevo espacio de trabajo
                </div>
              </div>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
