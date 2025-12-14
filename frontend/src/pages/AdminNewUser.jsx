import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../api/axiosClient';
import Layout from '../components/Layout';

export default function AdminNewUser() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEditMode = id && id !== 'nuevo';

  const [form, setForm] = useState({
    name: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'CLIENT',
    classify: 'GOOD', // ✅ NUEVO: para mostrar/editar classify
    active: true,
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [history, setHistory] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  useEffect(() => {
    if (isEditMode) {
      loadUserAndHistory();
    } else {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadUserAndHistory = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      // Detalle de usuario (sin password)
      const userRes = await api.get(`/users/${id}`);
      const user = userRes.data;

      setForm({
        name: user.name || '',
        lastName: user.lastName || '',
        email: user.email || '',
        phone: user.phone || '',
        role: user.role || 'CLIENT',
        classify: user.classify ?? '', // ✅ FIX: si viene null/undefined queda vacío
        active: user.active ?? true,
      });

      // Historia de cambios
      setLoadingHistory(true);
      try {
        const historyRes = await api.get(`/users/${id}/history`);
        setHistory(historyRes.data || []);
      } catch (historyErr) {
        console.error('Error cargando history', historyErr);
        // No es crítico
      } finally {
        setLoadingHistory(false);
      }
    } catch (err) {
      console.error(err);
      setError('No se pudo cargar el usuario.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      if (isEditMode) {
        await api.put(`/users/${id}`, {
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          role: form.role,
          classify: form.classify || null, // ✅ NUEVO: enviar classify
          active: form.active,
        });

        setSuccess('Usuario actualizado correctamente.');
        await loadUserAndHistory();
      } else {
        const res = await api.post('/users', {
          name: form.name,
          lastName: form.lastName,
          email: form.email,
          phone: form.phone,
          role: form.role,
          // Para usuario nuevo, el backend debería generar clave temporal
          // o requerir otro flujo. Aquí NO manejamos password.
        });

        setSuccess('Usuario creado correctamente.');
        const created = res.data;
        if (created && created.id) {
          navigate(`/admin/usuarios/${created.id}`, { replace: true });
        }
      }
    } catch (err) {
      console.error(err);
      const msg =
        err?.response?.data?.message ||
        (isEditMode
          ? 'No se pudo actualizar el usuario.'
          : 'No se pudo crear el usuario.');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="admin-page">
        <div
          className="admin-page-header"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <h1>{isEditMode ? 'Detalle de usuario' : 'Nuevo usuario'}</h1>
            <p className="admin-page-subtitle">
              {isEditMode
                ? 'Consulta y modifica los datos del usuario. La contraseña no es visible ni editable.'
                : 'Crea un nuevo usuario del coworking. La contraseña se gestionará por un flujo separado.'}
            </p>
          </div>
          <button
            type="button"
            className="admin-button-outline"
            onClick={() => navigate('/admin/usuarios')}
          >
            ← Volver
          </button>
        </div>

        {error && (
          <div
            className="admin-card"
            style={{
              marginBottom: '1rem',
              borderLeft: '4px solid #f97373',
            }}
          >
            <p style={{ color: '#b91c1c', margin: 0 }}>{error}</p>
          </div>
        )}

        {success && (
          <div
            className="admin-card"
            style={{
              marginBottom: '1rem',
              borderLeft: '4px solid #4ade80',
            }}
          >
            <p style={{ color: '#166534', margin: 0 }}>{success}</p>
          </div>
        )}

        {loading ? (
          <div className="admin-card">
            <p>Cargando datos del usuario...</p>
          </div>
        ) : (
          <div className="admin-card" style={{ marginBottom: '1.5rem' }}>
            <form onSubmit={handleSubmit} className="admin-form">
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '1rem',
                }}
              >
                <div>
                  <label className="admin-label">Nombre</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={form.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="admin-label">Apellido</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={form.lastName}
                    onChange={(e) => handleChange('lastName', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="admin-label">Email</label>
                  <input
                    type="email"
                    className="admin-input"
                    value={form.email}
                    onChange={(e) => handleChange('email', e.target.value)}
                    required
                  />
                </div>

                <div>
                  <label className="admin-label">Teléfono</label>
                  <input
                    type="text"
                    className="admin-input"
                    value={form.phone}
                    onChange={(e) => handleChange('phone', e.target.value)}
                  />
                </div>

                <div>
                  <label className="admin-label">Rol</label>
                  <select
                    className="admin-input"
                    value={form.role}
                    onChange={(e) => handleChange('role', e.target.value)}
                  >
                    <option value="CLIENT">Cliente</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                {/* ✅ NUEVO: Classify (solo visible en edición) */}
                {isEditMode && (
                  <div>
                    <label className="admin-label">Classify</label>
                    <select
                      className="admin-input"
                      value={form.classify}
                      onChange={(e) => handleChange('classify', e.target.value)}
                    >
                      <option value="">(Sin clasificar)</option>
                      <option value="GOOD">Good</option>
                      <option value="REGULAR">Regular</option>
                      <option value="BAD">Bad</option>
                    </select>
                    <div
                      style={{
                        marginTop: 6,
                        fontSize: '0.8rem',
                        color: '#6b7280',
                      }}
                    >
                      Solo visible para administradores.
                    </div>
                  </div>
                )}

                {isEditMode && (
                  <div>
                    <label className="admin-label">Estado</label>
                    <select
                      className="admin-input"
                      value={form.active ? 'ACTIVE' : 'INACTIVE'}
                      onChange={(e) =>
                        handleChange('active', e.target.value === 'ACTIVE')
                      }
                    >
                      <option value="ACTIVE">Activo</option>
                      <option value="INACTIVE">Inactivo</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Nota: no mostramos ni gestionamos password */}
              <div
                style={{
                  marginTop: '1rem',
                  fontSize: '0.8rem',
                  color: '#6b7280',
                }}
              >
                La contraseña del usuario no se muestra ni se edita desde esta
                pantalla.
              </div>

              <div style={{ marginTop: '1.25rem', textAlign: 'right' }}>
                <button type="submit" className="admin-button" disabled={saving}>
                  {saving
                    ? isEditMode
                      ? 'Guardando cambios...'
                      : 'Creando usuario...'
                    : isEditMode
                    ? 'Guardar cambios'
                    : 'Crear usuario'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Historial de cambios */}
        {isEditMode && (
          <div className="admin-card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.75rem',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '1rem' }}>Historial de cambios</h2>
              {loadingHistory && (
                <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
                  Cargando historial...
                </span>
              )}
            </div>

            {history && history.length > 0 ? (
              <div className="admin-table-wrapper">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Campo</th>
                      <th>Valor anterior</th>
                      <th>Valor nuevo</th>
                      <th>Modificado por</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td>{new Date(h.createdAt).toLocaleString()}</td>
                        <td>{h.field}</td>
                        <td>{h.oldValue ?? '-'}</td>
                        <td>{h.newValue ?? '-'}</td>
                        <td>{h.changedByName || h.changedBy || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: '0.9rem', color: '#6b7280' }}>
                {loadingHistory
                  ? 'Cargando...'
                  : 'Aún no hay registros de cambios para este usuario.'}
              </p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
}
