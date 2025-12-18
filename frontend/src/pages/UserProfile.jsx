import { useEffect, useMemo, useState } from 'react';

import api from '../api/axiosClient';
import Header from '../components/Header';
import { Link, useNavigate, useLocation } from 'react-router-dom';


function getInitials(name, lastName) {
  const a = (name || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  return (a + b).toUpperCase();
}

function formatPhoneDisplay(phone) {
  return phone || '';
}

export default function UserProfile() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [isEditing, setIsEditing] = useState(false);

  const [user, setUser] = useState(null);

  // Solo editable:
  const [maternalLastName, setMaternalLastName] = useState('');
  const [phone, setPhone] = useState('');

  const initials = useMemo(() => {
    if (!user) return '';
    return getInitials(user.name, user.lastName);
  }, [user]);

  const roleLabel = useMemo(() => {
    if (!user) return '';
    // En tu app usás ADMIN/CLIENT
    return user.role === 'ADMIN' ? 'Administrador' : 'Cliente';
  }, [user]);

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      setNotice('');
      try {
        const { data } = await api.get('/users/me');
        if (!mounted) return;
        setUser(data);
        setMaternalLastName(data.maternalLastName || '');
        setPhone(data.phone || '');
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setError(e?.response?.data?.message || 'No se pudo cargar tu perfil.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, []);

  function onEdit() {
    if (!user) return;
    setNotice('');
    setError('');
    setMaternalLastName(user.maternalLastName || '');
    setPhone(user.phone || '');
    setIsEditing(true);
  }

  function onCancel() {
    setNotice('');
    setError('');
    if (user) {
      setMaternalLastName(user.maternalLastName || '');
      setPhone(user.phone || '');
    }
    setIsEditing(false);
  }

  async function onSave() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const { data } = await api.patch('/users/me', {
        maternalLastName,
        phone,
      });
      setUser(data);
      setIsEditing(false);
      setNotice('Perfil actualizado correctamente.');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo actualizar tu perfil.');
    } finally {
      setSaving(false);
    }
  }

  async function onDeactivate() {
    setError('');
    setNotice('');
    const ok = window.confirm(
      '¿Seguro que querés darte de baja? Tu cuenta quedará desactivada.'
    );
    if (!ok) return;

    try {
      await api.patch('/users/me/deactivate');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/login');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo desactivar la cuenta.');
    }
  }

  function onChangePassword() {
    // Opción más segura sin inventar endpoint:
    // te manda al flujo existente de recuperación/cambio
    navigate('/forgot-password');
  }

  return (
    <>
      <Header />
      <div className="page-container profile-page">
        <div className="profile-container">
            <div className="profile-title">
            <h1>Mi Perfil</h1>
            <p>Gestiona tu información personal y configuración de cuenta</p>
            </div>
            <div className="profile-right-toolbar">
              
              <Link
                to="/user"
                style={{
                  padding: '0.45rem 2rem',
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
            {loading ? (
            <div className="admin-card">Cargando…</div>
            ) : (
            
            <div className="profile-grid">
                {/* Left card */}
                <div className="admin-card profile-left">
                <div className="profile-avatar">
                    <div className="profile-avatar-circle">{initials}</div>
                </div>

                <div className="profile-left-name">{user?.name} {user?.lastName}</div>
                <div className="profile-left-email">{user?.email}</div>

                <div className="profile-badge profile-badge-blue">{roleLabel}</div>

                <div className="profile-left-divider" />

                <button className="profile-action" onClick={onChangePassword}>
                    <div className="profile-action-title">Cambiar Contraseña</div>
                    <div className="profile-action-sub">Actualizar credenciales</div>
                </button>

                <button className="profile-action profile-action-danger" onClick={onDeactivate}>
                    <div className="profile-action-title">Darme de Baja</div>
                    <div className="profile-action-sub">Desactivar mi cuenta</div>
                </button>
                </div>
                    <div className="profile-right-stack">
                        {/* Right card */}
                        <div className="admin-card profile-right">
                        <div className="profile-card-header">
                            <div>
                            <div className="profile-card-title">Información Personal</div>
                            <div className="profile-card-subtitle">Datos básicos de tu cuenta</div>
                            </div>

                            {!isEditing ? (
                            <button className="pill-button-outline" onClick={onEdit}>
                                Editar
                            </button>
                            ) : (
                            <button className="pill-button-outline" onClick={onCancel} disabled={saving}>
                                Cancelar
                            </button>
                            )}
                        </div>

                        {error ? <div className="form-error">{error}</div> : null}
                        {notice ? <div className="form-success">{notice}</div> : null}

                        <div className="profile-form-grid">
                            <div className="form-field">
                            <label>Nombres *</label>
                            <input value={user?.name || ''} disabled />
                            </div>

                            <div className="form-field">
                            <label>Apellido Paterno *</label>
                            <input value={user?.lastName || ''} disabled />
                            </div>

                            <div className="form-field">
                            <label>Apellido Materno</label>
                            <input
                                value={maternalLastName}
                                onChange={(e) => setMaternalLastName(e.target.value)}
                                disabled={!isEditing || saving}
                                placeholder="(Opcional)"
                            />
                            </div>

                            <div className="form-field">
                            <label>Email *</label>
                            <input value={user?.email || ''} disabled />
                            </div>

                            <div className="form-field profile-phone">
                            <label>Teléfono *</label>
                            <input
                                value={formatPhoneDisplay(phone)}
                                onChange={(e) => setPhone(e.target.value)}
                                disabled={!isEditing || saving}
                                placeholder="+54 11 1234-5678"
                            />
                            </div>
                        </div>

                        

                        {isEditing ? (
                            <div className="profile-footer">
                            <button className="pill-button-outline" onClick={onCancel} disabled={saving}>
                                Cancelar
                            </button>
                            <button className="pill-button" onClick={onSave} disabled={saving}>
                                {saving ? 'Actualizando…' : 'Actualizar Perfil'}
                            </button>
                            </div>
                        ) : null}
                        </div>

                        <div className="profile-warning">
                            <div className="profile-warning-title">Información importante</div>
                            <div className="profile-warning-text">
                                Si deseas cambiar tu contraseña o darte de baja de la plataforma, utiliza las opciones disponibles en el panel lateral.
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
      
    </>
  );
}
