import { NavLink } from 'react-router-dom';
import { FaCalendarAlt, FaHome, FaPlusCircle, FaUserAlt } from 'react-icons/fa';

const items = [
  { to: '/user', label: 'Inicio', icon: <FaHome /> },
  { to: '/user/reservas', label: 'Reservas', icon: <FaCalendarAlt /> },
  { to: '/user/reservar', label: 'Reservar', icon: <FaPlusCircle /> },
  { to: '/user/perfil', label: 'Perfil', icon: <FaUserAlt />, alwaysEnabled: true },
];

export default function ClientBottomNav({ consentLocked = false }) {
  return (
    <nav className="client-bottom-nav" aria-label="Navegación cliente">
      {items.map((item) => {
        const disabled = consentLocked && !item.alwaysEnabled;
        if (disabled) {
          return (
            <span
              key={item.to}
              className="client-bottom-nav__item client-bottom-nav__item--disabled"
              title="Aceptá los consentimientos obligatorios para habilitar esta opción"
              aria-disabled="true"
            >
              <span className="client-bottom-nav__icon">{item.icon}</span>
              <span className="client-bottom-nav__label">{item.label}</span>
            </span>
          );
        }

        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/user'}
            className={({ isActive }) => `client-bottom-nav__item${isActive ? ' active' : ''}`}
          >
            <span className="client-bottom-nav__icon">{item.icon}</span>
            <span className="client-bottom-nav__label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
