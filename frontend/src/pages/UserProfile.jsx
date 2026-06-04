import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';
import { acceptConsent, consentDocumentUrl, getActiveConsents } from '../api/consents';
import ClientLayout from '../portals/client/layout/ClientLayout';

function getInitials(name, lastName) {
  const a = (name || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  return (a + b).toUpperCase();
}

function formatConsentDate(value) {
  if (!value) return 'No disponible todavía';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'No disponible todavía';
  return date.toLocaleString('es-ES', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getConsentStatus(user, acceptedKeys = [], dateKeys = []) {
  const accepted = acceptedKeys.some((key) => user?.[key] === true);
  const acceptedAt = dateKeys.map((key) => user?.[key]).find(Boolean);

  return {
    accepted: accepted || Boolean(acceptedAt),
    acceptedAt,
  };
}

export default function UserProfile() {
  const navigate = useNavigate();

  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const [error, setError]       = useState('');
  const [notice, setNotice]     = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser]         = useState(null);
  const [activeConsents, setActiveConsents] = useState([]);
  const [savingConsentId, setSavingConsentId] = useState(null);

  const [maternalLastName, setMaternalLastName] = useState('');
  const [phone, setPhone]                       = useState('');

  const initials  = useMemo(() => (user ? getInitials(user.name, user.lastName) : ''), [user]);
  const roleLabel = useMemo(() => (user?.role === 'ADMIN' ? 'Administrador' : 'Cliente'), [user]);

  const termsConsent = useMemo(() => getConsentStatus(
    user,
    ['termsAccepted', 'acceptedTerms', 'termsAndConditionsAccepted'],
    ['termsAcceptedAt', 'acceptedTermsAt', 'termsAndConditionsAcceptedAt']
  ), [user]);

  const commercialConsent = useMemo(() => getConsentStatus(
    user,
    ['commercialConsentAccepted', 'marketingConsentAccepted', 'acceptsCommercialNotifications'],
    ['commercialConsentAcceptedAt', 'marketingConsentAcceptedAt', 'commercialNotificationsAcceptedAt']
  ), [user]);

  const socialConsent = useMemo(() => getConsentStatus(
    user,
    ['socialConsentAccepted', 'socialNotificationsAccepted', 'acceptsSocialNotifications'],
    ['socialConsentAcceptedAt', 'socialNotificationsAcceptedAt']
  ), [user]);

  useEffect(() => {
    let mounted = true;
    async function load() {
      setLoading(true); setError(''); setNotice('');
      try {
        const [{ data }, consentsResponse] = await Promise.all([
          api.get('/users/me'),
          getActiveConsents().catch(() => ({ data: [] })),
        ]);
        if (!mounted) return;
        setUser(data);
        setActiveConsents(Array.isArray(consentsResponse.data) ? consentsResponse.data : []);
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


  async function onAcceptConsent(consent) {
    if (!consent?.id) return;
    const ok = window.confirm(`Confirmás la aceptación de: ${consent.title} (${consent.version})`);
    if (!ok) return;
    setSavingConsentId(consent.id);
    setError('');
    setNotice('');
    try {
      await acceptConsent(consent.id, true);
      const { data } = await getActiveConsents();
      setActiveConsents(Array.isArray(data) ? data : []);
      setNotice('Aceptación registrada correctamente.');
    } catch (e) {
      setError(e?.response?.data?.message || 'No se pudo registrar la aceptación.');
    } finally {
      setSavingConsentId(null);
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


              <div className="sn-card sn-profile-right sn-consent-card">
                <div className="sn-profile-card-head">
                  <div>
                    <div className="sn-profile-card-title">Consentimientos</div>
                    <div className="sn-profile-card-sub">Aceptá términos, políticas y permisos de comunicación vigentes.</div>
                  </div>
                </div>

                {activeConsents.length === 0 ? (
                  <div className="sn-empty">
                    <strong>No hay consentimientos activos</strong>
                    <p>Cuando el coworking publique términos o permisos, aparecerán aquí.</p>
                  </div>
                ) : (
                  <div className="sn-consent-list">
                    {activeConsents.map((consent) => {
                      const accepted = consent.userAcceptance?.accepted === true
                        && consent.userAcceptance?.consentVersion === consent.version;
                      return (
                        <div className="sn-consent-item" key={consent.id}>
                          <div className="sn-consent-item-head">
                            <div>
                              <h4>{consent.title}</h4>
                              <p>{consent.description || `Versión ${consent.version}`}</p>
                            </div>
                            <span className={`sn-user-consent-badge ${accepted ? 'is-accepted' : 'is-pending'}`}>
                              {accepted ? 'Aceptado' : (consent.required ? 'Obligatorio' : 'Opcional')}
                            </span>
                          </div>

                          {consent.showDocumentsToUser !== false && consent.documents?.length > 0 && (
                            <div className="sn-consent-docs">
                              {consent.documents.filter((doc) => doc.active).map((doc) => (
                                <a key={doc.id} href={consentDocumentUrl(doc.id)} target="_blank" rel="noreferrer">
                                  Descargar {doc.title || doc.fileName}
                                </a>
                              ))}
                            </div>
                          )}

                          <div className="sn-consent-actions">
                            <label className="sn-consent-checkbox">
                              <input type="checkbox" checked={accepted} readOnly />
                              <span>{accepted ? `Aceptado el ${formatConsentDate(consent.userAcceptance?.acceptedAt)}` : 'Declaro que leí y acepto este consentimiento.'}</span>
                            </label>
                            {!accepted && (
                              <button
                                type="button"
                                className="sn-btn sn-btn--primary sn-btn--sm"
                                onClick={() => onAcceptConsent(consent)}
                                disabled={savingConsentId === consent.id}
                              >
                                {savingConsentId === consent.id ? 'Registrando…' : 'Aceptar'}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
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
