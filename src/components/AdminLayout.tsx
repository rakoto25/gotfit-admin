import { useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Icon, type IconName } from "./admin/Icon";

type StoredAdmin = {
  name?: string;
  email?: string;
};

type NavigationItem = {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
};

const navigation: Array<{ title: string; items: NavigationItem[] }> = [
  {
    title: "Pilotage",
    items: [
      { to: "/", label: "Vue d’ensemble", icon: "dashboard", end: true },
      { to: "/users", label: "Utilisateurs", icon: "users" },
      { to: "/annonces", label: "Modération annonces", icon: "announcement" },
      { to: "/documents", label: "Conformité coachs", icon: "document" },
    ],
  },
  {
    title: "Opérations",
    items: [
      { to: "/reservations", label: "Réservations", icon: "calendar" },
      { to: "/paiements", label: "Paiements & reversements", icon: "payment" },
      { to: "/messages", label: "Communications", icon: "message" },
    ],
  },
];

const pageTitles: Record<string, string> = {
  "/": "Vue d’ensemble",
  "/users": "Gestion des utilisateurs",
  "/annonces": "Modération des annonces",
  "/documents": "Documents professionnels",
  "/reservations": "Supervision des réservations",
  "/paiements": "Opérations financières",
  "/messages": "Communications",
};

const readAdmin = (): StoredAdmin => {
  try {
    return JSON.parse(localStorage.getItem("admin_user") || "{}") as StoredAdmin;
  } catch {
    return {};
  }
};

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [adminUser] = useState(readAdmin);
  const pageTitle = pageTitles[location.pathname] || "Console GotFit";

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div className="admin-shell">
      {sidebarOpen && (
        <button
          type="button"
          className="admin-sidebar-scrim"
          onClick={closeSidebar}
          aria-label="Fermer le menu"
        />
      )}

      <aside className={"admin-sidebar" + (sidebarOpen ? " open" : "")}>
        <button
          type="button"
          className="ops-icon-button admin-sidebar-close"
          onClick={closeSidebar}
          aria-label="Fermer le menu"
        >
          <Icon name="close" />
        </button>

        <Link to="/" className="admin-brand" onClick={closeSidebar}>
          <span className="admin-brand__mark">GF</span>
          <span>
            <strong>GotFit</strong>
            <span>Operations center</span>
          </span>
        </Link>

        {navigation.map((section) => (
          <section className="admin-nav-section" key={section.title}>
            <span>{section.title}</span>
            <nav className="admin-nav">
              {section.items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  onClick={closeSidebar}
                  className={({ isActive }) => (isActive ? "active" : undefined)}
                >
                  <Icon name={item.icon} size={18} />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </section>
        ))}

        <div className="admin-sidebar__footer">
          <div className="admin-profile">
            <span className="admin-avatar">{adminUser.name?.slice(0, 2) || "AD"}</span>
            <span>
              <strong>{adminUser.name || "Administrateur"}</strong>
              <span>{adminUser.email || "Console sécurisée"}</span>
            </span>
          </div>
          <button type="button" className="admin-logout" onClick={handleLogout}>
            <Icon name="logout" size={17} />
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="admin-main">
        <header className="admin-topbar">
          <div className="admin-topbar__right">
            <button
              type="button"
              className="ops-icon-button admin-mobile-toggle"
              onClick={() => setSidebarOpen(true)}
              aria-label="Ouvrir le menu"
            >
              <Icon name="menu" />
            </button>
            <div className="admin-topbar__title">
              <span>Administration GotFit</span>
              <strong>{pageTitle}</strong>
            </div>
          </div>

          <div className="admin-topbar__right">
            <span className="admin-system-status">Console sécurisée</span>
            <span className="admin-avatar">{adminUser.name?.slice(0, 2) || "AD"}</span>
          </div>
        </header>

        <main className="admin-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
