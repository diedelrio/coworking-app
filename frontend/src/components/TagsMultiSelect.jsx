import { useMemo, useState } from 'react';

/**
 * TagsMultiSelect
 * - Muestra listado de tags con buscador
 * - Permite seleccionar múltiples tags
 * Props:
 *   tags: Array<{id,name,slug}>
 *   value: number[] (tagIds seleccionados)
 *   onChange: (nextIds:number[]) => void
 */
export default function TagsMultiSelect({
  tags = [],
  value = [],
  onChange,
  disabled = false,
  showLabel = true,
}) {
  const [q, setQ] = useState('');

  const selectedSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return tags;
    return tags.filter((t) =>
      `${t.name || ''} ${t.slug || ''}`.toLowerCase().includes(query)
    );
  }, [tags, q]);

  const toggle = (tagId) => {
    if (disabled) return;
    const id = Number(tagId);
    if (!Number.isFinite(id)) return;
    const next = new Set(selectedSet);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(Array.from(next));
  };

  const selectedTags = useMemo(() => {
    const byId = new Map(tags.map((t) => [t.id, t]));
    return value
      .map((id) => byId.get(id))
      .filter(Boolean);
  }, [tags, value]);

  return (
    <div>
      {showLabel ? <label className="admin-label">Tags</label> : null}

      {selectedTags.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            marginBottom: 10,
          }}
        >
          {selectedTags.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => toggle(t.id)}
              disabled={disabled}
              title="Quitar tag"
              style={{
                borderRadius: 999,
                border: '1px solid #e2e8f0',
                background: '#f8fafc',
                padding: '4px 10px',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {t.name} <span style={{ opacity: 0.6, fontWeight: 600 }}>×</span>
            </button>
          ))}
        </div>
      )}

      <input
        className="admin-input"
        placeholder="Buscar tags..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        disabled={disabled}
        style={{ marginBottom: 10 }}
      />

      <div
        className="admin-card"
        style={{
          padding: 10,
          maxHeight: 180,
          overflow: 'auto',
          borderRadius: 12,
          background: '#fff',
        }}
      >
        {filtered.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.9rem' }}>
            No hay tags para mostrar.
          </div>
        ) : (
          <div style={{ display: 'grid', gap: 8 }}>
            {filtered.map((t) => (
              <label
                key={t.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedSet.has(t.id)}
                  onChange={() => toggle(t.id)}
                  disabled={disabled}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>
                    {t.name}
                  </span>
                  <span style={{ fontSize: '0.78rem', color: '#64748b' }}>
                    {t.slug}
                  </span>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#6b7280' }}>
        Tip: podés usar tags para segmentación y envíos masivos.
      </div>
    </div>
  );
}
