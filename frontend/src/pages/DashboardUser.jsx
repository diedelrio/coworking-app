import { useEffect, useState } from 'react';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';

export default function DashboardUser() {
  const [spaces, setSpaces] = useState([]);
  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const [form, setForm] = useState({
    spaceId: '',
    date: '',
    startTime: '09:00',
    endTime: '11:00',
  });

  const user = getCurrentUser();

  async function fetchSpaces() {
    const res = await api.get('/spaces/active');
    setSpaces(res.data);
  }

  async function fetchReservations() {
    const res = await api.get('/reservations/my');
    setReservations(res.data);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        await Promise.all([fetchSpaces(), fetchReservations()]);
      } catch (err) {
        console.error(err);
        setError('Error al cargar datos');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');

    try {
      await api.post('/reservations', {
        spaceId: Number(form.spaceId),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      });

      setInfo('Reserva creada correctamente');
      await fetchReservations();
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Error al crear la reserva');
    } finally {
      setSaving(false);
    }
  }

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

  if (loading) {
    return (
      <div>
        <Header user={user} />
        <div style={{ padding: '2rem' }}>Cargando tus datos...</div>
      </div>
    );
  }

  return (
    <div>
      <Header user={user} />

      <div className="admin-page">
        <div className="admin-header">
          <h1>Mis reservas</h1>
          <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
            Reserva puestos y salas del coworking
          </span>
        </div>

        {error && (
          <div className="error" style={{ maxWidth: 600 }}>
            {error}
          </div>
        )}
        {info && (
          <div
            style={{
              color: '#16a34a',
              fontSize: '0.9rem',
              marginBottom: '0.5rem',
            }}
          >
            {info}
          </div>
        )}

        <div className="admin-grid">
          {/* Reservas existentes */}
          <div className="admin-card">
            <h2
              style={{
                marginTop: 0,
                marginBottom: '1rem',
                fontSize: '1.1rem',
              }}
            >
              Próximas reservas
            </h2>

            {reservations.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                Aún no tienes reservas. Crea la primera con el formulario.
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
                          {r.status === 'ACTIVE' && !isPast && (
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

          {/* Formulario nueva reserva */}
          <div className="admin-card">
            <h2
              style={{
                marginTop: 0,
                marginBottom: '1rem',
                fontSize: '1.1rem',
              }}
            >
              Nueva reserva
            </h2>

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>Espacio</label>
                <select
                  name="spaceId"
                  value={form.spaceId}
                  onChange={handleChange}
                  required
                  style={{
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="">Selecciona un espacio</option>
                  {spaces.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>Fecha</label>
                <input
                  type="date"
                  name="date"
                  value={form.date}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Hora inicio</label>
                <input
                  type="time"
                  name="startTime"
                  value={form.startTime}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="form-group">
                <label>Hora fin</label>
                <input
                  type="time"
                  name="endTime"
                  value={form.endTime}
                  onChange={handleChange}
                  required
                />
              </div>

              <button className="button" type="submit" disabled={saving}>
                {saving ? 'Creando reserva...' : 'Reservar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
