import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getApiError } from "../api/admin";
import { Icon } from "../components/admin/Icon";
import { Notice } from "../components/admin/Ui";

type LoginUser = {
  id?: number;
  name?: string;
  email?: string;
  roles?: Array<{ name?: string; slug?: string }>;
};

type LoginPayload = {
  token?: string;
  access_token?: string;
  user?: LoginUser;
  admin?: LoginUser;
  data?: {
    token?: string;
    user?: LoginUser;
  };
};

export default function LoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post<LoginPayload>("/login", { email, password });
      const payload = response.data;
      const token = payload.token || payload.access_token || payload.data?.token;
      const user = payload.user || payload.admin || payload.data?.user;

      if (!token) {
        throw new Error("Le serveur n’a retourné aucun jeton de connexion.");
      }

      const roles = user?.roles || [];
      const roleIsKnown = roles.length > 0;
      const isAdmin = roles.some((role) =>
        [role.name, role.slug].some((value) => value?.toLowerCase().includes("admin"))
      );

      if (roleIsKnown && !isAdmin) {
        throw new Error("Ce compte ne possède pas les droits administrateur.");
      }

      localStorage.setItem("admin_token", token);
      if (user) localStorage.setItem("admin_user", JSON.stringify(user));
      navigate("/", { replace: true });
    } catch (caught) {
      localStorage.removeItem("admin_token");
      localStorage.removeItem("admin_user");
      const message = caught instanceof Error
        ? caught.message
        : getApiError(caught, "Email ou mot de passe incorrect.");
      setError(message === "Network Error"
        ? "L’API GotFit est inaccessible. Vérifiez VITE_API_URL et le serveur Laravel."
        : getApiError(caught, message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-shell">
      <section className="login-story">
        <div className="login-brand">
          <span className="admin-brand__mark">GF</span>
          <strong>GotFit Operations</strong>
        </div>

        <div className="login-story__content">
          <span>Console d’infogérance</span>
          <h1>Pilotez la confiance, les flux et la croissance.</h1>
          <p>
            Une vue opérationnelle unique pour modérer la marketplace, certifier les coachs,
            suivre les réservations et sécuriser chaque mouvement financier.
          </p>
          <div className="login-capabilities">
            <span>Modération en temps réel</span>
            <span>Paiements Stripe Connect</span>
            <span>Conformité coachs</span>
          </div>
        </div>

        <span className="login-version">Accès réservé aux administrateurs GotFit</span>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="login-card__mobile-brand">
            <span className="admin-brand__mark">GF</span>
            <strong>GotFit Operations</strong>
          </div>

          <span>Espace sécurisé</span>
          <h2>Bon retour.</h2>
          <p>Connectez-vous avec votre compte administrateur pour accéder aux opérations.</p>

          {error && <Notice tone="error">{error}</Notice>}

          <form className="login-form" onSubmit={handleLogin}>
            <label className="ops-field">
              <span>Adresse email</span>
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                placeholder="admin@gotfit.tech"
                required
              />
            </label>

            <label className="ops-field">
              <span>Mot de passe</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                placeholder="Votre mot de passe"
                required
              />
            </label>

            <button type="submit" className="login-submit" disabled={loading}>
              {loading ? <><span className="ops-spinner"/>Connexion…</> : <>Accéder à la console<Icon name="arrow" size={18}/></>}
            </button>
          </form>

          <div className="login-security">
            <Icon name="shield" size={16}/>
            Authentification protégée par Laravel Sanctum.
          </div>
        </div>
      </section>
    </div>
  );
}
