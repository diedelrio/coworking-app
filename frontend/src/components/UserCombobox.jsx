import { useEffect, useId, useMemo, useRef, useState } from 'react';

function label(user) {
  return [user.name, user.lastName].filter(Boolean).join(' ').trim() + (user.email ? ' · ' + user.email : '');
}
function normalize(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

export default function UserCombobox({ users, value, onChange, disabled, loading, labelledBy }) {
  const id = useId();
  const input = useRef(null);
  const list = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const selected = users.find(user => String(user.id) === String(value));
  const sorted = useMemo(() => [...users].sort((a, b) =>
    [a.name, a.lastName].filter(Boolean).join(' ').trim().localeCompare(
      [b.name, b.lastName].filter(Boolean).join(' ').trim(), 'es', { sensitivity: 'base', numeric: true }
    ) || String(a.email || '').localeCompare(String(b.email || ''), 'es') || Number(a.id) - Number(b.id)
  ), [users]);
  const search = normalize(query);
  const options = useMemo(() => search.length < 3 ? sorted : sorted.filter(user => normalize(label(user)).includes(search)), [sorted, search]);
  const expanded = open && !disabled;
  const activeIndex = active >= 0 && active < options.length ? active : -1;
  useEffect(() => {
    if (expanded && activeIndex >= 0) list.current?.children[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [expanded, activeIndex]);
  function show() { setOpen(true); setQuery(''); setActive(-1); }
  function choose(user) { onChange(String(user.id)); setOpen(false); setQuery(''); setActive(-1); }
  function keyDown(event) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!expanded) { show(); return; }
      setActive(index => options.length ? (event.key === 'ArrowDown' ? Math.min(index + 1, options.length - 1) : index <= 0 ? options.length - 1 : index - 1) : -1);
    } else if (event.key === 'Enter' && expanded) {
      event.preventDefault();
      if (activeIndex >= 0) choose(options[activeIndex]);
      else if (options.length === 1) choose(options[0]);
    } else if (event.key === 'Escape') { event.preventDefault(); setOpen(false); }
  }
  return <div style={{ flex: 1, minWidth: 0, width: '100%', position: 'relative' }}>
    <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
      <input ref={input} role="combobox" aria-autocomplete="list" aria-expanded={expanded} aria-controls={id + '-list'} aria-labelledby={labelledBy} aria-describedby={id + '-help'} aria-required="true"
        aria-activedescendant={expanded && activeIndex >= 0 ? id + '-option-' + activeIndex : undefined}
        value={expanded ? query : selected ? label(selected) : ''} disabled={disabled}
        placeholder={loading ? 'Cargando usuarios…' : 'Seleccioná o buscá un usuario'} autoComplete="off"
        onFocus={show} onClick={() => { if (!expanded) show(); }} onBlur={() => setOpen(false)} onKeyDown={keyDown}
        onChange={event => { setQuery(event.target.value); setActive(-1); setOpen(true); onChange(''); }}
        style={{ width: '100%', paddingRight: 38, boxSizing: 'border-box' }} />
      <button type="button" tabIndex={-1} disabled={disabled} aria-label={expanded ? 'Cerrar usuarios' : 'Mostrar usuarios'}
        onMouseDown={event => event.preventDefault()} onClick={() => { if (expanded) setOpen(false); else { input.current?.focus(); show(); } }}
        style={{ position: 'absolute', right: 4, border: 0, background: 'transparent', padding: 8, cursor: 'pointer' }}>▾</button>
    </div>
    <div id={id + '-help'} style={{ fontSize: '0.8rem', color: '#6b7280', marginTop: 4 }}>
      Escribí al menos 3 caracteres para filtrar por nombre, apellido o correo.
    </div>
    {expanded && <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 30, background: '#fff', border: '1px solid #cbd5e1', borderRadius: 8, boxShadow: '0 8px 20px #0002', overflow: 'hidden' }}>
      <div role="status" style={{ padding: '8px 12px', fontSize: '0.8rem', color: '#64748b' }}>{options.length ? options.length + ' usuarios' : 'No se encontraron usuarios'}</div>
      <ul ref={list} id={id + '-list'} role="listbox" aria-labelledby={labelledBy} style={{ listStyle: 'none', margin: 0, padding: 0, maxHeight: 250, overflowY: 'auto' }}>
        {options.map((user, index) => <li key={user.id} id={id + '-option-' + index} role="option" aria-selected={String(user.id) === String(value)}
          onMouseDown={event => event.preventDefault()} onClick={() => choose(user)} onMouseMove={() => setActive(index)}
          style={{ padding: '10px 12px', cursor: 'pointer', overflowWrap: 'anywhere', color: '#1f2937', background: index === activeIndex ? '#e0ecff' : String(user.id) === String(value) ? '#f0f5fa' : '#fff' }}>{label(user)}</li>)}
      </ul>
    </div>}
  </div>;
}
