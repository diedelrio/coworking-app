import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.png';

export default function Header({ user, onToggleSidebar }) {
  const navigate = useNavigate();

  function handleLogout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    navigate('/login');
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
              background: 'white',
              width: 36,
              height: 36,
              borderRadius: '999px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 0 0 1px #e5e7eb',
            }}
          >
            <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>☰</span>
          </button>
        )}

        <img
          src={logo}
          alt="Logo"
          style={{ width: 40, height: 40, borderRadius: '0.5rem' }}
        />
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#faf8f8ff' }}>
          Coworking Sinergia
        </h2>
      </div>

      {/* Usuario + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '0.95rem', color: '#faf8f8ff' }}>
          Hola, <strong>{user?.name}</strong>
        </span>

        <button
          onClick={handleLogout}
          style={{
            background: '#40b7cc',
            color: 'white',
            border: 'none',
            padding: '0.4rem 1rem',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: '0.9rem',
            fontWeight: '600',
          }}
        >
          Cerrar sesión
        </button>
      </div>
    </header>
  );
}
