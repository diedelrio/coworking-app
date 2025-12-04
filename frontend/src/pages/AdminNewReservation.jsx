import { useEffect, useState } from 'react';
import { useNavigate, useLocation, Link, Navigate } from 'react-router-dom';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import { getCurrentUser } from '../utils/auth';

export default function AdminNewReservation() {
  const [spaces, setSpaces] = useState([]);
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState({
    userId: '',
    spaceId: '',
    date: '',
    startTime: '09:00',
    endTime: '11:00',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(true);

  const currentUser = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const prefillDate = searchParams.get('date') || '';
  const prefillStart = searchParams.get('start') || '09:00';
  const prefillEnd = searchParams.get('end') || '11:00';

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);

        const [spacesRes, usersRes] = await Promise.all([
          api.get('/spaces/active'),
          api.get('/users'),
        ]);

        setSpaces(spacesRes.data || []);
        setUsers(usersRes.data || []);

        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;

        setForm((prev) => ({
          ...prev,
          date: prefillDate || prev.date || todayStr,
          startTime: prefillStart,
          endTime: prefillEnd,
        }));
      } catch (err) {
        console.error(err);
        setError('Error al cargar datos iniciales');
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [prefillDate, prefillStart, prefillEnd]);

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
      if (!form.userId) {
        setError('Debes seleccionar un usuario');
        setSaving(false);
        return;
      }

      const payload = {
        userId: Number(form.userId),
        spaceId: Number(form.spaceId),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      };

      await api.post('/reservations', payload);

      setInfo('Reserva creada correctamente');
      navigate('/admin');
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message || 'Error al crear la reserva'
      );
    } finally {
      setSaving(false);
    }
  }

  // Seguridad extra: si alguien entra sin ser admin, se redirige
  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }
  if (currentUser.role !== 'ADMIN') {
    return <Navigate to="/user" replace />;
  }

  if (loading) {
    return (
      <Layout user={currentUser}>
        <div style={{ padding: '2rem 1rem' }}>Cargando datos...</div>
      </Layout>
    );
  }

  return (
    <Layout user={currentUser}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '1.5rem 0 2rem',
        }}
      >
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
            <h1 style={{ marginBottom: '0.25rem' }}>Agendar una reserva</h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              Crea una reserva en nombre de un usuario
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
              whiteSpace: 'nowrap',
            }}
          >
            ← Volver al panel
          </Link>
        </div>

        {error && (
          <div
            style={{
              width: '75vw',
              maxWidth: '960px',
              margin: '0 auto 0.5rem',
              color: '#b91c1c',
            }}
          >
            {error}
          </div>
        )}
        {info && (
          <div
            style={{
              width: '75vw',
              maxWidth: '960px',
              margin: '0 auto 0.5rem',
              color: '#16a34a',
              fontSize: '0.9rem',
            }}
          >
            {info}
          </div>
        )}

        <div
          style={{
            width: '75vw',
            maxWidth: '960px',
            margin: '0 auto',
            padding: '2rem',
            borderRadius: '1rem',
            background: 'white',
            boxShadow: '0 10px 25px rgba(15,23,42,0.08)',
          }}
        >
          <form onSubmit={handleSubmit}>
            {/* Usuario */}
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label>Usuario</label>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <select
                  name="userId"
                  value={form.userId}
                  onChange={handleChange}
                  required
                  style={{
                    flex: 1,
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    padding: '0.6rem 0.8rem',
                    fontSize: '0.95rem',
                  }}
                >
                  <option value="">Selecciona un usuario</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>

                {/* Por ahora, simplemente enlazamos a la gestión de usuarios */}
                <Link
                  to="/admin"
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.5rem',
                    border: '1px solid #d1d5db',
                    fontSize: '0.85rem',
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                >
                  + Crear usuario
                </Link>
              </div>
            </div>

            {/* Espacio */}
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

            {/* Fecha y horas */}
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
              {saving ? 'Creando reserva...' : 'Crear reserva'}
            </button>
          </form>
        </div>
      </div>
    </Layout>
  );
}
