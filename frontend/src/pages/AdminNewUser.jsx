import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiArrowLeft, FiCheckCircle, FiShield, FiTag, FiUser } from 'react-icons/fi';
import api from '../api/axiosClient';
import Layout from '../components/Layout';
import TagsMultiSelect from '../components/TagsMultiSelect';

const EMPTY_FORM = {
  name: '',
  lastName: '',
  email: '',
  phone: '',
  role: 'CLIENT',
  classify: 'GOOD',
  active: true,
};

export default function AdminNewUser() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEditMode = id && id !== 'nuevo';

  const [form, setForm] = useState(EMPTY_FORM);
  const [availableTags, setAvailableTags] = useState([]);
  const [selectedTagIds, setSelectedTagIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        setLoading(true);
        setError('');
        setSuccess('');

        const tagsRes = await api.get('/admin/tags');
        if (!mounted) return;
        setAvailableTags(Array.isArray(tagsRes.data) ? tagsRes.data : []);

        if (isEditMode) {
          const userRes = await api.get(`/users/${id}`);
          if (!mounted) return;
          const user = userRes.data || {};
          setForm({
            name: user.name || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
            role: user.role || 'CLIENT',
            classify: user.classify || 'GOOD',
            active: user.active ?? true,
          });
          const ids = Array.isArray(user.userTags)
            ? user.userTags.map((ut) => ut?.tag?.id).filter((x) => Number.isFinite(x))
            : [];
          setSelectedTagIds(ids);
        }
      } catch (err) {
        console.error(err);
        if (!mounted) return;
        setError(isEditMode ? 'No se pudo cargar el usuario.' : 'No se pudieron cargar los datos iniciales.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    load();
    return () => {
      mounted = false;
    };
  }, [id, isEditMode]);

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: form.name,
        lastName: form.lastName,
        email: form.email,
        phone: form.phone,
        role: form.role,
        classify: form.classify || null,
        active: form.active,
        tagIds: selectedTagIds,
      };

      if (isEditMode) {
        await api.put(`/users/${id}`, payload);
        setSuccess('Usuario actualizado correctamente.');
      } else {
        const res = await api.post('/users', payload);
        setSuccess('Usuario creado correctamente.');
        const created = res.data;
        if (created?.id) navigate(`/admin/usuarios/${created.id}`, { replace: true });
      }
    } catch (err) {
      console.error(err);
      setError(err?.response?.data?.message || (isEditMode ? 'No se pudo actualizar el usuario.' : 'No se pudo crear el usuario.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Layout>
      <div className="admin-page admin-crm-page admin-user-form-page">
        <section className="admin-crm-hero admin-crm-hero--compact">
          <div>
            <p className="admin-crm-eyebrow">Usuarios</p>
            <h1>{isEditMode ? 'Editar usuario' : 'Nuevo usuario'}</h1>
            <p>{isEditMode ? 'Actualiza datos, permisos, clasificación y tags.' : 'Crea una nueva cuenta y deja preparada su segmentación administrativa.'}</p>
          </div>
          <button type="button" className="admin-crm-secondary" onClick={() => navigate('/admin/usuarios')}>
            <FiArrowLeft /> Volver
          </button>
        </section>

        {error ? <div className="admin-crm-message admin-crm-message--error">{error}</div> : null}
        {success ? <div className="admin-crm-message admin-crm-message--success">{success}</div> : null}

        {loading ? (
          <section className="admin-crm-card admin-crm-empty"><FiUser /><strong>Cargando usuario...</strong></section>
        ) : (
          <form onSubmit={handleSubmit} className="admin-user-form-shell">
            <section className="admin-crm-card admin-user-form-card">
              <div className="admin-user-form-section-head">
                <span className="admin-user-form-icon"><FiUser /></span>
                <div><h2>Información personal</h2><p>Datos básicos para identificar al usuario.</p></div>
              </div>

              <div className="admin-user-form-grid">
                <label>Nombre *<input value={form.name} onChange={(e) => handleChange('name', e.target.value)} placeholder="Nombre" required /></label>
                <label>Apellido *<input value={form.lastName} onChange={(e) => handleChange('lastName', e.target.value)} placeholder="Apellido" required /></label>
                <label>Email *<input type="email" value={form.email} onChange={(e) => handleChange('email', e.target.value)} placeholder="usuario@email.com" required /></label>
                <label>Teléfono<input value={form.phone} onChange={(e) => handleChange('phone', e.target.value)} placeholder="+34 600 000 000" /></label>
              </div>
            </section>

            <section className="admin-crm-card admin-user-form-card">
              <div className="admin-user-form-section-head">
                <span className="admin-user-form-icon"><FiShield /></span>
                <div><h2>Acceso y estado</h2><p>Rol operativo y disponibilidad de la cuenta.</p></div>
              </div>

              <div className="admin-user-form-grid admin-user-form-grid--three">
                <label>Rol *<select value={form.role} onChange={(e) => handleChange('role', e.target.value)}><option value="CLIENT">Cliente</option><option value="ADMIN">Administrador</option></select></label>
                <label>Clasificación *<select value={form.classify} onChange={(e) => handleChange('classify', e.target.value)}><option value="GOOD">Premium</option><option value="REGULAR">Regular</option><option value="BAD">Bloqueado</option></select></label>
                <label>Estado *<select value={form.active ? 'ACTIVE' : 'INACTIVE'} onChange={(e) => handleChange('active', e.target.value === 'ACTIVE')}><option value="ACTIVE">Activo</option><option value="INACTIVE">Inactivo</option></select></label>
              </div>
            </section>

            <section className="admin-crm-card admin-user-form-card">
              <div className="admin-user-form-section-head">
                <span className="admin-user-form-icon"><FiTag /></span>
                <div><h2>Tags y segmentación</h2><p>Usa tags para filtros, reportes y futuras comunicaciones.</p></div>
              </div>
              <TagsMultiSelect tags={availableTags} value={selectedTagIds} onChange={setSelectedTagIds} showLabel={false} disabled={saving} />
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

            <div className="admin-user-form-footer">
              <button type="button" className="admin-crm-secondary" onClick={() => navigate('/admin/usuarios')} disabled={saving}>Cancelar</button>
              <button type="submit" className="admin-crm-primary" disabled={saving}>{saving ? 'Guardando...' : isEditMode ? 'Guardar cambios' : 'Crear usuario'}</button>
            </div>
          </form>
        )}
      </div>
    </Layout>
  );
}
