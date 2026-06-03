import { NavLink } from 'react-router-dom';
import { FaCalendarAlt, FaHome, FaPlusCircle, FaUserAlt } from 'react-icons/fa';

const items = [
  { to: '/user',          label: 'Inicio',    icon: <FaHome />,        end: true },
  { to: '/user/reservas', label: 'Reservas',  icon: <FaCalendarAlt /> },
  { to: '/user/reservar', label: 'Reservar',  icon: <FaPlusCircle /> },
  { to: '/user/perfil',   label: 'Perfil',    icon: <FaUserAlt /> },
];

export default function ClientBottomNav() {
  return (
    <nav className="client-bottom-nav" aria-label="Navegación cliente móvil">
      {items.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `client-bottom-nav__item${isActive ? ' active' : ''}`}
        >
          <span className="client-bottom-nav__icon">{item.icon}</span>
          <span>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
