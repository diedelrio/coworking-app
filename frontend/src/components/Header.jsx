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
    <header
      style={{
        width: '100%',
        backgroundColor: '#33576f',
        padding: '0.75rem 1.5rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #33576f',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        zIndex: 30,
        position: 'relative',
      }}
    >
      {/* Logo + nombre coworking + botón sidenav */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            aria-label="Alternar menú lateral"
            style={{
              border: 'none',
              background: '#33576f',
              width: 36,
              height: 36,
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 0 1px #33576f',
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1, color: 'white', fontWeight: 'bold' }}>
              ☰
            </span>
          </button>
        )}

        <img src={logo} alt="Logo" style={{ width: 40, height: 40, borderRadius: '0.5rem' }} />
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#faf8f8ff' }}>
          Coworking Sinergia
        </h2>
      </div>

      {/* ✅ User dropdown */}
      <div ref={menuRef} style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          style={{
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            color: 'white',
          }}
          aria-label="Menú de usuario"
        >
          {/* Avatar */}
          <div
            style={{
              width: 34,
              height: 34,
              borderRadius: '999px',
              background: '#2563eb',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              boxShadow: '0 6px 14px rgba(0,0,0,0.18)',
            }}
          >
            {initials}
          </div>

          {/* Name + email */}
          <div style={{ textAlign: 'left', lineHeight: 1.05 }}>
            <div style={{ fontSize: 14, fontWeight: 800 }}>
              {currentUser?.name ? `${currentUser?.name} ${currentUser?.lastName || ''}`.trim() : 'Usuario'}
            </div>
            <div style={{ fontSize: 12, opacity: 0.9 }}>
              {currentUser?.email || ''}
            </div>
          </div>

          {/* Chevron */}
          <div style={{ fontSize: 16, marginLeft: 2, opacity: 0.95 }}>▾</div>
        </button>

        {open ? (
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: 'calc(100% + 10px)',
              width: 260,
              background: '#fff',
              borderRadius: 12,
              border: '1px solid rgba(0,0,0,0.10)',
              boxShadow: '0 14px 30px rgba(0,0,0,0.20)',
              overflow: 'hidden',
              zIndex: 999,
            }}
          >
            <button
              onClick={goProfile}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                border: 'none',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 700,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(0,0,0,0.03)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              👤&nbsp;&nbsp;Mi Perfil
            </button>

            <div style={{ height: 1, background: 'rgba(0,0,0,0.08)' }} />

            <button
              onClick={handleLogout}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                border: 'none',
                background: '#fff',
                cursor: 'pointer',
                fontWeight: 800,
                color: '#dc2626',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(220,38,38,0.06)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#fff')}
            >
              🚪&nbsp;&nbsp;Cerrar sesión
            </button>
          </div>
        ) : null}
      </div>
    </header>
  );
}
