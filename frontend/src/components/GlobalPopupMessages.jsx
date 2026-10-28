import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getPendingPopupMessages, markPopupMessageRead } from '../api/popupMessages';

const CATEGORY_LABELS = {
  SYSTEM: 'Sistema',
  RELEASE: 'Novedades',
  COMMERCIAL: 'Comercial',
  SOCIAL: 'Social',
  OTHER: 'General',
  CANCELLATION: 'Cancelaciones',
};

// pollMs: si es > 0, consulta cada tanto y muestra de a uno los mensajes nuevos que lleguen
// con la sesión abierta (al iniciar sesión, las cancelaciones acumuladas vienen en un solo popup).
export default function GlobalPopupMessages({ portal, pollMs = 0 }) {
  const [messages, setMessages] = useState([]);
  const [index, setIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const seenIds = useRef(new Set());
  const ready = useRef(false); // la carga inicial (agrupada) ya terminó

  const active = useMemo(() => messages[index] || null, [messages, index]);

  useEffect(() => {
    let alive = true;

    async function load() {
      if (!portal) return;
      try {
        const { data } = await getPendingPopupMessages(portal, { group: true });
        if (alive) {
          const list = Array.isArray(data) ? data : [];
          seenIds.current = new Set(list.flatMap((m) => m.groupedIds || [m.id]));
          ready.current = true;
          setMessages(list);
          setIndex(0);
        }
      } catch (err) {
        console.error('Error cargando mensajes emergentes:', err);
      }
    }

    async function poll() {
      if (!portal || document.hidden || !ready.current) return;
      try {
        const { data } = await getPendingPopupMessages(portal);
        if (!alive || !Array.isArray(data)) return;
        const fresh = data.filter((m) => !seenIds.current.has(m.id));
        if (!fresh.length) return;
        fresh.forEach((m) => seenIds.current.add(m.id));
        setMessages((prev) => [...prev, ...fresh]);
      } catch (err) {
        console.error('Error consultando mensajes emergentes nuevos:', err);
      }
    }

    // Al volver a la pestaña (o recuperar el foco) se consulta de inmediato, sin esperar al próximo ciclo:
    // los temporizadores de una pestaña en segundo plano se frenan y el aviso llegaría tarde.
    const onVisible = () => {
      if (!document.hidden) poll();
    };

    seenIds.current = new Set();
    ready.current = false;
    load();
    const timer = pollMs > 0 ? setInterval(poll, pollMs) : null;
    if (pollMs > 0) {
      document.addEventListener('visibilitychange', onVisible);
      window.addEventListener('focus', onVisible);
    }
    return () => {
      alive = false;
      if (timer) clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', onVisible);
    };
  }, [portal, pollMs]);

  const closeCurrent = useCallback(async () => {
    if (!active || loading) return;
    setLoading(true);
    try {
      await markPopupMessageRead(active.id, active.groupedIds);
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
