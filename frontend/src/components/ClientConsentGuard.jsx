import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getActiveConsents } from '../api/consents';

function isConsentAccepted(consent) {
  return consent?.userAcceptance?.accepted === true
    && consent?.userAcceptance?.consentVersion === consent?.version;
}

function isRequiredPending(consent) {
  return consent?.active !== false
    && consent?.required === true
    && consent?.requiresAcceptance !== false
    && !isConsentAccepted(consent);
}

export default function ClientConsentGuard({ children }) {
  const location = useLocation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pendingRequired, setPendingRequired] = useState([]);

  const isProfileRoute = useMemo(() => {
    return location.pathname === '/user/perfil';
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    async function loadRequiredConsents() {
      setLoading(true);
      setError('');
      try {
        const { data } = await getActiveConsents();
        if (!mounted) return;
        const pending = Array.isArray(data) ? data.filter(isRequiredPending) : [];
        setPendingRequired(pending);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || 'No se pudieron validar los consentimientos.');
        setPendingRequired([]);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadRequiredConsents();
    return () => { mounted = false; };
  }, [location.pathname]);

  if (loading) {
    return (
      <div className="client-consent-loading">
        Validando consentimientos…
      </div>
    );
  }

  // Si falla la validación, no bloqueamos la app para evitar dejar al usuario sin acceso.
  // El perfil seguirá mostrando los consentimientos cuando el endpoint responda correctamente.
  if (error) return children;

  if (pendingRequired.length > 0 && !isProfileRoute) {
    return <Navigate to="/user/perfil" replace state={{ consentLock: true, from: location.pathname }} />;
  }

  return children;
}
