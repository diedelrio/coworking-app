import { useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { getActiveConsents } from '../api/consents';

const CACHE_KEY = 'sinergia.requiredConsents.pending';
const CACHE_TTL_MS = 60 * 1000;

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

function readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed?.timestamp || Date.now() - parsed.timestamp > CACHE_TTL_MS) {
      return null;
    }

    return Array.isArray(parsed.pendingRequired) ? parsed.pendingRequired : [];
  } catch {
    return null;
  }
}

function writeCache(pendingRequired) {
  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify({
      timestamp: Date.now(),
      pendingRequired,
    }));
  } catch {
    // no-op
  }
}

export default function ClientConsentGuard({ children }) {
  const location = useLocation();

  const cachedPending = readCache();

  const [loading, setLoading] = useState(cachedPending === null);
  const [error, setError] = useState('');
  const [pendingRequired, setPendingRequired] = useState(cachedPending || []);

  const isProfileRoute = useMemo(() => {
    return location.pathname === '/user/perfil';
  }, [location.pathname]);

  useEffect(() => {
    let mounted = true;

    async function loadRequiredConsents() {
      if (cachedPending === null) {
        setLoading(true);
      }

      setError('');

      try {
        const { data } = await getActiveConsents();
        if (!mounted) return;

        const pending = Array.isArray(data) ? data.filter(isRequiredPending) : [];
        setPendingRequired(pending);
        writeCache(pending);
      } catch (e) {
        if (!mounted) return;
        setError(e?.response?.data?.message || 'No se pudieron validar los consentimientos.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadRequiredConsents();

    function clearConsentCache() {
      sessionStorage.removeItem(CACHE_KEY);
      loadRequiredConsents();
    }

    window.addEventListener('sinergia:consents-updated', clearConsentCache);

    return () => {
      mounted = false;
      window.removeEventListener('sinergia:consents-updated', clearConsentCache);
    };
  }, []);

  if (loading) {
    return (
      <div className="client-consent-loading">
        Validando consentimientos…
      </div>
    );
  }

  if (error) return children;

  if (pendingRequired.length > 0 && !isProfileRoute) {
    return <Navigate to="/user/perfil" replace state={{ consentLock: true, from: location.pathname }} />;
  }

  return children;
}