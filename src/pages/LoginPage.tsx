import { useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

export default function LoginPage() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/login", {
        email,
        password,
      });

      const token =
        response.data.token ||
        response.data.access_token ||
        response.data.data?.token;

      if (!token) {
        setError("Token non trouvé dans la réponse API.");
        return;
      }

      localStorage.setItem("admin_token", token);

      const user = response.data.user || response.data.admin || response.data.data?.user;
      if (user) {
        localStorage.setItem("admin_user", JSON.stringify(user));
      }

      navigate("/");
    } catch (error: any) {
      console.error("Erreur login:", error.response?.data || error.message);
      setError("Email ou mot de passe incorrect.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center bg-light">
      <div className="card border-0 shadow-sm" style={{ width: "420px" }}>
        <div className="card-body p-4">
          <h3 className="text-center mb-4">Connexion Admin</h3>

          {error && <div className="alert alert-danger">{error}</div>}

          <form onSubmit={handleLogin}>
            <div className="mb-3">
              <label className="form-label">Adresse email</label>
              <input
                type="email"
                className="form-control"
                placeholder="admin@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Mot de passe</label>
              <input
                type="password"
                className="form-control"
                placeholder="********"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn btn-primary w-100" disabled={loading}>
              {loading ? "Connexion..." : "Se connecter"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}