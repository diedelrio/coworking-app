import AdminHeader from './AdminHeader';
import AdminSidebar from './AdminSidebar';
import './adminLayout.css';
import GlobalPopupMessages from '../../../components/GlobalPopupMessages';


export default function AdminLayout({ children, user }) {
  return (
    <div className="admin-portal-shell">
      <AdminHeader user={user} />

      <div className="admin-portal-body">
        <AdminSidebar />
        <main className="admin-portal-main">{children}</main>
      </div>
      <GlobalPopupMessages portal="ADMIN" />
    </div>
  );
}
