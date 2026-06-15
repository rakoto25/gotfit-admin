import { NavLink, Outlet, useNavigate } from "react-router-dom";
import "../assets/css/AdminLayout.css"

export default function AdminLayout() {
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    navigate("/login");
  };

  const adminUser = JSON.parse(localStorage.getItem("admin_user") || "null");

  return (
    <div className="gotfit-admin">
      <aside className="gotfit-sidebar">
        <div className="gotfit-sidebar__brand">
          <div className="gotfit-sidebar__logo">G</div>

          <div>
            <h4>GotFit</h4>
            <span>WebAdmin</span>
          </div>
        </div>

        <nav className="gotfit-sidebar__nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">⌂</span>
            <span>Dashboard</span>
          </NavLink>

          <NavLink
            to="/users"
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">👥</span>
            <span>Utilisateurs</span>
          </NavLink>

          <NavLink
            to="/annonces"
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">📋</span>
            <span>Annonces</span>
          </NavLink>

          <NavLink
            to="/documents"
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">📄</span>
            <span>Documents</span>
          </NavLink>

          <NavLink
            to="/reservations"
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">📅</span>
            <span>Réservations</span>
          </NavLink>



          <NavLink
            to="/paiements"
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">💳</span>
            <span>Paiements</span>
          </NavLink>

          <NavLink
            to="/messages"
            className={({ isActive }) =>
              isActive ? "gotfit-nav-link active" : "gotfit-nav-link"
            }
          >
            <span className="gotfit-nav-link__icon">💬</span>
            <span>Messages</span>
          </NavLink>
        </nav>

        <div className="gotfit-sidebar__bottom">
          <div className="gotfit-admin-card">
            <div className="gotfit-admin-card__avatar">
              {adminUser?.name?.charAt(0) || "A"}
            </div>

            <div>
              <strong>{adminUser?.name || "Administrateur"}</strong>
              <span>{adminUser?.email || "admin@gmail.com"}</span>
            </div>
          </div>

          <button className="gotfit-logout-btn" onClick={handleLogout}>
            Déconnexion
          </button>
        </div>
      </aside>

      <div className="gotfit-main">
        <header className="gotfit-topbar">
          <div>
            <p>Bonjour 👋</p>
            <h2>Bienvenue sur GotFit Admin</h2>
          </div>

          <div className="gotfit-topbar__right">
            <div className="gotfit-search">
              <span>⌕</span>
              <input type="text" placeholder="Rechercher..." />
            </div>

            <button className="gotfit-notification" type="button">
              🔔
              <span></span>
            </button>

            <div className="gotfit-topbar__avatar">
              {adminUser?.name?.charAt(0) || "A"}
            </div>
          </div>
        </header>

        <main className="gotfit-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}