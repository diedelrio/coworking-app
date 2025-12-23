import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Header from './Header';

const LS_KEY_ADMIN = 'admin_navbar_collapsed';

export default function Layout({ children }) {
  const location = useLocation();
  const isAdmin = useMemo(() => location.pathname.startsWith('/admin'), [location.pathname]);

  // default admin: colapsado
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    if (!isAdmin) return;

    const saved = localStorage.getItem(LS_KEY_ADMIN);
    if (saved === null) {
      localStorage.setItem(LS_KEY_ADMIN, '1');
      setCollapsed(true);
      return;
    }
    setCollapsed(saved === '1');
  }, [isAdmin]);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      if (isAdmin) localStorage.setItem(LS_KEY_ADMIN, next ? '1' : '0');
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Navbar controlado */}
      <Navbar collapsed={isAdmin ? collapsed : false} onToggle={toggleCollapsed} />

      <div style={{ flex: 1 }}>
        <Header />
        {children}
      </div>
    </div>
  );
}
