import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import "../assets/css/dashboard.css";

type Role = { id?: number; name?: string };

type ApiUser = {
  id: number;
  name?: string;
  email?: string;
  roles?: Role[];
  created_at?: string;
};

type ApiAnnonce = {
  id: number;
  titre?: string;
  title?: string;
  contenu?: string;
  description?: string;
  status?: string;
  reserved_by?: number | null;
  created_at?: string;
};

type ApiDocument = {
  id: number;
  name?: string;
  title?: string;
  status?: string;
  created_at?: string;
};

type ApiReservation = {
  id: number;
  status?: string;
  price?: number | string;
  prix?: number | string;
  montant?: number | string;
  created_at?: string;
};

type ApiPayment = {
  id: number;
  amount?: number | string;
  montant?: number | string;
  status?: string;
  created_at?: string;
};

type DashboardState = {
  users: ApiUser[];
  annonces: ApiAnnonce[];
  documents: ApiDocument[];
  reservations: ApiReservation[];
  payments: ApiPayment[];
};

const emptyState: DashboardState = {
  users: [],
  annonces: [],
  documents: [],
  reservations: [],
  payments: [],
};

const extractArray = (payload: any, keys: string[]) => {
  for (const key of keys) {
    if (Array.isArray(payload?.[key])) return payload[key];
    if (Array.isArray(payload?.data?.[key])) return payload.data[key];
  }

  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload)) return payload;

  return [];
};

const amountValue = (item: ApiReservation | ApiPayment) => {
  const raw =
    (item as any).amount ??
    (item as any).montant ??
    (item as any).price ??
    (item as any).prix ??
    0;

  const value = Number(String(raw).replace(/[^0-9.-]/g, ""));

  return Number.isFinite(value) ? value : 0;
};

const getRole = (user: ApiUser) => {
  const role = user.roles?.[0]?.name?.toLowerCase() || "";

  if (role.includes("admin")) return "Admin";
  if (role.includes("intervenant") || role.includes("coach")) return "Intervenant";

  return "Client";
};

const getMonthIndex = (date?: string) => {
  if (!date) return -1;

  const parsedDate = new Date(date);

  if (Number.isNaN(parsedDate.getTime())) return -1;

  return parsedDate.getMonth();
};

const formatMoney = (amount: number) => {
  return amount.toLocaleString("fr-FR");
};

const formatCurrency = (amount: number) => {
  return `${formatMoney(amount)} €`;
};

