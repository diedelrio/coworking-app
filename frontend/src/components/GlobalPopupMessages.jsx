import { useCallback, useEffect, useMemo, useState } from 'react';
import { getPendingPopupMessages, markPopupMessageRead } from '../api/popupMessages';

const CATEGORY_LABELS = {
  SYSTEM: 'Sistema',
  RELEASE: 'Novedades',
  COMMERCIAL: 'Comercial',
  SOCIAL: 'Social',
  OTHER: 'General',
};

export default function GlobalPopupMessages({ portal }) {
  const [messages, setMessages] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);

  const active = useMemo(() => messages[index] || null, [messages, index]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!portal) return;
      try {
        const { data } = await getPendingPopupMessages(portal);
        if (alive) {
          setMessages(Array.isArray(data) ? data : []);
          setIndex(0);
        }
      } catch (err) {
        console.error('Error cargando mensajes emergentes:', err);
      }
    }

    load();
    return () => {
      alive = false;
    };
  }, [portal]);

  const closeCurrent = useCallback(async () => {
    if (!active || loading) return;
    setLoading(true);
    try {
      await markPopupMessageRead(active.id);
    } catch (err) {
      console.error('Error marcando mensaje emergente como leído:', err);
    } finally {
      setLoading(false);
      if (index + 1 < messages.length) setIndex(index + 1);
      else {
        setMessages([]);
        setIndex(0);
      }
    }
  }, [active, index, loading, messages.length]);

  if (!active) return null;

  return (
    <div className="popup-message-overlay" role="dialog" aria-modal="true">
      <div className="popup-message-card">
        <div className="popup-message-card__head">
          <span className={`popup-message-card__badge popup-message-card__badge--${active.category || 'SYSTEM'}`}>
            {CATEGORY_LABELS[active.category] || 'General'}
          </span>
          {active.showOnce ? <span className="popup-message-card__once">Se muestra una vez</span> : null}
        </div>

        <h2>{active.title}</h2>
        <div className="popup-message-card__body">
          {String(active.description || '')
            .split('\n')
            .map((line, idx) => (
              <p key={`${active.id}-${idx}`}>{line || '\u00a0'}</p>
            ))}
        </div>

        <div className="popup-message-card__footer">
          <button type="button" className="popup-message-card__button" onClick={closeCurrent} disabled={loading}>
            {loading ? 'Guardando…' : active.requireConfirmation ? 'Entendido' : 'Cerrar'}
          </button>
        </div>
      </div>
    </div>
  );
}
