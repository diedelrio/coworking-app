import { useEffect, useState } from 'react';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import LimitOverrideModal from '../components/LimitOverrideModal';

export default function UserNewReservation() {
  const [spaces, setSpaces] = useState([]);
  const [form, setForm] = useState({
    spaceId: '',
    date: '',
    startTime: '09:00',
    endTime: '11:00',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loadingSpaces, setLoadingSpaces] = useState(true);
  

  // Estados del modal
  const [overrideInfo, setOverrideInfo] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [sendingOverride, setSendingOverride] = useState(false);

  const user = getCurrentUser();
  const navigate = useNavigate();
  const location = useLocation();

  const searchParams = new URLSearchParams(location.search);
  const prefillDate = searchParams.get('date') || '';
  const prefillStart = searchParams.get('start') || '09:00';
  const prefillEnd = searchParams.get('end') || '11:00';

  const editId = searchParams.get('edit');
  const isEditMode = Boolean(editId);

  async function fetchSpaces() {
    const res = await api.get('/spaces/active');
    setSpaces(res.data);
  }

  useEffect(() => {
    async function load() {
      try {
        setLoadingSpaces(true);
        await fetchSpaces();

        if (isEditMode) {
          const res = await api.get(`/reservations/${editId}`);
          const r = res.data;

          const dateObj = new Date(r.date);
          const startObj = new Date(r.startTime);
          const endObj = new Date(r.endTime);

          const yyyy = dateObj.getFullYear();
          const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
          const dd = String(dateObj.getDate()).padStart(2, '0');

          const dateStr = `${yyyy}-${mm}-${dd}`;

          const startStr = `${String(startObj.getHours()).padStart(
            2,
            '0'
          )}:${String(startObj.getMinutes()).padStart(2, '0')}`;
          const endStr = `${String(endObj.getHours()).padStart(
            2,
            '0'
          )}:${String(endObj.getMinutes()).padStart(2, '0')}`;

          setForm({
            spaceId: String(r.spaceId),
            date: dateStr,
            startTime: startStr,
            endTime: endStr,
          });
        } else {
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
        }
      } catch (err) {
        console.error(err);
        setError('Error al cargar datos de la reserva');
      } finally {
        setLoadingSpaces(false);
      }
    }
    load();
  }, [isEditMode, editId, prefillDate, prefillStart, prefillEnd]);

  function handleChange(e) {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  }

  // ✔️ AQUÍ ESTABA EL PROBLEMA. ESTA ES LA VERSION CORRECTA:
  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setInfo('');
    setOverrideInfo(null);

    try {
      const payload = {
        spaceId: Number(form.spaceId),
        date: form.date,
        startTime: form.startTime,
        endTime: form.endTime,
      };

      if (isEditMode) {
        await api.put(`/reservations/${editId}`, payload);
        setInfo('Reserva actualizada correctamente');
      } else {
        await api.post('/reservations', payload);
        setInfo('Reserva creada correctamente');
      }

      navigate('/user/reservas');
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      const defaultMsg = isEditMode
        ? 'Error al actualizar la reserva'
        : 'Error al crear la reserva';

      setError(data?.message || defaultMsg);

      // 👉 SI EL BACKEND PERMITE SOLICITAR EXCEPCIÓN
      if (data?.canRequestOverride) {
        setOverrideInfo({
          spaceId: Number(form.spaceId),
          date: form.date,
          startTime: form.startTime,
          endTime: form.endTime,
          limitCode: data.code,
          limitMessage: data.message,
        });
        setShowOverrideModal(true);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleCloseOverrideModal() {
    setShowOverrideModal(false);
  }

  async function handleSendOverride() {
    if (!overrideInfo) return;

    try {
      setSendingOverride(true);

      const res = await api.post(
        '/reservations/limit-override-request',
        overrideInfo
      );

      setInfo(
        res.data?.message ||
          'Tu solicitud fue enviada al administrador. Te contactará pronto.'
      );
      setError('');
      setShowOverrideModal(false);
      setOverrideInfo(null);
    } catch (err) {
      console.error(err);
      setError(
        err.response?.data?.message ||
          'Hubo un problema al enviar la solicitud al administrador.'
      );
    } finally {
      setSendingOverride(false);
    }
  }

  if (loadingSpaces) {
    return (
      <div>
        <Header user={user} />
        <div style={{ padding: '2rem 1rem' }}>Cargando espacios...</div>
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
        {/* ENCABEZADO */}
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
            <h1 style={{ marginBottom: '0.25rem' }}>
              {isEditMode ? 'Editar reserva' : 'Agendar una reserva'}
            </h1>
            <span style={{ fontSize: '0.85rem', color: '#6b7280' }}>
              {isEditMode
                ? 'Modifica la fecha, franja horaria o espacio de tu reserva'
                : 'Elige fecha, franja horaria y espacio de Conworking Sinergia'}
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

        {/* MENSAJES */}
        {error && (
          <div
            className="error"
            style={{
              width: '75vw',
              maxWidth: '960px',
              margin: '0 auto 0.5rem',
            }}
          >
            <div>{error}</div>

            {/* BOTON PARA REABRIR EL MODAL */}
            {overrideInfo && (
              <button
                onClick={() => setShowOverrideModal(true)}
                style={{
                  marginTop: '0.5rem',
                  padding: '0.4rem 0.9rem',
                  borderRadius: '999px',
                  border: 'none',
                  backgroundColor: '#f59e0b',
                  color: 'white',
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                }}
              >
                Solicitar más al administrador
              </button>
            )}
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

        {/* FORM CARD */}
        <div
          className="admin-card"
          style={{
            width: '75vw',
            maxWidth: '960px',
            padding: '2rem',
          }}
        >
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
              {saving
                ? isEditMode
                  ? 'Guardando cambios...'
                  : 'Creando reserva...'
                : isEditMode
                ? 'Guardar cambios'
                : 'Reservar'}
            </button>
          </form>
        </div>
      </div>

      {/* MODAL SEPARADO */}
      <LimitOverrideModal
        open={showOverrideModal}
        info={overrideInfo}
        loading={sendingOverride}
        onClose={handleCloseOverrideModal}
        onConfirm={handleSendOverride}
      />
    </div>
  );
}
