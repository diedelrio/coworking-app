import { useEffect, useState } from 'react';
import AdminNavbar from './AdminNavbar';
import Header from '../../../components/Header';

const LS_KEY_ADMIN = 'admin_navbar_collapsed';

export default function AdminLayout({ children, user }) {
  const [collapsed, setCollapsed] = useState(true);

  useEffect(() => {
    const saved = localStorage.getItem(LS_KEY_ADMIN);
    if (saved === null) {
      localStorage.setItem(LS_KEY_ADMIN, '1');
      setCollapsed(true);
      return;
    }
    setCollapsed(saved === '1');
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(LS_KEY_ADMIN, next ? '1' : '0');
      return next;
    });
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <AdminNavbar collapsed={collapsed} onToggle={toggleCollapsed} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <Header user={user} />
        {children}
      </div>
    </div>
  );
}
