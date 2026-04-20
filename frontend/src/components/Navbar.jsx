import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { FaHome, FaUserAlt, FaCog, FaChartBar, FaWrench } from 'react-icons/fa';
import { MdOutlineMarkEmailRead } from 'react-icons/md';

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
    background: isActive ? '#5686a7ff' : 'transparent',
    marginBottom: '0.1rem',
    textAlign: collapsed ? 'center' : 'left',
  });

  if (!to) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...commonStyle(active),
          width: '100%',
          border: 'none',
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

export default function Navbar({ collapsed, onToggle }) {
  const location = useLocation();
  const width = collapsed ? 64 : 220;

  const path = location.pathname;

  const isDashboard = path === '/admin';
  const isSpaces = path === '/admin/espacios';
  const isSettings = path === '/admin/settings';
  const isEmailTemplates = path === '/admin/email-templates';
  const isUsers = path === '/admin/usuarios';
  const isOperations = path.startsWith('/admin/operaciones');
  const isReports = path.startsWith('/admin/reportes') || path.startsWith('/admin/reports');
  const isUsersReport = path === '/admin/reportes/usuarios';
  const isReservationsReport = path === '/admin/reportes/reservas';

  const [reportsOpen, setReportsOpen] = useState(isReports);

  useEffect(() => {
    if (isReports) setReportsOpen(true);
  }, [isReports]);

  const handleReportsClick = () => {
    if (collapsed) {
      setReportsOpen(true);
      onToggle?.();
      return;
    }
    setReportsOpen((prev) => !prev);
  };

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
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        style={{
          width: '100%',
          border: 'none',
          background: 'transparent',
          color: '#e5e7eb',
          cursor: 'pointer',
          padding: '0.55rem 0.75rem',
          borderRadius: '0.5rem',
          textAlign: collapsed ? 'center' : 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: collapsed ? 'center' : 'flex-start',
          fontSize: '1rem',
          outline: 'none',
        }}
      >
        {collapsed ? '»' : '«'}
      </button>

      <NavItem
        to="/admin"
        icon={<FaHome />}
        label="Dashboard"
        collapsed={collapsed}
        active={isDashboard}
      />

      <NavItem
        to="/admin/espacios"
        icon={<FaChartBar />}
        label="Espacios"
        collapsed={collapsed}
        active={isSpaces}
      />

      <NavItem
        to="/admin/settings"
        icon={<FaCog />}
        label="Reglas de Negocio"
        collapsed={collapsed}
        active={isSettings}
      />

      <NavItem
        to="/admin/email-templates"
        icon={<MdOutlineMarkEmailRead />}
        label="Email Templates"
        collapsed={collapsed}
        active={isEmailTemplates}
      />

      <NavItem
        to="/admin/operaciones"
        icon={<FaWrench />}
        label="Operaciones"
        collapsed={collapsed}
        active={isOperations}
      />

      <NavItem
        to="/admin/usuarios"
        icon={<FaUserAlt />}
        label="Usuarios"
        collapsed={collapsed}
        active={isUsers}
      />

      <div>
        <NavItem
          icon={<FaChartBar />}
          label="Reportes"
          collapsed={collapsed}
          active={isReports}
          onClick={handleReportsClick}
        />

        {!collapsed && reportsOpen && (
          <div style={{ marginTop: 4, marginLeft: 10 }}>
            <Link
              to="/admin/reportes/usuarios"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: isUsersReport ? '#ffffff' : '#e5e7eb',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: isUsersReport ? '#5686a7ff' : 'transparent',
                fontSize: '0.88rem',
                marginBottom: 4,
              }}
            >
              Consulta usuarios
            </Link>

            <Link
              to="/admin/reportes/reservas"
              style={{
                display: 'block',
                textDecoration: 'none',
                color: isReservationsReport ? '#ffffff' : '#e5e7eb',
                padding: '0.5rem 0.75rem',
                borderRadius: '0.5rem',
                background: isReservationsReport ? '#5686a7ff' : 'transparent',
                fontSize: '0.88rem',
              }}
            >
              Consulta reservas
            </Link>
          </div>
        )}
      </div>
    </aside>
  );
}