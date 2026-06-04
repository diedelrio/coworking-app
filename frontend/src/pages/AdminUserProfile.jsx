import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiKey, FiShield, FiTag, FiUser } from 'react-icons/fi';
import { TbLockCheck } from 'react-icons/tb';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import TagsChipsInput from '../components/TagsChipsInput';

function getInitials(name, lastName, email) {
  const first = (name || '').trim()[0] || '';
  const last = (lastName || '').trim()[0] || '';
  if (first || last) return (first + last).toUpperCase();
  const e = (email || '').trim()[0] || '';
  return (e || 'U').toUpperCase();
}

function getDisplayName(user) {
  return `${user?.name || ''} ${user?.lastName || ''}`.trim() || 'Sin nombre';
}

export default function AdminUserProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = Number(id);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);

  const [name, setName] = useState('');
  const [lastName, setLastName] = useState('');
  const [maternalLastName, setMaternalLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState('CLIENT');
  const [classify, setClassify] = useState('GOOD');
  const [active, setActive] = useState(true);

  const [allTags, setAllTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);

  const initials = useMemo(() => getInitials(user?.name, user?.lastName, user?.email), [user]);
  const displayName = useMemo(() => getDisplayName(user), [user]);

  function hydrateForm(u) {
    setName(u?.name || '');
    setLastName(u?.lastName || '');
    setMaternalLastName(u?.maternalLastName || '');
    setEmail(u?.email || '');
    setPhone(u?.phone || '');
    setRole(u?.role || 'CLIENT');
    setClassify(u?.classify || 'GOOD');
    setActive(Boolean(u?.active));

    const ids = (u?.userTags || [])
      .map((ut) => ut?.tag?.id)
      .filter((x) => Number.isFinite(x));
    setSelectedTagIds(ids);
  }

  useEffect(() => {
    let mounted = true;

    async function loadTags() {
      try {
        const { data } = await api.get('/admin/tags');
        if (!mounted) return;
        setAllTags((Array.isArray(data) ? data : []).sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      } catch (e) {
        console.warn('No se pudieron cargar tags', e);
        if (mounted) setAllTags([]);
      }
    }

    loadTags();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function loadUser() {
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
        if (mounted) setError(e?.response?.data?.message || 'No se pudo cargar el usuario.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    if (!Number.isFinite(userId)) {
      setLoading(false);
      setError('ID inválido.');
      return;
    }

    loadUser();
    return () => {
      mounted = false;
    };
  }, [userId]);

  async function createTag({ name: tagName, slug }) {
    const cleanSlug = String(slug || '').trim();
    const cleanName = String(tagName || '').trim() || cleanSlug;
    if (!cleanSlug) return null;

    const existing = allTags.find((t) => String(t.slug).toLowerCase() === cleanSlug.toLowerCase());
    if (existing) return existing;

    try {
      const { data } = await api.post('/admin/tags', { name: cleanName, slug: cleanSlug });
      const created = data?.id ? data : null;
      if (created) setAllTags((prev) => [...prev, created].sort((a, b) => (a.name || '').localeCompare(b.name || '')));
      return created;
    } catch (_) {
      try {
        const { data } = await api.get('/admin/tags');
        const list = Array.isArray(data) ? data : [];
        setAllTags(list.sort((a, b) => (a.name || '').localeCompare(b.name || '')));
        return list.find((t) => String(t.slug).toLowerCase() === cleanSlug.toLowerCase()) || null;
      } catch (e) {
        return null;
      }
    }
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
        tagIds: selectedTagIds,
      });

      setUser(data);
      hydrateForm(data);
      setNotice('Perfil actualizado correctamente.');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo actualizar el usuario.');
    } finally {
      setSaving(false);
    }
  }

  function onCancel() {
    setError('');
    setNotice('');
    if (user) hydrateForm(user);
  }

  async function onResetPassword() {
    setError('');
    setNotice('');

    const ok = window.confirm('Esto enviará un email de recuperación de contraseña al usuario. ¿Continuar?');
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

    const ok = window.confirm('¿Seguro que querés bloquear/desactivar esta cuenta?');
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
        tagIds: selectedTagIds,
      });

      setUser(data);
      hydrateForm(data);
      setNotice('Cuenta bloqueada correctamente.');
    } catch (e) {
      console.error(e);
      setError(e?.response?.data?.message || 'No se pudo bloquear la cuenta.');
    }
  }

  return (
    <Layout>
      <div className="admin-page admin-crm-page admin-user-profile-page">
        <section className="admin-crm-hero admin-crm-hero--compact">
          <div>
            <p className="admin-crm-eyebrow">Usuarios</p>
            <h1>Perfil de Usuario</h1>
            <p>Gestiona información personal, permisos, segmentación y estado de cuenta.</p>
          </div>
          <button type="button" className="admin-crm-secondary" onClick={() => navigate('/admin/usuarios')}>
            <FiArrowLeft /> Volver
          </button>
        </section>

        {error ? <div className="admin-crm-message admin-crm-message--error">{error}</div> : null}
        {notice ? <div className="admin-crm-message admin-crm-message--success">{notice}</div> : null}

        {loading ? (
          <section className="admin-crm-card admin-crm-empty"><FiUser /><strong>Cargando usuario...</strong></section>
        ) : (
          <div className="admin-user-profile-grid">
            <aside className="admin-crm-card admin-user-profile-aside">
              <div className="admin-user-profile-avatar">{initials}</div>
              <strong className="admin-user-profile-name">{displayName}</strong>
              <span className="admin-user-profile-email">{user?.email}</span>
              <span className={`admin-crm-badge ${user?.active ? 'admin-crm-badge--green' : 'admin-crm-badge--red'}`}>
                {user?.active ? 'Activo' : 'Inactivo'}
              </span>

              <div className="admin-user-profile-divider" />

              <button type="button" className="admin-user-profile-action" onClick={onResetPassword} disabled={saving}>
                <FiKey />
                <span><strong>Blanquear contraseña</strong><small>Restablecer credenciales</small></span>
              </button>

              <button type="button" className="admin-user-profile-action admin-user-profile-action--danger" onClick={onBlockAccount} disabled={saving || !active}>
                <TbLockCheck />
                <span><strong>Bloquear cuenta</strong><small>Suspender acceso</small></span>
              </button>
            </aside>

            <div className="admin-user-form-shell admin-user-profile-main">
              <section className="admin-crm-card admin-user-form-card">
                <div className="admin-user-form-section-head">
                  <span className="admin-user-form-icon"><FiUser /></span>
                  <div><h2>Información personal</h2><p>Datos básicos para identificar al usuario.</p></div>
                </div>

                <div className="admin-user-form-grid admin-user-form-grid--three">
                  <label>Nombre *<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" disabled={saving} required /></label>
                  <label>Apellido Paterno *<input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Apellido" disabled={saving} required /></label>
                  <label>Apellido Materno<input value={maternalLastName} onChange={(e) => setMaternalLastName(e.target.value)} placeholder="Apellido" disabled={saving} /></label>
                  <label>Email *<input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="usuario@email.com" disabled={saving} required /></label>
                  <label>Teléfono<input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+34 600 000 000" disabled={saving} /></label>
                </div>
              </section>

              <section className="admin-crm-card admin-user-form-card">
                <div className="admin-user-form-section-head">
                  <span className="admin-user-form-icon"><FiShield /></span>
                  <div><h2>Acceso y estado</h2><p>Rol operativo y disponibilidad de la cuenta.</p></div>
                </div>

                <div className="admin-user-form-grid admin-user-form-grid--three">
                  <label>Rol *<select value={role} onChange={(e) => setRole(e.target.value)} disabled={saving}><option value="CLIENT">Cliente</option><option value="ADMIN">Administrador</option></select></label>
                  <label>Clasificación *<select value={classify} onChange={(e) => setClassify(e.target.value)} disabled={saving}><option value="GOOD">Premium</option><option value="REGULAR">Regular</option><option value="BAD">Bloqueado</option></select></label>
                  <label>Estado *<select value={active ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => setActive(e.target.value === 'ACTIVE')} disabled={saving}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
                </div>
              </section>

              <section className="admin-crm-card admin-user-form-card">
                <div className="admin-user-form-section-head">
                  <span className="admin-user-form-icon"><FiTag /></span>
                  <div><h2>Tags y segmentación</h2><p>Usa tags para filtros, reportes y futuras comunicaciones.</p></div>
                </div>
                <TagsChipsInput
                  availableTags={allTags}
                  selectedIds={selectedTagIds}
                  onChange={setSelectedTagIds}
                  onCreateTag={createTag}
                  disabled={saving}
                />
                <div className="admin-user-profile-hint">Tip: podés usar tags para segmentación y envíos masivos.</div>
              </section>

              <section className="admin-crm-card admin-user-form-card admin-user-compliance-card">
                <div className="admin-user-form-section-head">
                  <span className="admin-user-form-icon"><FiCheckCircle /></span>
                  <div><h2>Consentimientos</h2><p>Preparado para el próximo módulo legal.</p></div>
                </div>
                <div className="admin-user-compliance-grid">
                  <div><strong>Términos y condiciones</strong><span>No disponible todavía</span></div>
                  <div><strong>Comunicaciones comerciales</strong><span>No disponible todavía</span></div>
                  <div><strong>Comunicaciones sociales</strong><span>No disponible todavía</span></div>
                </div>
              </section>

              <div className="admin-user-form-footer admin-user-profile-footer">
                <button type="button" className="admin-crm-secondary" onClick={onCancel} disabled={saving}>Cancelar</button>
                <button type="button" className="admin-crm-primary" onClick={onSave} disabled={saving}>{saving ? 'Guardando...' : 'Guardar cambios'}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
