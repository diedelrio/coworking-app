import { useLocation, Link } from 'react-router-dom';


function NavItem({ to, icon, label, collapsed, active, onClick }) {
  const content = (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: collapsed ? 0 : '0.6rem',
        justifyContent: collapsed ? 'center' : 'flex-start',
        fontSize: '0.9rem',
      }}
    >
      <span style={{ fontSize: '1.1rem' }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </div>
  );

  const commonStyle = (isActive) => ({
    display: 'block',
    textDecoration: 'none',
    color: isActive ? '#ffffff' : '#e5e7eb',
    padding: '0.55rem 0.75rem',
    borderRadius: '0.5rem',
    background: isActive ? '#4f46e5' : 'transparent',
    marginBottom: '0.1rem',
    textAlign: collapsed ? 'center' : 'left',
  });

  if (!to) {
    // item "sección" sin navegación
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...commonStyle(active),
          width: '100%',
          border: 'none',
          background: active ? '#4f46e5' : 'transparent',
          cursor: 'pointer',
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={to} style={commonStyle(active)}>
      {content}
    </Link>
  );
}

export default function Navbar({ collapsed }) {
  const location = useLocation();
  const width = collapsed ? 64 : 220;

  const path = location.pathname;

  const isDashboard = path === '/admin';
  const isSpaces = path === '/admin/espacios';
  const isSettings = path === '/admin/settings';
  
  const isUsers = path.startsWith('/admin/usuarios'); // futuro
  const isReports =
    path.startsWith('/admin/reportes') || path.startsWith('/admin/reports');

  return (
    <aside
      style={{
        width,
        background: '#33576f',
        color: '#e5e7eb',
        padding: '1rem 0.75rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
        transition: 'width 0.2s ease',
      }}
    >
      {/* separador superior */}
      <div style={{ height: '0.5rem' }} />

      {/* Dashboard */}
      <NavItem
        to="/admin"
        icon="🏠"
        label="Dashboard"
        collapsed={collapsed}
        active={isDashboard}
      />
      {/* Espacios */}
      <NavItem
        to="/admin/espacios"
        icon="🛋️"
        label="Espacios"
        collapsed={collapsed}
        active={isSpaces}
      />
      
      {/* Settings */}
      <NavItem
        to="/admin/settings"
        icon="⚙️"
        label="Reglas de Negocio"
        collapsed={collapsed}
        active={isSettings}
      />


      {/* Usuarios (placeholder futuro) */}
      <div style={{ marginTop: '0.75rem' }}>
        <NavItem
          to="/admin/usuarios"
          icon="👥"
          label="Usuarios"
          collapsed={collapsed}
          active={isUsers}
        />
      </div>

      {/* Reportes (placeholder futuro) */}
      <div style={{ marginTop: '0.75rem' }}>
        <NavItem
          icon="📊"
          label="Reportes"
          collapsed={collapsed}
          active={isReports}
        />

        {!collapsed && (
          <div
            style={{
              paddingLeft: '1.8rem',
              marginTop: '0.25rem',
              fontSize: '0.85rem',
              color: '#9ca3af',
            }}
          >
            <div style={{ marginBottom: '0.1rem' }}>Reservas (TBD)</div>
            <div>Usuarios (TBD)</div>
          </div>
        )}
      </div>
    </aside>
  );
}
