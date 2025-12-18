import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';

import ReservationsCalendar from '../components/ReservationsCalendar';
import ReservationsGrid from '../components/ReservationsGrid';

function formatKeyFromDate(dateObj) {
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function UserReservations() {
  const navigate = useNavigate();
  const user = getCurrentUser();

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  function handleEditReservation(id) {
    navigate(`/user/reservar?edit=${encodeURIComponent(id)}`);
  }

  function handleSlotClick(slot, selectedDate) {
    const dateParam = formatKeyFromDate(selectedDate); // YYYY-MM-DD
    const params = new URLSearchParams({
      date: dateParam,
      start: slot.start,
      end: slot.end,
    });

    navigate(`/user/reservar?${params.toString()}`);
  }

  return (
    <div>
      <Header user={user} />

      <div className="page-container dashboard-page">
  <div className="dashboard-container user-reservations-page">
    {/* Encabezado */}
    <div className="dashboard-header user-reservations-header">
      <h1>Mis reservas</h1>
      <p>Consulta y gestiona tus reservas en Coworking Sinergia</p>
    </div>

    {error ? (
      <div className="form-error" style={{ marginTop: 12 }}>
        {error}
      </div>
    ) : null}

    {loading ? (
      <div className="admin-card" style={{ padding: 18, marginTop: 18 }}>
        Cargando tus reservas…
      </div>
    ) : (
      <>
        {/* ✅ Botón encima del calendario (derecha) */}
        <div className="user-reservations-top-actions">
          <Link to="/user" className="profile-back-button">
            ← Volver al inicio
          </Link>
        </div>

        {/* Calendario */}
        <div className="user-reservations-calendar">
          <ReservationsCalendar
            reservations={reservations}
            onEditReservation={handleEditReservation}
            onSlotClick={handleSlotClick}
          />
        </div>

        {/* Tabla + filtro */}
        <ReservationsGrid
          reservations={reservations}
          defaultStatus="ACTIVE"
          showStatusFilter={true}
          onCancelled={async () => {
            await fetchReservations();
          }}
        />
      </>
    )}
  </div>
</div>
    </div>
  );
}
