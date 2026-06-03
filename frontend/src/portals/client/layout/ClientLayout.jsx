import ClientBottomNav from './ClientBottomNav';
import ClientHeader from './ClientHeader';
import ClientSidebar from './ClientSidebar';
import './clientLayout.css';

export default function ClientLayout({ children, user }) {
  return (
    <div className="client-portal-shell">
      <ClientHeader user={user} />
      <div className="client-portal-body">
        <ClientSidebar />
        <main className="client-portal-main">{children}</main>
      </div>
      <ClientBottomNav />
    </div>
  );
}
