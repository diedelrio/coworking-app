import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import api from '../api/axiosClient';
import Header from '../components/Header';
import { getCurrentUser } from '../utils/auth';
import LimitOverrideModal from '../components/LimitOverrideModal';

/**
 * Modal simple para alertas (pending approval)
 */
function AlertModal({ open, title, description, primaryText = 'Entendido', onPrimary }) {
  if (!open) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.45)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        zIndex: 9999,
      }}
      role="dialog"
      aria-modal="true"
    >
      <div
        style={{
          width: '100%',
          maxWidth: 520,
          background: 'white',
          borderRadius: 16,
          padding: '1rem',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
          <div>
            <h3 style={{ margin: 0 }}>{title}</h3>
          </div>
          <button
            onClick={onPrimary}
            style={{
              border: 'none',
              background: 'transparent',
              fontSize: 18,
              cursor: 'pointer',
              lineHeight: 1,
            }}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </div>

        <div style={{ marginTop: '0.75rem', color: '#374151', lineHeight: 1.45, whiteSpace: 'pre-line' }}>
          {description}
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
          <button
            onClick={onPrimary}
            style={{
              padding: '0.65rem 1rem',
              borderRadius: 12,
              border: 'none',
              background: '#111827',
              color: 'white',
              fontWeight: 900,
              cursor: 'pointer',
              height: 44,
            }}
          >
            {primaryText}
          </button>
        </div>
      </div>
    </div>
  );
}

function isPendingApprovalResponse(data) {
  const status = String(data?.status || '').toUpperCase();
  const alertKey = String(data?.alertKey || '').toLowerCase();

  // Si el status es PENDING, o si alertKey es 'reservation_pending_approval' (compatibilidad)
  return status === 'PENDING' || alertKey === 'reservation_pending_approval';
}

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

  // Estados del modal de override
  const [overrideInfo, setOverrideInfo] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [sendingOverride, setSendingOverride] = useState(false);

  // Estados del popup de pending approval
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [alertTitle, setAlertTitle] = useState('');
  const [alertDesc, setAlertDesc] = useState('');

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

          const startStr = `${String(startObj.getHours()).padStart(2, '0')}:${String(
            startObj.getMinutes()
          ).padStart(2, '0')}`;

          const endStr = `${String(endObj.getHours()).padStart(2, '0')}:${String(
            endObj.getMinutes()
          ).padStart(2, '0')}`;

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

  function openPendingApprovalPopup() {
    setAlertTitle('Reserva pendiente de confirmación');
    setAlertDesc(
      'Tu solicitud de reserva fue registrada correctamente, pero requiere confirmación por parte del equipo del coworking.\n\n' +
        'Te avisaremos cuando la reserva sea confirmada o rechazada. Mientras tanto, podés verla en la sección “Mis reservas” con estado Pendiente.'
    );
    setShowAlertModal(true);
  }

  // ✅ Submit final: mantiene override, agrega alertKey pending approval
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
        navigate('/user/reservas');
        return;
      }

      const res = await api.post('/reservations', payload);

      // ✅ Nuevo flujo: si pending => popup
      if (isPendingApprovalResponse(res.data)) {
        openPendingApprovalPopup();
        return; // no navegar aún
      }

      setInfo('Reserva creada correctamente');
      navigate('/user/reservas');
    } catch (err) {
      console.error(err);
      const data = err.response?.data;
      const defaultMsg = isEditMode
        ? 'Error al actualizar la reserva'
        : 'Error al crear la reserva';

      setError(data?.message || defaultMsg);

      // ✅ Mantiene tu lógica de solicitar excepción
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

      const res = await api.post('/reservations/limit-override-request', overrideInfo);

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

  function handleCloseAlertModal() {
    setShowAlertModal(false);
    navigate('/user/reservas'); // ✅ a MIS RESERVAS (no /user/reservar)
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
                : 'Elige fecha, franja horaria y espacio de Coworking Sinergia'}
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

      {/* MODAL DE EXCEPCIÓN */}
      <LimitOverrideModal
        open={showOverrideModal}
        info={overrideInfo}
        loading={sendingOverride}
        onClose={handleCloseOverrideModal}
        onConfirm={handleSendOverride}
      />

      {/* POPUP DE PENDING APPROVAL */}
      <AlertModal
        open={showAlertModal}
        title={alertTitle}
        description={alertDesc}
        primaryText="Entendido"
        onPrimary={handleCloseAlertModal}
      />
    </div>
  );
}
