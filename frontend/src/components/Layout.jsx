import { useState } from 'react';
import Header from './Header';
import Navbar from './Navbar';
import { NavLink } from 'react-router-dom';

export default function Layout({ user, children }) {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [configOpen, setConfigOpen] = useState(true);

  function handleToggleSidebar() {
    setSidebarCollapsed((prev) => !prev);
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#f3f4f6',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* HEADER ARRIBA, A LO ANCHO */}
      <Header user={user} onToggleSidebar={handleToggleSidebar} />

      {/* CUERPO: SIDENAV + CONTENIDO, DEBAJO DEL HEADER */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          alignItems: 'stretch',
        }}
      >
        {/* Menú lateral */}
        <Navbar collapsed={sidebarCollapsed} />

        {/* Contenido principal */}
        <main
          style={{
            flex: 1,
            padding: '1.5rem 1.5rem 2rem',
            overflowX: 'hidden',
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
