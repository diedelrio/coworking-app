import { useMemo, useState } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  FaHome,
  FaUserAlt,
  FaCog,
  FaChartBar,
  FaWrench,
  FaMoneyBillWave,
  FaFileInvoice,
  FaHandshake,
  FaComments,
  FaRegNewspaper,
  FaUsers,
  FaReceipt,
  FaFolderOpen,
  FaImage,
} from "react-icons/fa";
import { MdOutlineMarkEmailRead } from "react-icons/md";

function NavItem({ to, icon, label, collapsed, active, onClick }) {
  const content = (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: collapsed ? 0 : "0.6rem",
        justifyContent: collapsed ? "center" : "flex-start",
        fontSize: "0.9rem",
      }}
    >
      <span style={{ fontSize: "1.1rem" }}>{icon}</span>
      {!collapsed && <span>{label}</span>}
    </div>
  );

  const commonStyle = (isActive) => ({
    display: "block",
    textDecoration: "none",
    color: isActive ? "#ffffff" : "#e5e7eb",
    padding: "0.55rem 0.75rem",
    borderRadius: "0.5rem",
    background: isActive ? "#5686a7ff" : "transparent",
    marginBottom: "0.1rem",
    textAlign: collapsed ? "center" : "left",
  });

  if (!to) {
    return (
      <button
        type="button"
        onClick={onClick}
        style={{
          ...commonStyle(active),
          width: "100%",
          border: "none",
          cursor: "pointer",
          background: active ? "#5686a7ff" : "transparent",
        }}
      >
        {content}
      </button>
    );
  }

  return (
    <Link to={to} style={commonStyle(active)}>
      {content}
    </Link>
  );
}

function SectionHeader({ icon, label, collapsed, isOpen, onToggle }) {
  const base = {
    width: "100%",
    border: "none",
    background: "transparent",
    color: "#e5e7eb",
    cursor: "pointer",
    padding: "0.55rem 0.75rem",
    borderRadius: "0.5rem",
    textAlign: collapsed ? "center" : "left",
    display: "flex",
    alignItems: "center",
    justifyContent: collapsed ? "center" : "space-between",
    fontSize: "0.92rem",
    opacity: 0.95,
  };

  if (collapsed) {
    // En modo colapsado no mostramos secciones; se listan items “planos”
    return null;
  }

  return (
    <button type="button" onClick={onToggle} style={base}>
      <span style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "1.05rem" }}>{icon}</span>
        <span style={{ fontWeight: 700 }}>{label}</span>
      </span>
      <span style={{ opacity: 0.9 }}>{isOpen ? "▾" : "▸"}</span>
    </button>
  );
}

