import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * TagsChipsInput (modelo híbrido)
 * - Muestra chips de tags seleccionados
 * - Permite escribir tags separados por coma o Enter
 * - Autocomplete con tags existentes
 * - (opcional) crea tags nuevos vía onCreateTag
 *
 * Props:
 *  availableTags: Array<{id,name,slug}>
 *  selectedIds: number[]
 *  onChange: (nextIds:number[]) => void
 *  onCreateTag?: async ({name, slug}) => ({id,name,slug})
 *  disabled?: boolean
 */
export default function TagsChipsInput({
  availableTags = [],
  selectedIds = [],
  onChange,
  onCreateTag,
  disabled = false,
  placeholder = 'Escribí tags y separalos por coma…',
}) {
  const [q, setQ] = useState('');
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const inputRef = useRef(null);

  const byId = useMemo(() => new Map(availableTags.map(t => [t.id, t])), [availableTags]);
  const selectedTags = useMemo(
    () => selectedIds.map(id => byId.get(id)).filter(Boolean),
    [selectedIds, byId]
  );

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    const base = availableTags
      .filter(t => !selectedSet.has(t.id));
    if (!query) return base.slice(0, 12);
    return base
      .filter(t => (`${t.name || ''} ${t.slug || ''}`).toLowerCase().includes(query))
      .slice(0, 12);
  }, [availableTags, q, selectedSet]);

  function slugify(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    // remove accents
    const noAcc = s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    return noAcc
      .toLowerCase()
      .replace(/[^a-z0-9\s_-]/g, '')
      .trim()
      .replace(/[\s-]+/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 60);
  }

  function titleize(raw) {
    const s = (raw || '').trim();
    if (!s) return '';
    // keep original words but capitalized
    return s
      .split(/\s+/g)
      .map(w => w ? (w[0].toUpperCase() + w.slice(1)) : '')
      .join(' ')
      .slice(0, 80);
  }

  function addId(id) {
    const nid = Number(id);
    if (!Number.isFinite(nid)) return;
    if (selectedSet.has(nid)) return;
    onChange([...selectedIds, nid]);
  }

  function removeId(id) {
    const nid = Number(id);
    if (!Number.isFinite(nid)) return;
    onChange(selectedIds.filter(x => x !== nid));
  }

  function findExistingTag(token) {
    const sl = slugify(token);
    if (!sl) return null;
    const exact = availableTags.find(t => (t.slug || '').toLowerCase() === sl);
    if (exact) return exact;
    const byName = availableTags.find(t => (t.name || '').toLowerCase() === token.trim().toLowerCase());
    return byName || null;
  }

  async function ensureTag(token) {
    const trimmed = (token || '').trim();
    if (!trimmed) return null;

    const existing = findExistingTag(trimmed);
    if (existing) return existing;

    if (!onCreateTag) return null;

    const slug = slugify(trimmed);
    if (!slug) return null;

    const name = titleize(trimmed);

    setCreating(true);
    try {
      const created = await onCreateTag({ name, slug });
      return created || null;
    } finally {
      setCreating(false);
    }
  }

  async function commitTokens(rawTokens) {
    if (disabled) return;
    const tokens = (rawTokens || [])
      .map(t => (t || '').trim())
      .filter(Boolean);

    if (tokens.length === 0) return;

    // Process sequentially to keep UX predictable
    for (const tok of tokens) {
      // eslint-disable-next-line no-await-in-loop
      const tag = await ensureTag(tok);
      if (tag?.id) addId(tag.id);
    }
  }

  function splitByComma(text) {
    return (text || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  async function commitFromInput() {
    const tokens = splitByComma(q);
    setQ('');
    setOpen(false);
    await commitTokens(tokens);
  }

  function onKeyDown(e) {
    if (disabled) return;

    if (e.key === 'Enter') {
      e.preventDefault();
      commitFromInput();
      return;
    }

    if (e.key === ',') {
      e.preventDefault();
      commitFromInput();
      return;
    }

    if (e.key === 'Backspace' && !q && selectedTags.length > 0) {
      // remove last chip
      const last = selectedTags[selectedTags.length - 1];
      if (last?.id) removeId(last.id);
    }
  }

  useEffect(() => {
    if (!open) return;
    const onDoc = (ev) => {
      if (!inputRef.current) return;
      if (inputRef.current.contains(ev.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div>
      {/* Chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
        {selectedTags.map(t => (
          <span
            key={t.id}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              borderRadius: 999,
              border: '1px solid #e2e8f0',
              background: '#f8fafc',
              padding: '4px 10px',
              fontSize: '0.82rem',
              fontWeight: 700,
            }}
          >
            {t.name}
            <button
              type="button"
              onClick={() => removeId(t.id)}
              disabled={disabled}
              aria-label={`Quitar ${t.name}`}
              style={{
                border: 0,
                background: 'transparent',
                cursor: disabled ? 'not-allowed' : 'pointer',
                fontSize: '1rem',
                lineHeight: 1,
                opacity: 0.7,
              }}
              title="Quitar"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {/* Input + dropdown */}
      <div ref={inputRef} style={{ position: 'relative' }}>
        <input
          className="admin-input"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          onFocus={() => setOpen(true)}
          disabled={disabled}
          placeholder={placeholder}
        />

        {open && (filtered.length > 0 || (q.trim() && onCreateTag)) && (
          <div
            className="admin-card"
            style={{
              position: 'absolute',
              zIndex: 30,
              left: 0,
              right: 0,
              marginTop: 6,
              padding: 8,
              borderRadius: 12,
              background: '#fff',
              boxShadow: '0 12px 28px rgba(0,0,0,0.08)',
              maxHeight: 220,
              overflow: 'auto',
            }}
          >
            {filtered.map(t => (
              <button
                key={t.id}
                type="button"
                disabled={disabled}
                onClick={() => { addId(t.id); setQ(''); setOpen(false); }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  border: 0,
                  background: 'transparent',
                  padding: '8px 10px',
                  borderRadius: 10,
                  cursor: 'pointer',
                }}
              >
                <div style={{ fontWeight: 800, color: '#0f172a' }}>{t.name}</div>
                <div style={{ fontSize: '0.78rem', color: '#64748b' }}>{t.slug}</div>
              </button>
            ))}

            {q.trim() && onCreateTag && (
              <div style={{ marginTop: 6, paddingTop: 6, borderTop: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  disabled={disabled || creating}
                  onClick={commitFromInput}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    border: 0,
                    background: 'transparent',
                    padding: '8px 10px',
                    borderRadius: 10,
                    cursor: creating ? 'wait' : 'pointer',
                    opacity: creating ? 0.7 : 1,
                  }}
                >
                  {creating ? 'Creando tag…' : `Crear y asignar: "${q.trim()}"`}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Prefijados */}
      {availableTags.length > 0 && (
        <div className="admin-card" style={{ marginTop: 10, padding: 10, borderRadius: 12, background: '#fff' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
              gap: 10,
            }}
          >
            
          </div>

          <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#6b7280' }}>
            Tip: podés escribir tags separados por coma o Enter. Los tags “fijos” los podés cargar por SQL y aparecen acá.
          </div>
        </div>
      )}
    </div>
  );
}
