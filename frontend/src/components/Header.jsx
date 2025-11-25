import { useNavigate } from 'react-router-dom';
import logo from '../images/logo.png';

export default function Header({ user }) {
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
        background: 'white',
        padding: '1rem 0rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        borderBottom: '1px solid #e5e7eb',
        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
        marginBottom: '2rem',
      }}
    >
      {/* Logo + nombre coworking */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        {/* Si no tienes logo, dejamos un placeholder */}
        <img
          src={logo}
          alt="Logo"
          style={{ width: 48, height: 48, borderRadius: '0.5rem', marginLeft: '10px' }}
        />
        <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#111827' }}>
          Coworking Sinergia
        </h2>
      </div>

      {/* Usuario + logout */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <span style={{ fontSize: '1rem', color: '#4b5563' }}>
          Hola, <strong>{user?.name}</strong>
        </span>

        <button
          onClick={handleLogout}
          style={{
            background: '#ef4444',
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
