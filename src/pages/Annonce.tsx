import { useEffect, useMemo, useState } from "react";
import "../assets/css/annonce.css";

const API_URL = import.meta.env.VITE_API_URL;

type AnnonceStatus = "brouillon" | "en_attente" | "valide" | "refuse";

type ApiUser = {
  id?: number;
  name?: string;
  email?: string;
};

type ApiAnnonce = {
  id: number;
  titre?: string;
  title?: string;
  nom?: string;
  contenu?: string;
  description?: string;
  prix?: number | string;
  price?: number | string;
  ville?: string;
  city?: string;
  adresse?: string;
  address?: string;
  status?: AnnonceStatus;
  created_at?: string;
  user?: ApiUser;
  intervenant?: ApiUser;
};

export default function Annonce() {
  const [annonces, setAnnonces] = useState<ApiAnnonce[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | AnnonceStatus>("all");

  const token = localStorage.getItem("admin_token");

  const authHeaders = {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  useEffect(() => {
    fetchAnnonces();
  }, []);

  const extractAnnonces = (result: any): ApiAnnonce[] => {
    if (Array.isArray(result)) return result;
    if (Array.isArray(result.annonces)) return result.annonces;
    if (Array.isArray(result.data)) return result.data;
    if (Array.isArray(result.items)) return result.items;
    if (Array.isArray(result.results)) return result.results;

    if (result.data && Array.isArray(result.data.data)) {
      return result.data.data;
    }

    if (result.annonces && Array.isArray(result.annonces.data)) {
      return result.annonces.data;
    }

    console.log("Réponse API getAllAnnonce :", result);
    return [];
  };

  const fetchAnnonces = async () => {
    try {
      setLoading(true);
      setError("");

      if (!token) {
        setError("Token admin introuvable. Reconnecte-toi.");
        return;
      }

      const response = await fetch(`${API_URL}/getAllAnnonce`, {
        method: "GET",
        headers: authHeaders,
      });

      const result = await response.json();

      if (!response.ok) {
        console.log("Erreur API getAllAnnonce :", result);
        throw new Error(`Erreur API ${response.status}`);
      }

      const data = extractAnnonces(result);

      const normalized = data.map((annonce: ApiAnnonce) => ({
        ...annonce,
        status: annonce.status || "en_attente",
      }));

      setAnnonces(normalized);
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les annonces. Vérifie la route /getAllAnnonce ou le token admin.");
    } finally {
      setLoading(false);
    }
  };

  const filteredAnnonces = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return annonces.filter((annonce) => {
      const title = getAnnonceTitle(annonce).toLowerCase();
      const description = getAnnonceDescription(annonce).toLowerCase();
      const author = getAnnonceAuthorName(annonce).toLowerCase();
      const city = getAnnonceCity(annonce).toLowerCase();

      const matchSearch =
        !keyword ||
        title.includes(keyword) ||
        description.includes(keyword) ||
        author.includes(keyword) ||
        city.includes(keyword);

      const matchStatus =
        statusFilter === "all" || annonce.status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [annonces, search, statusFilter]);

  const validateAnnonce = async (id: number) => {
    try {
      setActionLoading(id);
      setError("");

      const response = await fetch(`${API_URL}/annonces/${id}/valide`, {
        method: "PUT",
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Erreur API ${response.status}`);
      }

      setAnnonces((prev) =>
        prev.map((annonce) =>
          annonce.id === id ? { ...annonce, status: "valide" } : annonce
        )
      );
    } catch (err) {
      console.error(err);
      setError("Impossible de valider l'annonce.");
    } finally {
      setActionLoading(null);
    }
  };

  const refuseAnnonce = async (id: number) => {
    try {
      setActionLoading(id);
      setError("");

      const response = await fetch(`${API_URL}/annonces/${id}/refuser`, {
        method: "PUT",
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Erreur API ${response.status}`);
      }

      setAnnonces((prev) =>
        prev.map((annonce) =>
          annonce.id === id ? { ...annonce, status: "refuse" } : annonce
        )
      );
    } catch (err) {
      console.error(err);
      setError("Impossible de refuser l'annonce.");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteAnnonce = async (id: number) => {
    const confirmDelete = window.confirm(
      "Voulez-vous vraiment supprimer cette annonce ?"
    );

    if (!confirmDelete) return;

    try {
      setActionLoading(id);
      setError("");

      const response = await fetch(`${API_URL}/annonces/${id}`, {
        method: "DELETE",
        headers: authHeaders,
      });

      if (!response.ok) {
        throw new Error(`Erreur API ${response.status}`);
      }

      setAnnonces((prev) => prev.filter((annonce) => annonce.id !== id));
    } catch (err) {
      console.error(err);
      setError("Impossible de supprimer l'annonce.");
    } finally {
      setActionLoading(null);
    }
  };

  function getAnnonceTitle(annonce: ApiAnnonce) {
    return annonce.titre || annonce.title || annonce.nom || "Annonce sans titre";
  }

  function getAnnonceDescription(annonce: ApiAnnonce) {
    return annonce.contenu || annonce.description || "Aucune description";
  }

  function getAnnoncePrice(annonce: ApiAnnonce) {
    const price = annonce.prix || annonce.price;

    if (!price) {
      return "Non renseigné";
    }

    return `${price} €`;
  }

  function getAnnonceCity(annonce: ApiAnnonce) {
    return (
      annonce.ville ||
      annonce.city ||
      annonce.adresse ||
      annonce.address ||
      "Non renseignée"
    );
  }

  function getAnnonceAuthorName(annonce: ApiAnnonce) {
    return annonce.user?.name || annonce.intervenant?.name || "Utilisateur";
  }

  function getAnnonceAuthorEmail(annonce: ApiAnnonce) {
    return annonce.user?.email || annonce.intervenant?.email || "Email non renseigné";
  }

  const getStatusLabel = (status?: AnnonceStatus) => {
    switch (status) {
      case "valide":
        return "Validée";
      case "refuse":
        return "Refusée";
      case "brouillon":
        return "Brouillon";
      case "en_attente":
      default:
        return "En attente";
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return "-";

    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="annonces-page">
      <div className="annonces-page__header">
        <div>
          <h1>Annonces</h1>
          <p>Gestion des annonces publiées sur GotFit</p>
        </div>

        <div className="annonces-page__count">
          {filteredAnnonces.length} annonce
          {filteredAnnonces.length > 1 ? "s" : ""}
        </div>
      </div>

      <div className="annonces-toolbar">
        <div className="annonces-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Rechercher par titre, description, auteur ou ville..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="annonces-filter"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(e.target.value as "all" | AnnonceStatus)
          }
        >
          <option value="all">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="valide">Validée</option>
          <option value="refuse">Refusée</option>
          <option value="brouillon">Brouillon</option>
        </select>
      </div>

      {loading && (
        <div className="annonces-alert annonces-alert--loading">
          Chargement des annonces...
        </div>
      )}

      {error && (
        <div className="annonces-alert annonces-alert--error">{error}</div>
      )}

      {!loading && !error && (
        <div className="annonces-card">
          {filteredAnnonces.length > 0 ? (
            <div className="annonces-table">
              <div className="annonces-table__head">
                <span>Annonce</span>
                <span>Auteur</span>
                <span>Prix</span>
                <span>Ville</span>
                <span>Statut</span>
                <span>Date</span>
                <span>Actions</span>
              </div>

              {filteredAnnonces.map((annonce) => (
                <div className="annonces-table__row" key={annonce.id}>
                  <div className="annonces-info">
                    <strong>{getAnnonceTitle(annonce)}</strong>
                    <span>{getAnnonceDescription(annonce)}</span>
                  </div>

                  <div className="annonces-author">
                    <strong>{getAnnonceAuthorName(annonce)}</strong>
                    <span>{getAnnonceAuthorEmail(annonce)}</span>
                  </div>

                  <div className="annonces-muted">
                    {getAnnoncePrice(annonce)}
                  </div>

                  <div className="annonces-muted">
                    {getAnnonceCity(annonce)}
                  </div>

                  <div>
                    <span className={`annonces-status annonces-status--${annonce.status}`}>
                      {getStatusLabel(annonce.status)}
                    </span>
                  </div>

                  <div className="annonces-muted">
                    {formatDate(annonce.created_at)}
                  </div>

                  <div className="annonces-actions">
                    {annonce.status !== "valide" && (
                      <button
                        type="button"
                        className="annonces-action annonces-action--validate"
                        disabled={actionLoading === annonce.id}
                        onClick={() => validateAnnonce(annonce.id)}
                      >
                        Valider
                      </button>
                    )}

                    {annonce.status !== "refuse" && (
                      <button
                        type="button"
                        className="annonces-action annonces-action--refuse"
                        disabled={actionLoading === annonce.id}
                        onClick={() => refuseAnnonce(annonce.id)}
                      >
                        Refuser
                      </button>
                    )}

                    <button
                      type="button"
                      className="annonces-action annonces-action--delete"
                      disabled={actionLoading === annonce.id}
                      onClick={() => deleteAnnonce(annonce.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="annonces-empty">
              Aucune annonce trouvée. Vérifie aussi dans la console la réponse API affichée par getAllAnnonce.
            </div>
          )}
        </div>
      )}
    </div>
  );
}