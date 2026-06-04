import { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaChartBar, FaClipboardCheck, FaCog, FaHome, FaUserAlt, FaWrench } from 'react-icons/fa';
import { MdOutlineMarkEmailRead } from 'react-icons/md';

function AdminNavLink({ to, icon, label, end = false }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) => `admin-sidebar__item${isActive ? ' active' : ''}`}
    >
      <span className="admin-sidebar__icon">{icon}</span>
      <span className="admin-sidebar__label">{label}</span>
    </NavLink>
  );
}

export default function AdminSidebar() {
  const location = useLocation();
  const [reportsOpen, setReportsOpen] = useState(location.pathname.startsWith('/admin/reportes'));

  useEffect(() => {
    if (location.pathname.startsWith('/admin/reportes')) {
      setReportsOpen(true);
    }
  }, [location.pathname]);

  const reportsActive = location.pathname.startsWith('/admin/reportes');
  const usersReportActive = location.pathname === '/admin/reportes/usuarios';
  const reservationsReportActive = location.pathname === '/admin/reportes/reservas';

  return (
    <aside className="admin-sidebar" aria-label="Navegación administrador">
      <nav className="admin-sidebar__nav">
        <AdminNavLink to="/admin" end icon={<FaHome />} label="Dashboard" />
        <AdminNavLink to="/admin/espacios" icon={<FaChartBar />} label="Espacios" />
        <AdminNavLink to="/admin/settings" icon={<FaCog />} label="Reglas de negocio" />
        <AdminNavLink to="/admin/email-templates" icon={<MdOutlineMarkEmailRead />} label="Email templates" />
        <AdminNavLink to="/admin/operaciones" icon={<FaWrench />} label="Operaciones" />
        <AdminNavLink to="/admin/usuarios" icon={<FaUserAlt />} label="Usuarios" />
        <AdminNavLink to="/admin/consentimientos" icon={<FaClipboardCheck />} label="Consentimientos" />

        <div className="admin-sidebar__group">
          <button
            type="button"
            className={`admin-sidebar__item admin-sidebar__group-button${reportsActive ? ' active' : ''}`}
            onClick={() => setReportsOpen((prev) => !prev)}
            title="Reportes"
          >
            <span className="admin-sidebar__icon"><FaChartBar /></span>
            <span className="admin-sidebar__label">Reportes</span>
          </button>

          {reportsOpen && (
            <div className="admin-sidebar__submenu">
              <NavLink
                to="/admin/reportes/usuarios"
                className={`admin-sidebar__submenu-item${usersReportActive ? ' active' : ''}`}
              >
                Consulta usuarios
              </NavLink>
              <NavLink
                to="/admin/reportes/reservas"
                className={`admin-sidebar__submenu-item${reservationsReportActive ? ' active' : ''}`}
              >
                Consulta reservas
              </NavLink>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
}
