import { useCallback, useEffect, useMemo, useState } from "react";
import { adminApi, getApiError } from "../api/admin";
import { Icon } from "../components/admin/Icon";
import {
  EmptyState,
  LoadingState,
  MetricCard,
  Modal,
  Notice,
  PageHeader,
  StatusBadge,
} from "../components/admin/Ui";
import type { Reservation as ReservationRecord } from "../types/admin";

type Filter = "all" | "paid" | "unpaid" | "disputed" | "payout";
type Operation = "refund" | "dispute" | null;

const amount = (value: unknown) =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
    Number(value ?? 0) || 0
  );

const dateTime = (reservation: ReservationRecord) => {
  if (!reservation.reservation_date) return "Créneau non renseigné";
  const date = new Date(reservation.reservation_date);
  const formatted = Number.isNaN(date.getTime())
    ? reservation.reservation_date
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
  return formatted + (reservation.reservation_time ? " · " + reservation.reservation_time.slice(0, 5) : "");
};

const paymentBadge = (item: ReservationRecord) => {
  if (item.payment_status === "refunded") return { label: "Remboursée", tone: "danger" as const };
  if (item.is_paid || item.payment_status === "paid") return { label: "Payée", tone: "success" as const };
  if (item.payment_status === "failed") return { label: "Échec paiement", tone: "danger" as const };
  return { label: "Non payée", tone: "warning" as const };
};

const prestationBadge = (item: ReservationRecord) => {
  if (item.prestation_status === "disputed") return { label: "Litige", tone: "danger" as const };
  if (item.prestation_status === "transferred") return { label: "Reversée", tone: "success" as const };
  if (item.prestation_status === "validated") return { label: "Validée", tone: "info" as const };
  if (["cancelled", "refunded"].includes(String(item.prestation_status))) return { label: item.prestation_status === "refunded" ? "Remboursée" : "Annulée", tone: "danger" as const };
  return { label: item.status === "realise" ? "Séance réalisée" : "En cours", tone: "neutral" as const };
};

