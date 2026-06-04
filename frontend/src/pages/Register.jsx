import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../api/axiosClient';

function getConsentTypeLabel(type) {
  const labels = {
    TERMS_AND_POLICIES: 'Términos y políticas',
    COMMERCIAL_COMMUNICATIONS: 'Comunicaciones comerciales',
    SOCIAL_COMMUNICATIONS: 'Comunicaciones sociales',
    OTHER: 'Otro consentimiento',
  };
  return labels[type] || 'Consentimiento';
}

function isConsentAccepted(consent, acceptedMap) {
  if (Object.prototype.hasOwnProperty.call(acceptedMap, consent.id)) {
    return acceptedMap[consent.id] === true;
  }
  return Boolean(consent.defaultAcceptedForNonAdmins);
}

export default function Register() {
  const [name, setName]           = useState('');
  const [lastName, setLastName]   = useState('');
  const [phone, setPhone]         = useState('');
  const [email, setEmail]         = useState('');
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading]     = useState(false);
  const [loadingConsents, setLoadingConsents] = useState(false);
  const [consents, setConsents] = useState([]);
  const [acceptedConsents, setAcceptedConsents] = useState({});
  const [error, setError]         = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    async function loadConsents() {
      setLoadingConsents(true);
      try {
        const { data } = await api.get('/consents/public-active');
        if (!mounted) return;

        const rows = Array.isArray(data) ? data : [];
        setConsents(rows);

        const defaults = {};
        rows.forEach((consent) => {
          defaults[consent.id] = Boolean(consent.defaultAcceptedForNonAdmins);
        });
        setAcceptedConsents(defaults);
      } catch (err) {
        console.error('Error cargando consentimientos públicos', err);
        if (mounted) setError('No se pudieron cargar los consentimientos. Intenta nuevamente.');
      } finally {
        if (mounted) setLoadingConsents(false);
      }
    }

    loadConsents();
    return () => { mounted = false; };
  }, []);

  const requiredConsentsPending = useMemo(() => (
    consents.filter((consent) => consent.required && !isConsentAccepted(consent, acceptedConsents))
  ), [consents, acceptedConsents]);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(''); setSuccessMsg('');
    if (password !== password2) { setError('Las contraseñas no coinciden'); return; }
    if (requiredConsentsPending.length) {
      setError('Debes aceptar los consentimientos obligatorios para crear la cuenta.');
      return;
    }

    setLoading(true);
    try {
      const consentAcceptances = consents.map((consent) => ({
        consentDefinitionId: consent.id,
        consentVersion: consent.version,
        accepted: isConsentAccepted(consent, acceptedConsents),
      }));

      await api.post('/auth/register', { name, lastName, phone, email, password, consentAcceptances });
      setSuccessMsg('Cuenta creada. Redirigiendo al login…');
      setTimeout(() => navigate('/login'), 1500);
    } catch (err) {
      setError(err.response?.data?.message || 'Error al crear la cuenta');
    } finally {
      setLoading(false);
    }
  }

  function toggleConsent(consentId) {
    setAcceptedConsents((prev) => ({ ...prev, [consentId]: !prev[consentId] }));
  }

  return (
    <div className="sn-auth-shell">
      <div className="sn-auth-panel register-auth-panel">
        <div className="sn-auth-card">
          <img src="/logoCoworking.png" alt="Coworking Sinergia" className="sn-auth-logo" />
          <h1>Crear cuenta</h1>
          <p>Regístrate para reservar espacios en el coworking.</p>

          {error      && <div className="sn-alert sn-alert--error"   style={{ marginBottom: '1rem' }}>{error}</div>}
          {successMsg && <div className="sn-alert sn-alert--success" style={{ marginBottom: '1rem' }}>{successMsg}</div>}

          <form onSubmit={handleSubmit} className="register-form-grid">
            <div className="sn-field">
              <label className="sn-label">Nombre *</label>
              <input className="sn-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Juan" required />
            </div>
            <div className="sn-field">
              <label className="sn-label">Apellidos *</label>
              <input className="sn-input" type="text" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="García" required />
            </div>
            <div className="sn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="sn-label">Teléfono <span style={{ fontWeight: 400, color: 'var(--sn-muted)' }}>(opcional)</span></label>
              <input className="sn-input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="600 123 456" />
            </div>
            <div className="sn-field" style={{ gridColumn: '1 / -1' }}>
              <label className="sn-label">Email *</label>
              <input className="sn-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tuemail@ejemplo.com" required autoComplete="email" />
            </div>
            <div className="sn-field">
              <label className="sn-label">Contraseña *</label>
              <input className="sn-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
            </div>
            <div className="sn-field">
              <label className="sn-label">Repetir contraseña *</label>
              <input className="sn-input" type="password" value={password2} onChange={(e) => setPassword2(e.target.value)} placeholder="••••••••" required />
            </div>

            <div className="register-consents-panel">
              <div className="register-consents-head">
                <strong>Consentimientos</strong>
                <span>{loadingConsents ? 'Cargando…' : `${consents.length} activo${consents.length === 1 ? '' : 's'}`}</span>
              </div>

              {loadingConsents && <p className="register-consents-empty">Cargando consentimientos vigentes…</p>}

              {!loadingConsents && !consents.length && (
                <p className="register-consents-empty">No hay consentimientos activos para aceptar.</p>
              )}

              {!loadingConsents && consents.map((consent) => {
                const accepted = isConsentAccepted(consent, acceptedConsents);
                const documents = (consent.documents || []).filter((doc) => doc.active);

                return (
                  <label key={consent.id} className={`register-consent-item ${consent.required ? 'is-required' : ''}`}>
                    <input
                      type="checkbox"
                      checked={accepted}
                      onChange={() => toggleConsent(consent.id)}
                    />
                    <span className="register-consent-content">
                      <span className="register-consent-title-row">
                        <strong>{consent.title}</strong>
                        <em>{consent.required ? 'Obligatorio' : 'Opcional'}</em>
                      </span>
                      <span className="register-consent-meta">
                        {getConsentTypeLabel(consent.type)} · Versión {consent.version}
                        {consent.defaultAcceptedForNonAdmins ? ' · Marcado por defecto' : ''}
                      </span>
                      {consent.description && <span className="register-consent-desc">{consent.description}</span>}
                      {consent.showDocumentsToUser && documents.length > 0 && (
                        <span className="register-consent-docs">
                          {documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={`${api.defaults.baseURL || ''}/consents/public-documents/${doc.id}/download`}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(event) => event.stopPropagation()}
                            >
                              {doc.title || doc.fileName}
                            </a>
                          ))}
                        </span>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <button className="sn-auth-btn" type="submit" disabled={loading || loadingConsents}>
                {loading ? 'Creando cuenta…' : 'Crear cuenta'}
              </button>
            </div>
          </form>

          <div className="sn-auth-links" style={{ justifyContent: 'center' }}>
            <Link className="sn-auth-link" to="/login">Ya tengo cuenta → Iniciar sesión</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
