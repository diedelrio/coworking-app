import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaSignOutAlt, FaUserCircle } from 'react-icons/fa';
import { HiChevronDown } from 'react-icons/hi2';
import logo from '../../../images/logo.png';

function safeParseUser(raw) {
  try { return raw ? JSON.parse(raw) : null; } catch { return null; }
}

function getInitials(name, lastName, email) {
  const a = (name || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  if (a || b) return (a + b).toUpperCase();
  return ((email || '').trim()[0] || 'U').toUpperCase();
}

export default function ClientHeader({ user }) {
  const navigate = useNavigate();
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);

  const currentUser = useMemo(
    () => user || safeParseUser(localStorage.getItem('user')),
    [user]
  );

  const initials = useMemo(
    () => getInitials(currentUser?.name, currentUser?.lastName, currentUser?.email),
    [currentUser]
  );

  const displayName = useMemo(() => {
    if (!currentUser) return '';
    const parts = [currentUser.name, currentUser.lastName].filter(Boolean);
    return parts.join(' ');
  }, [currentUser]);

  useEffect(() => {
    const onDocClick = (e) => { if (!menuRef.current?.contains(e.target)) setOpen(false); };
    const onEsc = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onEsc);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onEsc);
    };
  }, []);

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
  }

  return (
    <header className="client-header">
      <div
        className="client-header__brand"
        onClick={() => navigate('/user')}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => e.key === 'Enter' && navigate('/user')}
      >
        <img className="client-header__logo" src={logo} alt="Coworking Sinergia" />
        <span className="client-header__title">Coworking Sinergia</span>
      </div>

      <div className="client-header__actions">
        <div className="client-header__user" ref={menuRef}>
          <button
            className="client-header__user-button"
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menú de usuario"
            aria-expanded={open}
          >
            <span className="client-header__avatar">{initials}</span>
            <HiChevronDown
              className="client-header__chevron"
              style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.18s' }}
            />
          </button>

          {open && (
            <div className="client-header__menu">
              {displayName && (
                <div style={{ padding: '0.75rem 1rem 0.5rem', borderBottom: '1px solid var(--sn-border)' }}>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--sn-ink)' }}>{displayName}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--sn-muted)', marginTop: '0.12rem' }}>{currentUser?.email}</div>
                </div>
              )}
              <button type="button" onClick={() => { setOpen(false); navigate('/user/perfil'); }}>
                <FaUserCircle /> <span>Mi perfil</span>
              </button>
              <button type="button" className="danger" onClick={handleLogout}>
                <FaSignOutAlt /> <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
