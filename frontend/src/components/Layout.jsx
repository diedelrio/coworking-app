import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import AdminLayout from '../portals/admin/layout/AdminLayout';
import ClientLayout from '../portals/client/layout/ClientLayout';

export default function Layout({ children, user }) {
  const location = useLocation();
  const isAdmin = useMemo(() => location.pathname.startsWith('/admin'), [location.pathname]);

  if (isAdmin) {
    return <AdminLayout user={user}>{children}</AdminLayout>;
  }

  return <ClientLayout user={user}>{children}</ClientLayout>;
}
