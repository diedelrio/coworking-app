import { useLocation, Link } from 'react-router-dom';
import { FaHome, FaUserAlt, FaCog, FaChartBar, FaWrench, FaMoneyBillWave, FaHandshake } from 'react-icons/fa';
import { MdOutlineMarkEmailRead } from "react-icons/md";

function NavItem({ to, icon, label, collapsed, active, onClick }) {
  const content = (
    <div
      className={`app-sidebar__item-inner ${collapsed ? 'is-collapsed' : ''}`}
    >
      <span className="app-sidebar__icon">{icon}</span>
      {!collapsed && <span>{label}</span>}
    </div>
  );

  const commonStyle = (isActive) => ({
    display: 'block',
    textDecoration: 'none',
    color: isActive ? '#12313c' : '#f2f7f6',
    padding: '0.75rem 0.9rem',
    borderRadius: '1rem',
    background: isActive ? 'linear-gradient(135deg, #9adfe5, #7fd5df)' : 'transparent',
    marginBottom: '0.25rem',
    textAlign: collapsed ? 'center' : 'left',
    fontWeight: isActive ? 700 : 500,
    transition: 'all 0.2s ease',
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
  const isCommercialAssignments = path.startsWith('/admin/comercial/asignaciones');
  const isCommercial = path.startsWith('/admin/comercial');
  const isOperations = path.startsWith('/admin/operaciones');
  const isReports =
    path.startsWith('/admin/reportes') || path.startsWith('/admin/reports');

  return (
    <aside
      className="app-sidebar"
      style={{ width }}
    >
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        className={`app-sidebar__toggle ${collapsed ? 'is-collapsed' : ''}`}
      >
        {collapsed ? '»' : '«'}
      </button>

      {/* Dashboard */}
      <NavItem
        to="/admin"
        icon={<FaHome />}
        label="Dashboard"
        collapsed={collapsed}
        active={isDashboard}
      />

      {/* Espacios */}
      <NavItem
        to="/admin/espacios"
        icon={<FaChartBar />}
        label="Espacios"
        collapsed={collapsed}
        active={isSpaces}
      />

      {/* Settings */}
      <NavItem
        to="/admin/settings"
        icon={<FaCog />}
        label="Reglas de Negocio"
        collapsed={collapsed}
        active={isSettings}
      />

      {/* Email Templates */}
      <NavItem
        to="/admin/email-templates"
        icon={<MdOutlineMarkEmailRead />}
        label="Email Templates"
        collapsed={collapsed}
        active={isEmailTemplates}
      />
      {/* Comercial */}
      <NavItem
        to="/admin/comercial"
        icon={<FaMoneyBillWave />}
        label="Comercial"
        collapsed={collapsed}
        active={isCommercial}
      />
      <NavItem
        to="/admin/comercial/asignaciones"
        icon={<FaHandshake />}
        label="Asignaciones"
        collapsed={collapsed}
        active={isCommercialAssignments}
      />
      {/* Operaciones */}
      <NavItem
        to="/admin/operaciones"
        icon={<FaWrench />}
        label="Operaciones"
        collapsed={collapsed}
        active={isOperations}
      />

      {/* Usuarios */}
      <NavItem
        to="/admin/usuarios"
        icon={<FaUserAlt />}
        label="Usuarios"
        collapsed={collapsed}
        active={isUsers}
      />

      {/* Reportes (placeholder sin navegación) */}
      <NavItem
        icon={<FaChartBar />}
        label="Reportes"
        collapsed={collapsed}
        active={isReports}
      />
    </aside>
  );
}
