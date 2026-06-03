import { NavLink } from 'react-router-dom';
import { FaCalendarAlt, FaHome, FaPlusCircle, FaUserAlt } from 'react-icons/fa';

const items = [
  { to: '/user',          label: 'Inicio',        icon: <FaHome />,        end: true },
  { to: '/user/reservas', label: 'Mis reservas',  icon: <FaCalendarAlt /> },
  { to: '/user/reservar', label: 'Nueva reserva', icon: <FaPlusCircle /> },
  { to: '/user/perfil',   label: 'Mi perfil',     icon: <FaUserAlt /> },
];

export default function ClientSidebar() {
  return (
    <aside className="client-sidebar" aria-label="Navegación cliente">
      <nav className="client-sidebar__nav">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `client-sidebar__item${isActive ? ' active' : ''}`}
            title={item.label}
          >
            <span className="client-sidebar__icon">{item.icon}</span>
            <span className="client-sidebar__label">{item.label}</span>
          </NavLink>
        ))}
      </nav>
    </aside>
  );
}
