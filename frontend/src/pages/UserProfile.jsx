import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import ClientLayout from '../portals/client/layout/ClientLayout';

function getInitials(name, lastName) {
  const a = (name || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  return (a + b).toUpperCase();
}

export default function UserProfile() {
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser]         = useState(null);

  const [maternalLastName, setMaternalLastName] = useState('');
  const [phone, setPhone]                       = useState('');

  const initials  = useMemo(() => (user ? getInitials(user.name, user.lastName) : ''), [user]);
  const roleLabel = useMemo(() => (user?.role === 'ADMIN' ? 'Administrador' : 'Cliente'), [user]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError(''); setNotice('');
      try {
        const { data } = await api.get('/users/me');
        if (!mounted) return;
        setUser(data);
        setMaternalLastName(data.maternalLastName || '');
        setPhone(data.phone || '');
      } catch (e) {
        if (mounted) setError(e?.response?.data?.message || 'No se pudo cargar tu perfil.');
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => { mounted = false; };
  }, []);

  function onEdit() {
    if (!user) return;
    setNotice(''); setError('');
    setMaternalLastName(user.maternalLastName || '');
    setPhone(user.phone || '');
    setIsEditing(true);
  }

  function onCancel() {
    setNotice(''); setError('');
    if (user) { setMaternalLastName(user.maternalLastName || ''); setPhone(user.phone || ''); }
    setIsEditing(false);
  }

  async function onSave() {
    setSaving(true); setError(''); setNotice('');
    try {
      const { data } = await api.patch('/users/me', { maternalLastName, phone });
      setUser(data);
      setIsEditing(false);
      setNotice('Perfil actualizado correctamente.');
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    setError(''); setNotice('');
    const ok = window.confirm('¿Seguro que querés darte de baja? Tu cuenta quedará desactivada.');
    if (!ok) return;
    try {
      await api.patch('/users/me/deactivate');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo desactivar la cuenta.');
    }
  }

  return (
    <ClientLayout user={user}>
      <div className="client-page">

        <div style={{ marginBottom: '1.25rem' }}>
          <span className="sn-eyebrow">Tu cuenta</span>
          <h1 className="sn-page-title">Mi perfil</h1>
          <p className="sn-page-subtitle">Gestioná tu información personal y configuración de cuenta.</p>
        </div>

        {loading ? (
          <div className="sn-card" style={{ padding: '2rem', textAlign: 'center', color: 'var(--sn-muted)', fontWeight: 600 }}>
            Cargando tu perfil…
          </div>
        ) : (
          <div className="sn-profile-grid">

            {/* Left col */}
            <div className="sn-card sn-profile-left">
              <div className="sn-profile-avatar-wrap">{initials}</div>
              <div className="sn-profile-name">{user?.name} {user?.lastName}</div>
              <div className="sn-profile-email">{user?.email}</div>
              <span className="sn-profile-badge">{roleLabel}</span>
              <div className="sn-profile-divider" />

              <button className="sn-profile-action" onClick={() => navigate('/forgot-password')}>
                <div className="sn-profile-action-title">Cambiar contraseña</div>
                <div className="sn-profile-action-sub">Actualizar credenciales</div>
              </button>

              <button className="sn-profile-action sn-profile-action--danger" onClick={onDeactivate}>
                <div className="sn-profile-action-title">Darme de baja</div>
                <div className="sn-profile-action-sub">Desactivar mi cuenta</div>
              </button>
            </div>

            {/* Right col */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="sn-card sn-profile-right">
                <div className="sn-profile-card-head">
                  <div>
                    <div className="sn-profile-card-title">Información personal</div>
                    <div className="sn-profile-card-sub">Datos básicos de tu cuenta</div>
                  </div>
                  {!isEditing
                    ? <button className="sn-btn sn-btn--outline sn-btn--sm" onClick={onEdit}>Editar</button>
                    : <button className="sn-btn sn-btn--outline sn-btn--sm" onClick={onCancel} disabled={saving}>Cancelar</button>
                  }
                </div>

                {error  && <div className="sn-alert sn-alert--error"  style={{ marginBottom: '0.9rem' }}>{error}</div>}
                {notice && <div className="sn-alert sn-alert--success" style={{ marginBottom: '0.9rem' }}>{notice}</div>}

                <div className="sn-form-grid">
                  <div className="sn-field">
                    <label className="sn-label">Nombre *</label>
                    <input className="sn-input" value={user?.name || ''} disabled />
                  </div>
                  <div className="sn-field">
                    <label className="sn-label">Apellido paterno *</label>
                    <input className="sn-input" value={user?.lastName || ''} disabled />
                  </div>
                  <div className="sn-field">
                    <label className="sn-label">Apellido materno</label>
                    <input
                      className="sn-input"
                      value={maternalLastName}
                      onChange={(e) => setMaternalLastName(e.target.value)}
                      disabled={!isEditing || saving}
                      placeholder="(Opcional)"
                    />
                  </div>
                  <div className="sn-field">
                    <label className="sn-label">Email *</label>
                    <input className="sn-input" value={user?.email || ''} disabled />
                  </div>
                  <div className="sn-field full">
                    <label className="sn-label">Teléfono</label>
                    <input
                      className="sn-input"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      disabled={!isEditing || saving}
                      placeholder="+34 600 123 456"
                    />
                  </div>
                </div>

                {isEditing && (
                  <div className="sn-profile-footer">
                    <button className="sn-btn sn-btn--outline" onClick={onCancel} disabled={saving}>Cancelar</button>
                    <button className="sn-btn sn-btn--primary" onClick={onSave} disabled={saving}>
                      {saving ? 'Actualizando…' : 'Guardar cambios'}
                    </button>
                  </div>
                )}
              </div>

              <div className="sn-info-box">
                <strong>ℹ️ Información importante</strong>
                Para cambiar tu contraseña o darte de baja de la plataforma, utiliza las opciones del panel lateral.
              </div>
            </div>

          </div>
        )}
      </div>
    </ClientLayout>
  );
}
