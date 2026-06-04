import { useEffect, useMemo, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { FaBars, FaChartBar, FaClipboardCheck, FaCog, FaHome, FaSignOutAlt, FaTimes, FaUserAlt, FaUserCircle, FaWrench } from 'react-icons/fa';
import { MdOutlineMarkEmailRead } from 'react-icons/md';
import { HiChevronDown } from 'react-icons/hi2';
import logo from '../../../images/logo.png';
import './AdminMobileNav.css';

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
  return ((email || '').trim()[0] || 'U').toUpperCase();
}

function AdminMobileNavLink({ to, icon, label, end = false, onNavigate }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) => `admin-mobile-nav__item${isActive ? ' active' : ''}`}
      onClick={onNavigate}
    >
      <span className="admin-mobile-nav__icon">{icon}</span>
      <span>{label}</span>
    </NavLink>
  );
}

export default function AdminHeader({ user }) {
  const navigate = useNavigate();
  const location = useLocation();
  const menuRef = useRef(null);
  const mobileMenuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileReportsOpen, setMobileReportsOpen] = useState(location.pathname.startsWith('/admin/reportes'));

  const currentUser = useMemo(
    () => user || safeParseUser(localStorage.getItem('user')),
    [user]
  );

  const initials = useMemo(
    () => getInitials(currentUser?.name, currentUser?.lastName, currentUser?.email),
    [currentUser]
  );

  const displayName = useMemo(() => {
    if (!currentUser) return 'Usuario';
    const parts = [currentUser.name, currentUser.lastName].filter(Boolean);
    return parts.join(' ') || 'Usuario';
  }, [currentUser]);

  useEffect(() => {
    setMobileOpen(false);
    if (location.pathname.startsWith('/admin/reportes')) {
      setMobileReportsOpen(true);
    }
  }, [location.pathname]);

  useEffect(() => {
    const onDocClick = (e) => {
      if (!menuRef.current?.contains(e.target)) setOpen(false);
      if (!mobileMenuRef.current?.contains(e.target)) setMobileOpen(false);
    };
    const onEsc = (e) => {
      if (e.key === 'Escape') {
        setOpen(false);
        setMobileOpen(false);
      }
    };

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
    if (currentUser?.id) {
      navigate(`/admin/usuarios/${currentUser.id}`);
    }
  }

  function goHome() {
    navigate('/admin');
  }

  function closeMobileMenu() {
    setMobileOpen(false);
  }

  const reportsActive = location.pathname.startsWith('/admin/reportes');

  return (
    <header className="admin-header">
      <div className="admin-header__brand" onClick={goHome} role="button" tabIndex={0}>
        <img src={logo} alt="Coworking Sinergia" className="admin-header__logo" />
        <div className="admin-header__brand-text">
          <strong>Coworking Sinergia</strong>
          <span>Panel administrador</span>
        </div>
      </div>

      <div className="admin-header__actions">
        <div className="admin-mobile-nav" ref={mobileMenuRef}>
          <button
            type="button"
            className="admin-mobile-nav__button"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="Abrir menú administrador"
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <FaTimes /> : <FaBars />}
          </button>

          {mobileOpen && (
            <div className="admin-mobile-nav__panel">
              <AdminMobileNavLink to="/admin" end icon={<FaHome />} label="Dashboard" onNavigate={closeMobileMenu} />
              <AdminMobileNavLink to="/admin/espacios" icon={<FaChartBar />} label="Espacios" onNavigate={closeMobileMenu} />
              <AdminMobileNavLink to="/admin/settings" icon={<FaCog />} label="Reglas de negocio" onNavigate={closeMobileMenu} />
              <AdminMobileNavLink to="/admin/email-templates" icon={<MdOutlineMarkEmailRead />} label="Email templates" onNavigate={closeMobileMenu} />
              <AdminMobileNavLink to="/admin/operaciones" icon={<FaWrench />} label="Operaciones" onNavigate={closeMobileMenu} />
              <AdminMobileNavLink to="/admin/usuarios" icon={<FaUserAlt />} label="Usuarios" onNavigate={closeMobileMenu} />
              <AdminMobileNavLink to="/admin/consentimientos" icon={<FaClipboardCheck />} label="Consentimientos" onNavigate={closeMobileMenu} />

              <button
                type="button"
                className={`admin-mobile-nav__item admin-mobile-nav__item-button${reportsActive ? ' active' : ''}`}
                onClick={() => setMobileReportsOpen((prev) => !prev)}
              >
                <span className="admin-mobile-nav__icon"><FaChartBar /></span>
                <span>Reportes</span>
                <HiChevronDown className={`admin-mobile-nav__chevron${mobileReportsOpen ? ' open' : ''}`} />
              </button>

              {mobileReportsOpen && (
                <div className="admin-mobile-nav__submenu">
                  <NavLink
                    to="/admin/reportes/usuarios"
                    className={({ isActive }) => `admin-mobile-nav__submenu-item${isActive ? ' active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    Consulta usuarios
                  </NavLink>
                  <NavLink
                    to="/admin/reportes/reservas"
                    className={({ isActive }) => `admin-mobile-nav__submenu-item${isActive ? ' active' : ''}`}
                    onClick={closeMobileMenu}
                  >
                    Consulta reservas
                  </NavLink>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="admin-header__user" ref={menuRef}>
          <button
            type="button"
            className="admin-header__user-button"
            onClick={() => setOpen((prev) => !prev)}
            aria-label="Menú de usuario"
            aria-expanded={open}
          >
            <span className="admin-header__avatar">{initials}</span>
            <span className="admin-header__user-text">
              <strong>{displayName}</strong>
              <small>{currentUser?.email || ''}</small>
            </span>
            <HiChevronDown
              className="admin-header__chevron"
              style={{ transform: open ? 'rotate(180deg)' : 'none' }}
            />
          </button>

          {open && (
            <div className="admin-header__menu">
              <button type="button" onClick={goProfile}>
                <FaUserCircle />
                <span>Mi perfil</span>
              </button>
              <button type="button" className="danger" onClick={handleLogout}>
                <FaSignOutAlt />
                <span>Cerrar sesión</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