export default function Navbar({ collapsed, onToggle }) {
  const location = useLocation();
  const width = collapsed ? 64 : 240;
  const path = location.pathname;

  // === Rutas nuevas (según tu menú) ===
  const routes = useMemo(
    () => ({
      dashboard: "/admin",

      // Configuración
      spaces: "/admin/espacios",
      rules: "/admin/settings",
      emailTemplates: "/admin/email-templates",
      landingCms: "/admin/landing/cms",
      landingImages: "/admin/landing/images",

      // Clientes
      customers: "/admin/customers",
      contracts: "/admin/contratos", // si luego migrás a /admin/contracts, cambiamos acá
      balances: "/admin/saldos", // recomendado: vista con selector de cliente

      // Comprobantes
      invoices: "/admin/operations/invoices",
      receipts: "/admin/operations/receipts",

      // Comercial
      pricing: "/admin/pricing",
      bonos: "/admin/bonos",

      // Operaciones / Mensajes / Usuarios / Reportes
      operations: "/admin/operaciones",
      messages: "/admin/mensajes",
      users: "/admin/usuarios",
      reports: "/admin/reportes",
    }),
    []
  );

  // === Actives (acepta rutas viejas también, para que no “desactive” por redirects) ===
  const isDashboard = path === "/admin" || path === "/admin/dashboard";

  // Configuración
  const isSpaces = path.startsWith("/admin/espacios");
  const isRules = path.startsWith("/admin/settings") || path.startsWith("/admin/rules");
  const isEmailTemplates = path.startsWith("/admin/email-templates");
  const isLandingCms = path.startsWith("/admin/landing/cms") || path.startsWith("/admin/cms");
  const isLandingImages = path.startsWith("/admin/landing/images");

  // Clientes
  const isCustomers = path.startsWith("/admin/customers") || path.startsWith("/admin/clientes");
  const isContracts = path.startsWith("/admin/contratos") || path.startsWith("/admin/contracts");
  const isBalances = path.startsWith("/admin/saldos") || path.startsWith("/admin/balances");

  // Comprobantes
  const isInvoices =
    path.startsWith("/admin/operations/invoices") || path.startsWith("/admin/facturas");
  const isReceipts = path.startsWith("/admin/operations/receipts") || path.startsWith("/admin/recibos");

  // Comercial
  const isPricing = path.startsWith("/admin/pricing");
  const isBonos = path.startsWith("/admin/bonos");

  // Otros
  const isOperations = path.startsWith("/admin/operaciones");
  const isMessages = path.startsWith("/admin/mensajes");
  const isUsers = path.startsWith("/admin/usuarios");
  const isReports = path.startsWith("/admin/reportes") || path.startsWith("/admin/reports");

  // Expand/collapse sections (solo en no-collapsed)
  const [openConfig, setOpenConfig] = useState(true);
  const [openClientes, setOpenClientes] = useState(true);
  const [openComprobantes, setOpenComprobantes] = useState(true);
  const [openComercial, setOpenComercial] = useState(true);

  // Auto-open section if route inside it
  useMemo(() => {
    if (collapsed) return;
    if (isSpaces || isRules || isEmailTemplates || isLandingCms || isLandingImages) setOpenConfig(true);
    if (isCustomers || isContracts || isBalances) setOpenClientes(true);
    if (isInvoices || isReceipts) setOpenComprobantes(true);
    if (isPricing || isBonos) setOpenComercial(true);
  }, [collapsed, isSpaces, isRules, isEmailTemplates, isLandingCms, isLandingImages, isCustomers, isContracts, isBalances, isInvoices, isReceipts, isPricing, isBonos]);

  return (
    <aside
      style={{
        width,
        background: "#33576f",
        color: "#e5e7eb",
        padding: "1rem 0.75rem",
        display: "flex",
        flexDirection: "column",
        gap: "0.55rem",
        transition: "width 0.2s ease",
      }}
    >
      {/* Toggle */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={collapsed ? "Expandir menú" : "Colapsar menú"}
        title={collapsed ? "Expandir menú" : "Colapsar menú"}
        style={{
          width: "100%",
          border: "none",
          background: "transparent",
          color: "#e5e7eb",
          cursor: "pointer",
          padding: "0.55rem 0.75rem",
          borderRadius: "0.5rem",
          textAlign: collapsed ? "center" : "left",
          display: "flex",
          alignItems: "center",
          justifyContent: collapsed ? "center" : "flex-start",
          fontSize: "1rem",
          outline: "none",
        }}
      >
        {collapsed ? "»" : "«"}
      </button>

      {/* Dashboard */}
      <NavItem to={routes.dashboard} icon={<FaHome />} label="Dashboard" collapsed={collapsed} active={isDashboard} />

      {/* ===== Configuración ===== */}
      {!collapsed && (
        <SectionHeader
          icon={<FaCog />}
          label="Configuración"
          collapsed={collapsed}
          isOpen={openConfig}
          onToggle={() => setOpenConfig((v) => !v)}
        />
      )}
      {(collapsed || openConfig) && (
        <>
          <NavItem to={routes.spaces} icon={<FaChartBar />} label="Espacios" collapsed={collapsed} active={isSpaces} />
          <NavItem to={routes.rules} icon={<FaWrench />} label="Reglas de Negocio" collapsed={collapsed} active={isRules} />
          <NavItem to={routes.emailTemplates} icon={<MdOutlineMarkEmailRead />} label="Email Templates" collapsed={collapsed} active={isEmailTemplates} />
          <NavItem to={routes.landingCms} icon={<FaFolderOpen />} label="Landing > CMS" collapsed={collapsed} active={isLandingCms} />
          <NavItem to={routes.landingImages} icon={<FaImage />} label="Landing > Imágenes" collapsed={collapsed} active={isLandingImages} />
        </>
      )}

      {/* ===== Clientes ===== */}
      {!collapsed && (
        <SectionHeader
          icon={<FaUsers />}
          label="Clientes"
          collapsed={collapsed}
          isOpen={openClientes}
          onToggle={() => setOpenClientes((v) => !v)}
        />
      )}
      {(collapsed || openClientes) && (
        <>
          <NavItem to={routes.customers} icon={<FaUserAlt />} label="ABM de clientes" collapsed={collapsed} active={isCustomers} />
          <NavItem to={routes.contracts} icon={<FaHandshake />} label="Contratos" collapsed={collapsed} active={isContracts} />
          <NavItem to={routes.balances} icon={<FaMoneyBillWave />} label="Saldos" collapsed={collapsed} active={isBalances} />
        </>
      )}

      {/* ===== Comprobantes ===== */}
      {!collapsed && (
        <SectionHeader
          icon={<FaFileInvoice />}
          label="Comprobantes"
          collapsed={collapsed}
          isOpen={openComprobantes}
          onToggle={() => setOpenComprobantes((v) => !v)}
        />
      )}
      {(collapsed || openComprobantes) && (
        <>
          <NavItem to={routes.invoices} icon={<FaFileInvoice />} label="Facturas / Notas de crédito" collapsed={collapsed} active={isInvoices} />
          <NavItem to={routes.receipts} icon={<FaReceipt />} label="Recibos" collapsed={collapsed} active={isReceipts} />
        </>
      )}

      {/* ===== Comercial ===== */}
      {!collapsed && (
        <SectionHeader
          icon={<FaMoneyBillWave />}
          label="Comercial"
          collapsed={collapsed}
          isOpen={openComercial}
          onToggle={() => setOpenComercial((v) => !v)}
        />
      )}
      {(collapsed || openComercial) && (
        <>
          <NavItem to={routes.pricing} icon={<FaMoneyBillWave />} label="Listas de Precio (Pricing)" collapsed={collapsed} active={isPricing} />
          <NavItem to={routes.bonos} icon={<FaRegNewspaper />} label="Bonos" collapsed={collapsed} active={isBonos} />
        </>
      )}

      {/* Operaciones */}
      <NavItem to={routes.operations} icon={<FaWrench />} label="Operaciones" collapsed={collapsed} active={isOperations} />

      {/* Mensajes */}
      <NavItem to={routes.messages} icon={<FaComments />} label="Mensajes" collapsed={collapsed} active={isMessages} />

      {/* Usuarios */}
      <NavItem to={routes.users} icon={<FaUserAlt />} label="Usuarios" collapsed={collapsed} active={isUsers} />

      {/* Reportes */}
      <NavItem to={routes.reports} icon={<FaChartBar />} label="Reportes" collapsed={collapsed} active={isReports} />
    </aside>
  );
}