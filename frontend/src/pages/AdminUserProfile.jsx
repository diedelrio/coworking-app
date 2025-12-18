import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import { FiKey } from "react-icons/fi";
import { TbLockCheck } from "react-icons/tb";


function getInitials(name, lastName, email) {
  const a = (name || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  if (a || b) return (a + b).toUpperCase();
  const e = (email || '').trim()[0] || '';
  return (e || 'U').toUpperCase();
}

export default function AdminUserProfile() {
  const { id } = useParams();
  const userId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [isEditing, setIsEditing] = useState(false);

  const [user, setUser] = useState(null);

  // Form state (editable)
  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [maternalLastName, setMaternalLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');

  const [role, setRole] = useState('CLIENT');
  const [classify, setClassify] = useState('GOOD');
  const [active, setActive] = useState(true);

  const initials = useMemo(() => {
    return getInitials(user?.name, user?.lastName, user?.email);
  }, [user]);

  const displayName = useMemo(() => {
    if (!user) return '';
    return `${user.name || ''} ${user.lastName || ''}`.trim();
  }, [user]);

  function hydrateForm(u) {
    setName(u?.name || '');
    setLastName(u?.lastName || '');
    setMaternalLastName(u?.maternalLastName || '');
    setEmail(u?.email || '');
    setPhone(u?.phone || '');

    setRole(u?.role || 'CLIENT');
    setClassify(u?.classify || 'GOOD');
    setActive(Boolean(u?.active));
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const { data } = await api.get(`/users/${userId}`);
        if (!mounted) return;

        setUser(data);
        hydrateForm(data);
      } catch (e) {
        console.error(e);
        if (!mounted) return;
        setError(e?.response?.data?.message || 'No se pudo cargar el usuario.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (!Number.isFinite(userId)) {
      setLoading(false);
      setError('ID inválido');
      return;
    }

    load();
    return () => {
      mounted = false;
    };
  }, [userId]);

  function onEdit() {
    if (!user) return;
    setError('');
    setNotice('');
    hydrateForm(user);
    setIsEditing(true);
  }

  function onCancel() {
    setError('');
    setNotice('');
    if (user) hydrateForm(user);
    setIsEditing(false);
  }

  async function onSave() {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const { data } = await api.put(`/users/${userId}`, {
        name,
        lastName,
        maternalLastName,
        email,
        phone,
        role,
        classify,
        active,
      });

      setUser(data);
      hydrateForm(data);
      setIsEditing(false);
      setNotice('Perfil actualizado correctamente.');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  async function onResetPassword() {
    setError('');
    setNotice('');

    const ok = window.confirm(
      'Esto enviará un email de recuperación de contraseña al usuario. ¿Continuar?'
    );
    if (!ok) return;

    try {
      await api.post('/auth/forgot-password', { email: user?.email });
      setNotice('Solicitud enviada. El usuario recibirá un email para restablecer contraseña.');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo enviar el email de recuperación.');
    }
  }

  async function onBlockAccount() {
    setError('');
    setNotice('');

    const ok = window.confirm('¿Seguro que querés bloquear (desactivar) esta cuenta?');
    if (!ok) return;

    try {
      const { data } = await api.put(`/users/${userId}`, {
        name: user?.name,
        lastName: user?.lastName,
        maternalLastName: user?.maternalLastName || '',
        email: user?.email,
        phone: user?.phone || '',
        role: user?.role || 'CLIENT',
        classify: user?.classify || 'GOOD',
        active: false,
      });

      setUser(data);
      hydrateForm(data);
      setIsEditing(false);
      setNotice('Cuenta bloqueada correctamente.');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo bloquear la cuenta.');
    }
  }

  return (
    <Layout>
      <div className="page-container profile-page">
        <div className="profile-container">
          <div className="profile-title">
            <h1>Perfil de Usuario</h1>
            <p>Gestiona tu información personal y configuración de cuenta</p>
          </div>

          {loading ? (
            <div className="admin-card">Cargando…</div>
          ) : (
            <div className="profile-grid">
              {/* LEFT CARD */}
              <div className="admin-card profile-left">
                <div className="profile-avatar">
                  <div className="profile-avatar-circle">
                    {initials}
                    <span className="profile-avatar-camera" title="Próximamente">📷</span>
                  </div>
                </div>

                <div className="profile-left-name">{displayName}</div>
                <div className="profile-left-email">{user?.email}</div>

                <div
                  className={
                    user?.active
                      ? 'profile-badge profile-badge-green'
                      : 'profile-badge profile-badge-red'
                  }
                >
                  {user?.active ? 'Activo' : 'Inactivo'}
                </div>

                <div className="profile-left-divider" />

                <button className="profile-action" onClick={onResetPassword}>
                    <div className="profile-action-row">
                        <FiKey className="profile-action-icon" />
                        <div className="profile-action-text">
                            <div className="profile-action-title">Blanquear Contraseña</div>
                            <div className="profile-action-sub">Restablecer credenciales</div>
                        </div>
                    </div>
                </button>

                <button className="profile-action profile-action-danger" onClick={onBlockAccount}>
                    
                    <div className="profile-action-row">
                        <TbLockCheck className="profile-action-icon" />
                        <div className="profile-action-text">
                            <div className="profile-action-title">Bloquear Cuenta</div>
                            <div className="profile-action-sub">Suspender acceso</div>
                        </div>
                    </div>
                </button>
              </div>

              {/* RIGHT STACK */}
              <div className="profile-right-stack">
                {/* Personal info */}
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
                      <button
                        className="pill-button-outline"
                        onClick={onCancel}
                        disabled={saving}
                      >
                        Cancelar
                      </button>
                    )}
                  </div>

                  {error ? <div className="form-error">{error}</div> : null}
                  {notice ? <div className="form-success">{notice}</div> : null}

                  <div className="profile-form-grid">
                    <div className="form-field">
                      <label>Nombres *</label>
                      <input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={!isEditing || saving}
                      />
                    </div>

                    <div className="form-field">
                      <label>Apellido Paterno *</label>
                      <input
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        disabled={!isEditing || saving}
                      />
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
                      <input
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={!isEditing || saving}
                      />
                    </div>

                    <div className="form-field profile-phone">
                      <label>Teléfono *</label>
                      <input
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        disabled={!isEditing || saving}
                        placeholder="+54 11 1234-5678"
                      />
                    </div>
                  </div>
                </div>

                {/* Account settings */}
                <div className="admin-card profile-right">
                  <div className="profile-card-header">
                    <div>
                      <div className="profile-card-title">Configuración de Cuenta</div>
                      <div className="profile-card-subtitle">Permisos y clasificación</div>
                    </div>
                  </div>

                  <div className="profile-form-grid-3">
                    <div className="form-field">
                      <label>Rol *</label>
                      <select
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        disabled={!isEditing || saving}
                      >
                        <option value="ADMIN">Administrador</option>
                        <option value="CLIENT">Cliente</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Clasificación *</label>
                      <select
                        value={classify}
                        onChange={(e) => setClassify(e.target.value)}
                        disabled={!isEditing || saving}
                      >
                        <option value="GOOD">Premium</option>
                        <option value="REGULAR">Regular</option>
                        <option value="BAD">Bloqueado</option>
                      </select>
                    </div>

                    <div className="form-field">
                      <label>Estado *</label>
                      <select
                        value={active ? 'ACTIVE' : 'INACTIVE'}
                        onChange={(e) => setActive(e.target.value === 'ACTIVE')}
                        disabled={!isEditing || saving}
                      >
                        <option value="ACTIVE">Activo</option>
                        <option value="INACTIVE">Inactivo</option>
                      </select>
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
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
