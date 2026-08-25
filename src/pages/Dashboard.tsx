import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { adminApi, getApiError } from "../api/admin";
import { Icon } from "../components/admin/Icon";
import {
  EmptyState,
  LoadingState,
  MetricCard,
  Notice,
  PageHeader,
  StatusBadge,
} from "../components/admin/Ui";
import type {
  AdminUser,
  Announcement,
  DashboardStats,
  Payment,
  Reservation,
} from "../types/admin";

const money = (value: unknown) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    Number(value ?? 0) || 0
  );

const formatDate = (value?: string) => {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" });
};

const accountStatus = (user: AdminUser) =>
  String(user.account_status || user.status || "pending").toLowerCase();

const announcementTitle = (item: Announcement) =>
  item.titre || item.title || "Annonce sans titre";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats>({});
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [dashboardStats, userList, announcementList, reservationList, paymentData] =
        await Promise.all([
          adminApi.dashboard(),
          adminApi.users(),
          adminApi.announcements(),
          adminApi.reservations(),
          adminApi.payments(),
        ]);

      setStats(dashboardStats);
      setUsers(userList);
      setAnnouncements(announcementList);
      setReservations(reservationList);
      setPayments(paymentData.payments);
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger la vue d’ensemble."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDashboard);
  }, [loadDashboard]);

  const pendingAnnouncements = useMemo(
    () => announcements.filter((item) => ["en_attente", "brouillon"].includes(String(item.status))),
    [announcements]
  );
  const pendingCoaches = useMemo(
    () =>
      users.filter((user) => {
        const isCoach = user.roles?.some((role) =>
          [role.name, role.slug].some((value) =>
            value?.toLowerCase().includes("intervenant") || value?.toLowerCase().includes("coach")
          )
        );
        return isCoach && accountStatus(user) === "pending";
      }),
    [users]
  );
  const disputes = useMemo(
    () => reservations.filter((item) => item.prestation_status === "disputed"),
    [reservations]
  );
  const pendingPayouts = useMemo(
    () =>
      reservations.filter(
        (item) =>
          item.prestation_status === "validated" &&
          !item.stripe_transfer_id &&
          !["blocked", "refunded", "cancelled"].includes(String(item.payout_status))
      ),
    [reservations]
  );

  const chart = useMemo(() => {
    const today = new Date();
    const months = Array.from({ length: 6 }, (_, index) => {
      const date = new Date(today.getFullYear(), today.getMonth() - (5 - index), 1);
      return {
        key: date.getFullYear() + "-" + String(date.getMonth()).padStart(2, "0"),
        label: date.toLocaleDateString("fr-FR", { month: "short" }),
        amount: 0,
      };
    });

    payments.forEach((payment) => {
      if (!payment.created_at) return;
      const date = new Date(payment.created_at);
      if (Number.isNaN(date.getTime())) return;
      const key = date.getFullYear() + "-" + String(date.getMonth()).padStart(2, "0");
      const month = months.find((item) => item.key === key);
      if (month && ["paid", "transferred", "success"].includes(String(payment.status))) {
        month.amount += Number(payment.amount || 0);
      }
    });

    const maximum = Math.max(...months.map((item) => item.amount), 1);
    return months.map((item) => ({ ...item, height: Math.max(5, (item.amount / maximum) * 180) }));
  }, [payments]);

  const recentAnnouncements = announcements.slice(0, 5);

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Centre de pilotage"
        title="Bonjour, voici l’essentiel."
        description="Suivez les opérations critiques de la marketplace et traitez les éléments qui demandent une décision."
        actions={
          <button type="button" className="ops-button ops-button--secondary" onClick={loadDashboard}>
            <Icon name="refresh" size={16}/> Actualiser
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}

      {loading ? (
        <LoadingState label="Synchronisation avec l’API GotFit…" />
      ) : (
        <>
          <section className="ops-metrics">
            <MetricCard
              label="Chiffre d’affaires"
              value={money(stats.chiffre_affaires)}
              detail={String(stats.reservations_payees || 0) + " réservations payées"}
              icon="trend"
              tone="orange"
            />
            <MetricCard
              label="Commission GotFit"
              value={money(stats.commissions_gotfit)}
              detail="Frais et commissions cumulés"
              icon="wallet"
              tone="green"
            />
            <MetricCard
              label="Utilisateurs"
              value={stats.utilisateurs || users.length}
              detail={String(stats.intervenants || 0) + " coachs · " + String(stats.clients || 0) + " clients"}
              icon="users"
              tone="blue"
            />
            <MetricCard
              label="À traiter"
              value={pendingAnnouncements.length + pendingCoaches.length + disputes.length}
              detail="Modérations, validations et litiges"
              icon="alert"
              tone="red"
            />
          </section>

          <section className="ops-grid">
            <article className="ops-panel">
              <header className="ops-panel__header">
                <div>
                  <h2>Encaissements sur 6 mois</h2>
                  <p>Données réelles issues des paiements confirmés</p>
                </div>
                <button type="button" className="ops-row-action primary" onClick={() => navigate("/paiements")}>
                  Voir les finances <Icon name="arrow" size={13}/>
                </button>
              </header>
              <div className="ops-panel__body">
                <div className="ops-chart" aria-label="Encaissements des six derniers mois">
                  {chart.map((month) => (
                    <div className="ops-chart__month" key={month.key} title={money(month.amount)}>
                      <div className="ops-chart__bar" style={{ height: month.height }}/>
                      <span>{month.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </article>

            <article className="ops-panel">
              <header className="ops-panel__header">
                <div>
                  <h2>File opérationnelle</h2>
                  <p>Priorités nécessitant une action admin</p>
                </div>
              </header>
              <div className="ops-panel__body">
                <div className="ops-queue">
                  <QueueItem
                    icon="announcement"
                    label="Annonces à modérer"
                    detail="Services coach et recherches clients"
                    count={pendingAnnouncements.length}
                    onClick={() => navigate("/annonces")}
                  />
                  <QueueItem
                    icon="shield"
                    label="Coachs à certifier"
                    detail="Comptes et conformité professionnelle"
                    count={pendingCoaches.length}
                    onClick={() => navigate("/users")}
                  />
                  <QueueItem
                    icon="alert"
                    label="Litiges ouverts"
                    detail="Décision financière requise"
                    count={disputes.length}
                    onClick={() => navigate("/reservations")}
                  />
                  <QueueItem
                    icon="payment"
                    label="Reversements prêts"
                    detail="Prestations validées non reversées"
                    count={pendingPayouts.length}
                    onClick={() => navigate("/paiements")}
                  />
                </div>
              </div>
            </article>
          </section>

          <article className="ops-panel">
            <header className="ops-panel__header">
              <div>
                <h2>Dernières annonces soumises</h2>
                <p>Contrôle rapide de la marketplace</p>
              </div>
              <button type="button" className="ops-row-action" onClick={() => navigate("/annonces")}>
                Tout afficher <Icon name="arrow" size={13}/>
              </button>
            </header>

            {recentAnnouncements.length ? (
              <div className="ops-table-wrap">
                <table className="ops-table">
                  <thead><tr><th>Annonce</th><th>Type</th><th>Auteur</th><th>Soumise</th><th>Statut</th><th/></tr></thead>
                  <tbody>
                    {recentAnnouncements.map((item) => (
                      <tr key={item.id}>
                        <td><div className="ops-stack"><strong>{announcementTitle(item)}</strong><span>{item.category || "Sans catégorie"}</span></div></td>
                        <td><StatusBadge tone={item.announcement_type === "client_request" ? "info" : "dark"}>{item.announcement_type === "client_request" ? "Recherche client" : "Service coach"}</StatusBadge></td>
                        <td>{item.user?.name || "Utilisateur"}</td>
                        <td>{formatDate(item.created_at)}</td>
                        <td><StatusBadge tone={item.status === "valide" ? "success" : item.status === "refuse" ? "danger" : "warning"}>{item.status || "en_attente"}</StatusBadge></td>
                        <td><div className="ops-row-actions"><button type="button" className="ops-row-action" onClick={() => navigate("/annonces")}>Examiner</button></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState icon="announcement" title="Aucune annonce" description="Les annonces récemment soumises apparaîtront ici." />
            )}
          </article>
        </>
      )}
    </div>
  );
}

function QueueItem({ icon, label, detail, count, onClick }: { icon: "announcement" | "shield" | "alert" | "payment"; label: string; detail: string; count: number; onClick: () => void }) {
  return (
    <div className="ops-queue-item">
      <div className="ops-queue-item__main">
        <span className="ops-queue-item__icon"><Icon name={icon} size={18}/></span>
        <div><strong>{label}</strong><span>{detail}</span></div>
      </div>
      <button type="button" className="ops-filter-chip" onClick={onClick}>{count}</button>
    </div>
  );
}
