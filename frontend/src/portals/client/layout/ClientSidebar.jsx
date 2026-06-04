import { NavLink } from 'react-router-dom';
import { FaCalendarAlt, FaHome, FaPlusCircle, FaUserAlt } from 'react-icons/fa';

const items = [
  { to: '/user', label: 'Inicio', icon: <FaHome /> },
  { to: '/user/reservas', label: 'Mis reservas', icon: <FaCalendarAlt /> },
  { to: '/user/reservar', label: 'Nueva reserva', icon: <FaPlusCircle /> },
  { to: '/user/perfil', label: 'Perfil', icon: <FaUserAlt />, alwaysEnabled: true },
];

export default function ClientSidebar({ consentLocked = false }) {
  return (
    <aside className="client-sidebar" aria-label="Navegación cliente escritorio">
      <nav className="client-sidebar__nav">
        {items.map((item) => {
          const disabled = consentLocked && !item.alwaysEnabled;
          if (disabled) {
            return (
              <span
                key={item.to}
                className="client-sidebar__item client-sidebar__item--disabled"
                title="Aceptá los consentimientos obligatorios para habilitar esta opción"
                aria-disabled="true"
              >
                <span className="client-sidebar__icon">{item.icon}</span>
                <span className="client-sidebar__label">{item.label}</span>
              </span>
            );
          }

          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/user'}
              className={({ isActive }) => `client-sidebar__item${isActive ? ' active' : ''}`}
              title={item.label}
              onMouseDown={(event) => event.currentTarget.blur()}
            >
              <span className="client-sidebar__icon">{item.icon}</span>
              <span className="client-sidebar__label">{item.label}</span>
            </NavLink>
          );
        })}
      </nav>
    </aside>
  );
}
