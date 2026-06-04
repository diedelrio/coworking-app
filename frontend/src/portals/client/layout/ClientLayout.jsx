import { useEffect, useMemo, useState } from 'react';
import ClientHeader from './ClientHeader';
import ClientSidebar from './ClientSidebar';
import ClientBottomNav from './ClientBottomNav';
import { getActiveConsents } from '../../../api/consents';
import './clientLayout.css';
import './consentLock.css';
import GlobalPopupMessages from '../../../components/GlobalPopupMessages';

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

export default function ClientLayout({ children, user }) {
  const [pendingRequiredConsents, setPendingRequiredConsents] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadConsentLockState() {
      try {
        const { data } = await getActiveConsents();
        if (!mounted) return;
        const pending = Array.isArray(data) ? data.filter(isRequiredPending) : [];
        setPendingRequiredConsents(pending);
      } catch {
        if (mounted) setPendingRequiredConsents([]);
      }
    }

    loadConsentLockState();
    window.addEventListener('sinergia:consents-updated', loadConsentLockState);
    return () => {
      mounted = false;
      window.removeEventListener('sinergia:consents-updated', loadConsentLockState);
    };
  }, []);

  const consentLocked = pendingRequiredConsents.length > 0;
  const pendingCount = useMemo(() => pendingRequiredConsents.length, [pendingRequiredConsents]);

  return (
    <div className="client-portal-shell">
      <ClientHeader user={user} consentLocked={consentLocked} />

      <div className="client-portal-body">
        <ClientSidebar consentLocked={consentLocked} />

        <main className="client-portal-main">
          {consentLocked && (
            <div className="client-consent-lock-banner">
              <strong>Consentimientos pendientes</strong>
              <span>
                Para continuar usando el portal, aceptá {pendingCount === 1 ? 'el consentimiento obligatorio vigente' : 'los consentimientos obligatorios vigentes'} desde tu perfil.
              </span>
            </div>
          )}
          {children}
        </main>
      </div>

      <ClientBottomNav consentLocked={consentLocked} />
      <GlobalPopupMessages portal="CLIENT" />

    </div>
  );
}