export default function Dashboard() {
  const navigate = useNavigate();

  const [data, setData] = useState<DashboardState>(emptyState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const requestFirst = async (endpoints: string[], keys: string[]) => {
    for (const endpoint of endpoints) {
      try {
        const response = await api.get(endpoint);
        return extractArray(response.data, keys);
      } catch (err) {
        console.warn(`Endpoint ignoré: ${endpoint}`, err);
      }
    }

    return [];
  };

  const goTo = (path: string) => {
    navigate(path);
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        setLoading(true);
        setError("");

        const [users, annonces, documents, reservations, payments] = await Promise.all([
          requestFirst(["/users"], ["users"]),
          requestFirst(["/annonces", "/getAllAnnonce"], ["annonces"]),
          requestFirst(["/documents"], ["documents"]),
          requestFirst(["/reservations"], ["reservations"]),
          requestFirst(["/payments", "/payements", "/paiements"], ["payments", "payements", "paiements"]),
        ]);

        setData({ users, annonces, documents, reservations, payments });
      } catch (err) {
        console.error(err);
        setError("Impossible de charger les données du dashboard. Vérifie le token admin ou les routes API Laravel.");
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(() => {
    const clientsCount = data.users.filter((user) => getRole(user) === "Client").length;
    const intervenantsCount = data.users.filter((user) => getRole(user) === "Intervenant").length;
    const adminsCount = data.users.filter((user) => getRole(user) === "Admin").length;

    const annoncesEnAttente = data.annonces.filter(
      (item) => item.status === "en_attente" || item.status === "brouillon"
    ).length;

    const annoncesValides = data.annonces.filter(
      (item) => item.status === "valide" || item.status === "accepte"
    ).length;

    const documentsValides = data.documents.filter(
      (item) => item.status === "valide" || item.status === "accepte"
    ).length;

    const reservationsConfirmees = data.reservations.filter(
      (item) => item.status === "valide" || item.status === "confirmée" || item.status === "confirmee"
    ).length;

    const paymentsPaid = data.payments.filter(
      (item) =>
        item.status === "paid" ||
        item.status === "success" ||
        item.status === "payé" ||
        item.status === "paye"
    );

    const revenue = (paymentsPaid.length ? paymentsPaid : data.payments).reduce(
      (total, item) => total + amountValue(item),
      0
    );

    return {
      usersCount: data.users.length,
      clientsCount,
      intervenantsCount,
      adminsCount,
      annoncesCount: data.annonces.length,
      documentsCount: data.documents.length,
      reservationsCount: data.reservations.length,
      reservationsConfirmees,
      paymentsCount: data.payments.length,
      revenue,
      annoncesEnAttente,
      annoncesValides,
      documentsValides,
    };
  }, [data]);

  const monthlySales = useMemo(() => {
    const months = ["JANV.", "FEV.", "MAR.", "AVR.", "MAI.", "JUIN.", "JUL.", "AOU.", "SEP.", "OCT.", "NOV.", "DEC."];

    const paymentsByMonth = Array.from({ length: 12 }, (_, index) => ({
      label: months[index],
      monthIndex: index,
      reservations: 0,
      payments: 0,
    }));

    data.reservations.forEach((reservation) => {
      const month = getMonthIndex(reservation.created_at);

      if (month >= 0) {
        paymentsByMonth[month].reservations += amountValue(reservation);
      }
    });

    data.payments.forEach((payment) => {
      const month = getMonthIndex(payment.created_at);

      if (month >= 0) {
        paymentsByMonth[month].payments += amountValue(payment);
      }
    });

    const hasRealAmount = paymentsByMonth.some((item) => item.reservations > 0 || item.payments > 0);

    if (!hasRealAmount) {
      return months.map((label, index) => ({
        label,
        monthIndex: index,
        reservations: [250, 190, 255, 250, 250, 190, 250, 250, 250, 190, 250, 250][index],
        payments: [390, 455, 420, 180, 390, 455, 420, 180, 390, 455, 420, 180][index],
      }));
    }

    return paymentsByMonth;
  }, [data.reservations, data.payments]);

  const maxMonthlyAmount = useMemo(() => {
    return Math.max(
      ...monthlySales.map((item) => Math.max(item.reservations, item.payments)),
      1
    );
  }, [monthlySales]);

  const latestUsers = data.users.slice(0, 5);
  const latestAnnonces = data.annonces.slice(0, 5);

  return (
    <div className="dashboard-page">
      <div className="dashboard-top-date">
        <strong>01 JANVIER 2021 - 24 JANVIER 2021</strong>
        <span>📅</span>
      </div>

      <div className="dashboard-page__header dashboard-page__header--split">
        <div>
          <span className="dashboard-eyebrow">Vue d'ensemble</span>
          <h1>Dashboard GotFit</h1>
          <p>Suivi global des utilisateurs, intervenants, réservations, paiements et contenus.</p>
        </div>

        <button
          type="button"
          className="dashboard-revenue-card dashboard-clickable-card"
          onClick={() => goTo("/paiements")}
        >
          <span>Chiffre d'affaires</span>
          <strong>{formatCurrency(stats.revenue)}</strong>
          <small>{stats.paymentsCount} paiement{stats.paymentsCount > 1 ? "s" : ""}</small>
        </button>
      </div>

      {loading && <div className="dashboard-alert dashboard-alert--loading">Chargement des données...</div>}

      {error && <div className="dashboard-alert dashboard-alert--error">{error}</div>}

      {!loading && !error && (
        <>
          <section className="dashboard-mobile-style-panel">
            <div className="dashboard-section-title">
              <h2>Actions</h2>
              <button type="button" onClick={() => goTo("/users")}>
                TOUT VOIR
              </button>
            </div>

            <div className="dashboard-actions-row">
              <button
                type="button"
                className="dashboard-action-item dashboard-action-item--gold"
                onClick={() => goTo("/users")}
                title="Voir les utilisateurs"
              >
                <span>👥</span>
                <strong>{stats.usersCount}</strong>
              </button>

              <button
                type="button"
                className="dashboard-action-item dashboard-action-item--blue"
                onClick={() => goTo("/documents")}
                title="Voir les documents"
              >
                <span>📄</span>
                <strong>{stats.documentsCount}</strong>
              </button>

              <button
                type="button"
                className="dashboard-action-item dashboard-action-item--purple"
                onClick={() => goTo("/annonces")}
                title="Voir les annonces"
              >
                <span>⚗️</span>
                <strong>{stats.annoncesCount}</strong>
              </button>

              <button
                type="button"
                className="dashboard-action-item dashboard-action-item--green"
                onClick={() => goTo("/reservations")}
                title="Voir les réservations"
              >
                <span>✱</span>
                <strong>{stats.reservationsCount}</strong>
              </button>

              <button
                type="button"
                className="dashboard-action-item dashboard-action-item--brown"
                onClick={() => goTo("/users")}
                title="Voir les intervenants"
              >
                <span>👤</span>
                <strong>+ {stats.intervenantsCount}</strong>
              </button>
            </div>

            <div className="dashboard-section-title dashboard-section-title--sales">
              <div>
                <h2>Ventes</h2>
                <small>TOTAL</small>
                <strong>{formatCurrency(stats.revenue)}</strong>
              </div>

              <button type="button" onClick={() => goTo("/paiements")}>
                TOUT VOIR
              </button>
            </div>

            <div className="dashboard-sales-chart">
              <div className="dashboard-sales-chart__grid">
                <span>400</span>
                <span>300</span>
                <span>200</span>
                <span>100</span>
                <span>0</span>
              </div>

              <div className="dashboard-sales-chart__months">
                {monthlySales.map((item) => {
                  const reservationHeight = Math.max((item.reservations / maxMonthlyAmount) * 165, 8);
                  const paymentHeight = Math.max((item.payments / maxMonthlyAmount) * 165, 8);

                  return (
                    <div className="dashboard-sales-month" key={item.label}>
                      <div className="dashboard-sales-month__bars">
                        <button
                          type="button"
                          className="dashboard-sales-month__bar dashboard-sales-month__bar--light"
                          style={{ height: `${reservationHeight}px` }}
                          onClick={() => goTo(`/reservations?month=${item.monthIndex + 1}`)}
                          title={`Voir les réservations de ${item.label}`}
                          aria-label={`Voir les réservations de ${item.label}`}
                        />

                        <button
                          type="button"
                          className="dashboard-sales-month__bar dashboard-sales-month__bar--gold"
                          style={{ height: `${paymentHeight}px` }}
                          onClick={() => goTo(`/paiements?month=${item.monthIndex + 1}`)}
                          title={`Voir les paiements de ${item.label}`}
                          aria-label={`Voir les paiements de ${item.label}`}
                        />
                      </div>

                      <button
                        type="button"
                        className="dashboard-sales-month__label"
                        onClick={() => goTo(`/paiements?month=${item.monthIndex + 1}`)}
                      >
                        {item.label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <div className="dashboard-stats dashboard-stats--five">
            <button type="button" className="dashboard-card dashboard-clickable-card" onClick={() => goTo("/users")}>
              <span className="dashboard-card__icon">👥</span>
              <div>
                <p>Utilisateurs</p>
                <strong>{stats.usersCount}</strong>
                <small>{stats.clientsCount} clients</small>
              </div>
            </button>

            <button type="button" className="dashboard-card dashboard-clickable-card" onClick={() => goTo("/users")}>
              <span className="dashboard-card__icon">🏋️</span>
              <div>
                <p>Intervenants</p>
                <strong>{stats.intervenantsCount}</strong>
                <small>Coachs / prestataires</small>
              </div>
            </button>

            <button type="button" className="dashboard-card dashboard-clickable-card" onClick={() => goTo("/reservations")}>
              <span className="dashboard-card__icon">📅</span>
              <div>
                <p>Réservations</p>
                <strong>{stats.reservationsCount}</strong>
                <small>{stats.reservationsConfirmees} confirmées</small>
              </div>
            </button>

            <button type="button" className="dashboard-card dashboard-clickable-card" onClick={() => goTo("/paiements")}>
              <span className="dashboard-card__icon">💳</span>
              <div>
                <p>Paiements</p>
                <strong>{stats.paymentsCount}</strong>
                <small>{formatCurrency(stats.revenue)}</small>
              </div>
            </button>

            <button type="button" className="dashboard-card dashboard-clickable-card" onClick={() => goTo("/annonces")}>
              <span className="dashboard-card__icon">📋</span>
              <div>
                <p>Annonces</p>
                <strong>{stats.annoncesCount}</strong>
                <small>{stats.annoncesEnAttente} en attente</small>
              </div>
            </button>
          </div>

          <div className="dashboard-grid">
            <section className="dashboard-panel">
              <div className="dashboard-panel__head">
                <h2>Derniers utilisateurs</h2>
                <button type="button" onClick={() => goTo("/users")}>
                  {stats.usersCount} au total
                </button>
              </div>

              {latestUsers.length > 0 ? (
                <div className="dashboard-table">
                  {latestUsers.map((user) => (
                    <button
                      type="button"
                      className="dashboard-table__row dashboard-clickable-row"
                      key={user.id}
                      onClick={() => goTo(`/users?id=${user.id}`)}
                    >
                      <div>
                        <strong>{user.name || "Utilisateur"}</strong>
                        <span>{user.email || "Email non renseigné"}</span>
                      </div>

                      <span className="dashboard-badge">{getRole(user)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">Aucun utilisateur trouvé.</div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel__head">
                <h2>Résumé rapide</h2>
              </div>

              <div className="dashboard-list">
                <button type="button" onClick={() => goTo("/users")}>
                  <span>Clients</span>
                  <strong>{stats.clientsCount}</strong>
                </button>

                <button type="button" onClick={() => goTo("/users")}>
                  <span>Intervenants</span>
                  <strong>{stats.intervenantsCount}</strong>
                </button>

                <button type="button" onClick={() => goTo("/users")}>
                  <span>Administrateurs</span>
                  <strong>{stats.adminsCount}</strong>
                </button>

                <button type="button" onClick={() => goTo("/annonces")}>
                  <span>Annonces validées</span>
                  <strong>{stats.annoncesValides}</strong>
                </button>

                <button type="button" onClick={() => goTo("/documents")}>
                  <span>Documents validés</span>
                  <strong>{stats.documentsValides}</strong>
                </button>
              </div>
            </section>
          </div>

          <div className="dashboard-grid dashboard-grid--bottom">
            <section className="dashboard-panel">
              <div className="dashboard-panel__head">
                <h2>Dernières annonces</h2>
                <button type="button" onClick={() => goTo("/annonces")}>
                  {stats.annoncesCount} au total
                </button>
              </div>

              {latestAnnonces.length > 0 ? (
                <div className="dashboard-table">
                  {latestAnnonces.map((annonce) => (
                    <button
                      type="button"
                      className="dashboard-table__row dashboard-clickable-row"
                      key={annonce.id}
                      onClick={() => goTo(`/annonces?id=${annonce.id}`)}
                    >
                      <div>
                        <strong>{annonce.titre || annonce.title || "Annonce sans titre"}</strong>
                        <span>{annonce.contenu || annonce.description || "Aucun contenu"}</span>
                      </div>

                      <span className={`dashboard-badge status-${annonce.status}`}>
                        {annonce.status || "brouillon"}
                      </span>
                    </button>
                  ))}
                </div>
              ) : (
                <div className="dashboard-empty">Aucune annonce trouvée.</div>
              )}
            </section>

            <section className="dashboard-panel">
              <div className="dashboard-panel__head">
                <h2>Messages</h2>
                <button type="button" onClick={() => goTo("/messages")}>
                  NEW!
                </button>
              </div>

              <button
                type="button"
                className="dashboard-message-preview dashboard-message-preview--clickable"
                onClick={() => goTo("/messages")}
              >
                <h3>Titre</h3>
                <strong>SOUS TITRE DU MESSAGE</strong>
                <p>
                  Description libre. Lorem ipsum dolor sit amet, consectetur adipisicing elit,
                  sed do eiusmod tempor.
                </p>
              </button>
            </section>
          </div>
        </>
      )}
    </div>
  );
}