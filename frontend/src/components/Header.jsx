import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.png';

function safeParseUser(raw) {
  try {
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function getInitials(name, lastName, email) {
  const a = (name || '').trim()[0] || '';
  const b = (lastName || '').trim()[0] || '';
  if (a || b) return (a + b).toUpperCase();
  const e = (email || '').trim()[0] || '';
  return (e || 'U').toUpperCase();
}

export default function Header({ user, onToggleSidebar }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  // ✅ Fallback: si no viene por props, lo saco de localStorage
  const currentUser = useMemo(() => {
    return user || safeParseUser(localStorage.getItem('user'));
  }, [user]);

  const initials = useMemo(() => {
    return getInitials(currentUser?.name, currentUser?.lastName, currentUser?.email);
  }, [currentUser]);

  useEffect(() => {
    function onDocClick(e) {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target)) setOpen(false);
    }
    function onEsc(e) {
      if (e.key === 'Escape') setOpen(false);
    }

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

  function goProfile() {
    setOpen(false);
    const u = currentUser;
    if (!u) return;

    if (u.role === 'ADMIN') {
      navigate(`/admin/usuarios/${u.id}`);
    } else {
      navigate('/user/perfil');
    }
  }

  return (
    <header className="app-header">
      <div className="app-header__brand">
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Alternar menú lateral"
            className="app-header__menu-btn"
          >
            <span className="app-header__menu-icon">☰</span>
          </button>
        )}

        <img src={logo} alt="Logo" className="app-header__logo" />
        <div>
          <p className="app-header__eyebrow">Coworking</p>
          <h2 className="app-header__title">Sinergia</h2>
        </div>
      </div>

      <div ref={menuRef} className="app-header__user">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="app-header__user-trigger"
          aria-label="Menú de usuario"
        >
          <div className="app-header__avatar">{initials}</div>

          <div className="app-header__user-meta">
            <div className="app-header__user-name">
              {currentUser?.name ? `${currentUser?.name} ${currentUser?.lastName || ''}`.trim() : 'Usuario'}
            </div>
            <div className="app-header__user-email">{currentUser?.email || ''}</div>
          </div>

          <div className="app-header__chevron">▾</div>
        </button>

        {open ? (
          <div className="app-header__dropdown">
            <button
              onClick={goProfile}
              className="app-header__dropdown-item"
            >
              👤&nbsp;&nbsp;Mi Perfil
            </button>

            <div className="app-header__dropdown-divider" />

            <button
              onClick={handleLogout}
              className="app-header__dropdown-item app-header__dropdown-item--danger"
            >
              🚪&nbsp;&nbsp;Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