export default function Reservation() {
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [selected, setSelected] = useState<ReservationRecord | null>(null);
  const [operation, setOperation] = useState<Operation>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [decision, setDecision] = useState<"validate" | "refund" | "cancel">("validate");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadReservations = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReservations(await adminApi.reservations());
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger les réservations."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadReservations);
  }, [loadReservations]);

  const counts = useMemo(
    () => ({
      total: reservations.length,
      paid: reservations.filter((item) => item.is_paid || item.payment_status === "paid").length,
      disputes: reservations.filter((item) => item.prestation_status === "disputed").length,
      payouts: reservations.filter((item) => item.prestation_status === "validated" && !item.stripe_transfer_id).length,
    }),
    [reservations]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return reservations.filter((item) => {
      const haystack = [
        item.id,
        item.client?.name,
        item.client?.email,
        item.intervenant?.name,
        item.annonce?.titre,
        item.payment_intent_id,
      ].join(" ").toLowerCase();

      const matchesFilter =
        filter === "all" ||
        (filter === "paid" && (item.is_paid || item.payment_status === "paid")) ||
        (filter === "unpaid" && !item.is_paid && item.payment_status !== "paid") ||
        (filter === "disputed" && item.prestation_status === "disputed") ||
        (filter === "payout" && item.prestation_status === "validated" && !item.stripe_transfer_id);

      return (!keyword || haystack.includes(keyword)) && matchesFilter;
    });
  }, [filter, reservations, search]);

  const applyUpdate = (updated: ReservationRecord) => {
    setReservations((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelected((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
  };

  const validatePrestation = async (item: ReservationRecord) => {
    setActionId(item.id);
    setError("");
    try {
      applyUpdate(await adminApi.validatePrestation(item.id));
      setSuccess("Prestation validée. Le reversement peut maintenant être exécuté.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de valider cette prestation."));
    } finally {
      setActionId(null);
    }
  };

  const transfer = async (item: ReservationRecord) => {
    if (!window.confirm("Confirmer le reversement Stripe au coach ? Cette opération financière est réelle.")) return;
    setActionId(item.id);
    setError("");
    try {
      applyUpdate(await adminApi.transferToCoach(item.id));
      setSuccess("Reversement Stripe envoyé au coach.");
    } catch (caught) {
      setError(getApiError(caught, "Le reversement n’a pas pu être effectué."));
    } finally {
      setActionId(null);
    }
  };

  const submitRefund = async () => {
    if (!selected) return;
    setActionId(selected.id);
    setError("");
    try {
      const payload: Record<string, unknown> = {
        reason: "requested_by_customer",
        admin_note: adminNote || "Remboursement décidé par l’administration",
      };
      if (refundAmount.trim()) payload.amount = Number(refundAmount);
      applyUpdate(await adminApi.refundReservation(selected.id, payload));
      setSuccess("Remboursement Stripe enregistré.");
      closeOperation();
    } catch (caught) {
      setError(getApiError(caught, "Le remboursement n’a pas pu être effectué."));
    } finally {
      setActionId(null);
    }
  };

  const submitDispute = async () => {
    if (!selected) return;
    setActionId(selected.id);
    setError("");
    try {
      applyUpdate(await adminApi.resolveDispute(selected.id, decision, adminNote));
      setSuccess("Le litige a été clôturé.");
      closeOperation();
    } catch (caught) {
      setError(getApiError(caught, "La décision sur le litige n’a pas pu être enregistrée."));
    } finally {
      setActionId(null);
    }
  };

  const openOperation = (item: ReservationRecord, nextOperation: Exclude<Operation, null>) => {
    setSelected(item);
    setOperation(nextOperation);
    setAdminNote("");
    setRefundAmount("");
    setDecision("validate");
  };

  const closeOperation = () => {
    setOperation(null);
    setAdminNote("");
    setRefundAmount("");
  };

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Exécution des prestations"
        title="Réservations"
        description="Supervisez les séances, le paiement, les litiges et la disponibilité des reversements coachs."
        actions={<button type="button" className="ops-button ops-button--secondary" onClick={loadReservations}><Icon name="refresh" size={16}/> Actualiser</button>}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Réservations" value={counts.total} detail="Toutes périodes" icon="calendar"/>
        <MetricCard label="Payées" value={counts.paid} detail="Paiement confirmé" icon="payment" tone="green"/>
        <MetricCard label="Litiges ouverts" value={counts.disputes} detail="Décision requise" icon="alert" tone="red"/>
        <MetricCard label="Prêtes à reverser" value={counts.payouts} detail="Prestations validées" icon="wallet" tone="orange"/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Client, coach, service, identifiant…"/></label>
        <select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="all">Toutes les réservations</option>
          <option value="paid">Payées</option>
          <option value="unpaid">Non payées</option>
          <option value="disputed">Litiges</option>
          <option value="payout">À reverser</option>
        </select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Flux des réservations</h2><p>{filtered.length} résultat(s)</p></div></header>
        {loading ? <LoadingState label="Chargement des réservations…"/> : filtered.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Réservation</th><th>Client</th><th>Coach</th><th>Créneau</th><th>Paiement</th><th>Prestation</th><th>Montant</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const payment = paymentBadge(item);
                  const prestation = prestationBadge(item);
                  return (
                    <tr key={item.id}>
                      <td><div className="ops-stack"><strong>RES-{String(item.id).padStart(5, "0")}</strong><span>{item.annonce?.titre || "Prestation GotFit"}</span></div></td>
                      <td><div className="ops-stack"><strong>{item.client?.name || "Client"}</strong><span>{item.client?.email}</span></div></td>
                      <td><div className="ops-stack"><strong>{item.intervenant?.name || "Coach"}</strong><span>{item.intervenant?.stripe_onboarding_completed ? "Stripe prêt" : "Stripe à compléter"}</span></div></td>
                      <td>{dateTime(item)}</td>
                      <td><StatusBadge tone={payment.tone}>{payment.label}</StatusBadge></td>
                      <td><StatusBadge tone={prestation.tone}>{prestation.label}</StatusBadge></td>
                      <td><strong>{amount(item.total_client_amount || item.price)}</strong></td>
                      <td><div className="ops-row-actions">
                        <button type="button" className="ops-row-action" onClick={() => setSelected(item)}><Icon name="eye" size={13}/> Voir</button>
                        {item.prestation_status === "disputed" && <button type="button" className="ops-row-action danger" onClick={() => openOperation(item, "dispute")}>Décider</button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="calendar" title="Aucune réservation" description="Aucune réservation ne correspond aux critères sélectionnés."/>}
      </section>

      {selected && !operation && (
        <Modal
          eyebrow={"Réservation RES-" + String(selected.id).padStart(5, "0")}
          title={selected.annonce?.titre || "Détail de la prestation"}
          onClose={() => setSelected(null)}
          footer={
            <>
              {(selected.is_paid || selected.payment_status === "paid") && selected.payment_status !== "refunded" && (
                <button type="button" className="ops-button ops-button--danger" onClick={() => openOperation(selected, "refund")}>Rembourser</button>
              )}
              {selected.prestation_status === "disputed" && (
                <button type="button" className="ops-button ops-button--secondary" onClick={() => openOperation(selected, "dispute")}>Résoudre le litige</button>
              )}
              {selected.prestation_status !== "validated" && selected.prestation_status !== "transferred" && selected.prestation_status !== "refunded" && (
                <button type="button" className="ops-button ops-button--secondary" disabled={actionId === selected.id} onClick={() => validatePrestation(selected)}>Valider la prestation</button>
              )}
              {selected.prestation_status === "validated" && !selected.stripe_transfer_id && (
                <button type="button" className="ops-button ops-button--primary" disabled={actionId === selected.id} onClick={() => transfer(selected)}><Icon name="payment" size={15}/> Reverser au coach</button>
              )}
            </>
          }
        >
          <div className="ops-detail-grid">
            <div className="ops-detail"><span>Client</span><strong>{selected.client?.name}<br/>{selected.client?.email}</strong></div>
            <div className="ops-detail"><span>Coach</span><strong>{selected.intervenant?.name}<br/>{selected.intervenant?.email}</strong></div>
            <div className="ops-detail"><span>Créneau</span><strong>{dateTime(selected)}</strong></div>
            <div className="ops-detail"><span>Statut réservation</span><strong>{selected.status || "Non précisé"}</strong></div>
            <div className="ops-detail"><span>Paiement</span><strong>{selected.payment_status || "unpaid"}<br/>{selected.payment_intent_id || "Aucun identifiant Stripe"}</strong></div>
            <div className="ops-detail"><span>Reversement</span><strong>{selected.payout_status || "pending"}<br/>{selected.stripe_transfer_id || "Non effectué"}</strong></div>
            {selected.dispute_reason && <div className="ops-detail ops-detail--wide"><span>Motif du litige</span><strong>{selected.dispute_reason}</strong></div>}
          </div>
          <div className="ops-finance-strip">
            <div><span>Client</span><strong>{amount(selected.total_client_amount || selected.price)}</strong></div>
            <div><span>Commission GotFit</span><strong>{amount(selected.commission_amount)}</strong></div>
            <div><span>Coach</span><strong>{amount(selected.intervenant_amount)}</strong></div>
          </div>
        </Modal>
      )}

      {selected && operation === "refund" && (
        <Modal
          eyebrow="Opération Stripe"
          title="Rembourser la réservation"
          onClose={closeOperation}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={closeOperation}>Annuler</button><button type="button" className="ops-button ops-button--danger" disabled={actionId === selected.id} onClick={submitRefund}>Confirmer le remboursement</button></>}
        >
          <Notice tone="info">Laissez le montant vide pour rembourser la totalité de {amount(selected.total_client_amount || selected.price)}.</Notice>
          <div className="ops-form-grid" style={{ marginTop: 14 }}>
            <label className="ops-field"><span>Montant partiel en euros</span><input type="number" min="0.5" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Vide = remboursement total"/></label>
            <label className="ops-field"><span>Réservation</span><input value={"RES-" + String(selected.id).padStart(5, "0")} disabled/></label>
            <label className="ops-field ops-detail--wide"><span>Note administrative</span><textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Motif interne et contexte de la décision…"/></label>
          </div>
        </Modal>
      )}

      {selected && operation === "dispute" && (
        <Modal
          eyebrow="Résolution de litige"
          title="Décision administrative"
          onClose={closeOperation}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={closeOperation}>Annuler</button><button type="button" className="ops-button ops-button--primary" disabled={actionId === selected.id} onClick={submitDispute}>Enregistrer la décision</button></>}
        >
          <div className="ops-detail ops-detail--wide"><span>Motif déclaré</span><strong>{selected.dispute_reason || "Aucun motif détaillé."}</strong></div>
          <div className="ops-form-grid" style={{ marginTop: 14 }}>
            <label className="ops-field"><span>Décision</span><select value={decision} onChange={(event) => setDecision(event.target.value as typeof decision)}><option value="validate">Valider la prestation</option><option value="refund">Rembourser intégralement</option><option value="cancel">Annuler sans reversement</option></select></label>
            <label className="ops-field ops-detail--wide"><span>Note de résolution</span><textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Justification de la décision…"/></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
