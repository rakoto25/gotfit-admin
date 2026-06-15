import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "../assets/css/dashboard.css";

type Payment = {
  id: number;
  amount?: number | string;
  montant?: number | string;
  commission?: number | string;
  service_fee?: number | string;
  intervenant_amount?: number | string;
  status?: string;
  created_at?: string;
  user?: { name?: string; email?: string };
  client?: { name?: string; email?: string };
  intervenant?: { name?: string; email?: string };
};

const extractPayments = (payload: any): Payment[] => {
  const list =
    payload?.payments ||
    payload?.payements ||
    payload?.paiements ||
    payload?.data?.payments ||
    payload?.data?.payements ||
    payload?.data?.paiements ||
    payload?.data;

  return Array.isArray(list) ? list : [];
};

const getAmount = (payment: Payment) => {
  const raw = payment.amount ?? payment.montant ?? 0;
  const value = Number(String(raw).replace(/[^0-9.-]/g, ""));

  return Number.isFinite(value) ? value : 0;
};

const formatCurrency = (amount: number | string) => {
  const value = Number(String(amount || 0).replace(/[^0-9.-]/g, ""));

  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(Number.isFinite(value) ? value : 0);
};

const formatStatus = (status?: string) => {
  const value = (status || "pending").toLowerCase();

  if (["paid", "success", "paye", "payé", "approved"].includes(value)) {
    return "Payé";
  }

  if (["failed", "fail", "cancelled", "canceled", "refused", "refusé"].includes(value)) {
    return "Échoué";
  }

  if (["pending", "attente", "en attente"].includes(value)) {
    return "En attente";
  }

  return status || "En attente";
};

const getStatusClass = (status?: string) => {
  const value = (status || "pending").toLowerCase();

  if (["paid", "success", "paye", "payé", "approved"].includes(value)) {
    return "status-paid";
  }

  if (["failed", "fail", "cancelled", "canceled", "refused", "refusé"].includes(value)) {
    return "status-failed";
  }

  return "status-pending";
};

export default function Payment() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadPayments = async () => {
      try {
        setLoading(true);
        setError("");

        const routes = ["/admin/payments", "/payments", "/payements"];
        let response = null;

        for (const route of routes) {
          try {
            response = await api.get(route);
            break;
          } catch (err) {
            console.warn(`Route paiement indisponible : ${route}`, err);
          }
        }

        if (!response) {
          throw new Error("Aucune route paiement disponible.");
        }

        setPayments(extractPayments(response.data));
      } catch (err) {
        console.error(err);
        setError(
          "Impossible de charger les paiements. Vérifie les routes GET /api/admin/payments, /api/payments ou /api/payements."
        );
      } finally {
        setLoading(false);
      }
    };

    loadPayments();
  }, []);

  const stats = useMemo(() => {
    const total = payments.reduce((sum, payment) => sum + getAmount(payment), 0);

    const success = payments.filter((payment) =>
      ["paid", "success", "paye", "payé", "approved"].includes(
        (payment.status || "").toLowerCase()
      )
    ).length;

    return { total, success };
  }, [payments]);

  return (
    <div className="dashboard-page">
      <div className="dashboard-page__header dashboard-page__header--split">
        <div>
          <span className="dashboard-eyebrow">Finances</span>
          <h1>Paiements</h1>
          <p>Suivi des paiements et revenus GotFit.</p>
        </div>

        <div className="dashboard-revenue-card">
          <span>Total encaissé</span>
          <strong>{formatCurrency(stats.total)}</strong>
          <small>
            {stats.success} paiement{stats.success > 1 ? "s" : ""} réussi
            {stats.success > 1 ? "s" : ""}
          </small>
        </div>
      </div>

      {loading && (
        <div className="dashboard-alert dashboard-alert--loading">
          Chargement des paiements...
        </div>
      )}

      {error && (
        <div className="dashboard-alert dashboard-alert--error">
          {error}
        </div>
      )}

      {!loading && !error && (
        <section className="dashboard-panel">
          <div className="dashboard-panel__head">
            <h2>Liste des paiements</h2>
            <span>
              {payments.length} paiement{payments.length > 1 ? "s" : ""}
            </span>
          </div>

          {payments.length ? (
            <div className="dashboard-table">
              {payments.map((payment) => {
                const payer =
                  payment.user?.name ||
                  payment.client?.name ||
                  payment.user?.email ||
                  payment.client?.email ||
                  `Paiement #${payment.id}`;

                return (
                  <div className="dashboard-table__row" key={payment.id}>
                    <div>
                      <strong>{payer}</strong>
                      <span>
                        {payment.created_at
                          ? new Date(payment.created_at).toLocaleDateString("fr-FR")
                          : "Date non renseignée"}
                      </span>
                    </div>

                    <span className={`dashboard-badge ${getStatusClass(payment.status)}`}>
                      {formatStatus(payment.status)}
                    </span>

                    <strong>{formatCurrency(getAmount(payment))}</strong>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="dashboard-empty">Aucun paiement trouvé.</div>
          )}
        </section>
      )}
    </div>
  );
}