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
import type { Payment as PaymentRecord, PaymentSummary, Reservation } from "../types/admin";

type Filter = "all" | "paid" | "pending" | "transferred" | "refunded" | "failed";

const emptySummary: PaymentSummary = {
  total: 0,
  totalServiceFee: 0,
  totalCommission: 0,
  totalGotfit: 0,
  totalIntervenant: 0,
};

const currency = (value: unknown, code = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: code || "EUR" }).format(
    Number(value ?? 0) || 0
  );

const formatDate = (value?: string) => {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const normalizedStatus = (payment: PaymentRecord) => {
  const paymentStatus = String(payment.status || "pending").toLowerCase();
  const payoutStatus = String(payment.payout_status || "").toLowerCase();

  if (paymentStatus.includes("refund")) return "refunded";
  if (["failed", "cancelled", "canceled"].includes(paymentStatus)) return "failed";
  if (payment.stripe_transfer_id || payoutStatus === "transferred" || payoutStatus === "paid") return "transferred";
  if (["paid", "succeeded", "success", "completed"].includes(paymentStatus)) return "paid";
  return "pending";
};

const paymentBadge = (payment: PaymentRecord) => {
  const status = normalizedStatus(payment);
  if (status === "transferred") return { label: "Reversé", tone: "success" as const };
  if (status === "paid") return { label: "Encaissé", tone: "info" as const };
  if (status === "refunded") return { label: "Remboursé", tone: "danger" as const };
  if (status === "failed") return { label: "Échec", tone: "danger" as const };
  return { label: "En attente", tone: "warning" as const };
};

const reservationId = (payment: PaymentRecord) => payment.reservation?.id || payment.reservation_id;

export default function Payment() {
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [summary, setSummary] = useState<PaymentSummary>(emptySummary);
  const [selected, setSelected] = useState<PaymentRecord | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [rates, setRates] = useState({ clientFee: "5", coachCommission: "12" });
  const [refundOpen, setRefundOpen] = useState(false);
  const [refundAmount, setRefundAmount] = useState("");
  const [adminNote, setAdminNote] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [savingSettings, setSavingSettings] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadFinance = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [paymentData, reservationData, businessSettings] = await Promise.all([
        adminApi.payments(),
        adminApi.reservations(),
        adminApi.businessSettings(),
      ]);
      setPayments(paymentData.payments);
      setSummary(paymentData.summary);
      setReservations(reservationData);
      const settingsMap = new Map(businessSettings.map((setting) => [setting.key, String(setting.value)]));
      setRates({
        clientFee: settingsMap.get("client_service_fee_rate") || "5",
        coachCommission: settingsMap.get("intervenant_commission_rate") || "12",
      });
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger la comptabilité des paiements."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadFinance);
  }, [loadFinance]);

  const reservationMap = useMemo(
    () => new Map(reservations.map((item) => [item.id, item])),
    [reservations]
  );

  const getReservation = useCallback((payment: PaymentRecord | null) => {
    if (!payment) return undefined;
    const id = reservationId(payment);
    return payment.reservation || (id ? reservationMap.get(id) : undefined);
  }, [reservationMap]);

  const waitingPayouts = useMemo(
    () =>
      payments.filter((payment) => {
        const reservation = getReservation(payment);
        return (
          normalizedStatus(payment) === "paid" &&
          !payment.stripe_transfer_id &&
          reservation?.prestation_status === "validated"
        );
      }).length,
    [getReservation, payments]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return payments.filter((payment) => {
      const reservation = getReservation(payment);
      const haystack = [
        payment.id,
        reservationId(payment),
        payment.client?.name,
        payment.client?.email,
        payment.intervenant?.name,
        payment.payment_intent_id,
        payment.stripe_transfer_id,
        reservation?.annonce?.titre,
      ]
        .join(" ")
        .toLowerCase();
      return (!keyword || haystack.includes(keyword)) &&
        (filter === "all" || normalizedStatus(payment) === filter);
    });
  }, [filter, getReservation, payments, search]);

  const replaceReservation = (updated: Reservation) => {
    setReservations((items) =>
      items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
    );
  };

  const refreshPaymentsOnly = async () => {
    const data = await adminApi.payments();
    setPayments(data.payments);
    setSummary(data.summary);
    setSelected((current) =>
      current ? data.payments.find((payment) => payment.id === current.id) || null : null
    );
  };

  const validatePrestation = async (reservation: Reservation) => {
    setActionId(reservation.id);
    setError("");
    setSuccess("");
    try {
      replaceReservation(await adminApi.validatePrestation(reservation.id));
      setSuccess("Prestation validée : le reversement au coach est maintenant autorisé.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de valider la prestation."));
    } finally {
      setActionId(null);
    }
  };

  const transfer = async (reservation: Reservation) => {
    if (!window.confirm("Confirmer ce reversement Stripe au coach ? Cette opération financière est réelle.")) return;
    setActionId(reservation.id);
    setError("");
    setSuccess("");
    try {
      replaceReservation(await adminApi.transferToCoach(reservation.id));
      await refreshPaymentsOnly();
      setSuccess("Reversement Stripe effectué avec succès.");
    } catch (caught) {
      setError(getApiError(caught, "Le reversement n’a pas pu être exécuté."));
    } finally {
      setActionId(null);
    }
  };

  const submitRefund = async () => {
    const reservation = getReservation(selected);
    if (!reservation) return;
    setActionId(reservation.id);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, unknown> = {
        reason: "requested_by_customer",
        admin_note: adminNote || "Remboursement décidé depuis la console d’administration",
      };
      if (refundAmount.trim()) payload.amount = Number(refundAmount);
      replaceReservation(await adminApi.refundReservation(reservation.id, payload));
      await refreshPaymentsOnly();
      setRefundOpen(false);
      setRefundAmount("");
      setAdminNote("");
      setSuccess("Le remboursement Stripe a été enregistré.");
    } catch (caught) {
      setError(getApiError(caught, "Le remboursement n’a pas pu être exécuté."));
    } finally {
      setActionId(null);
    }
  };

  const saveRates = async () => {
    const clientFee = Number(rates.clientFee);
    const coachCommission = Number(rates.coachCommission);
    if (![clientFee, coachCommission].every((value) => Number.isFinite(value) && value >= 0 && value <= 100)) {
      setError("Les taux doivent être compris entre 0 et 100 %.");
      return;
    }
    setSavingSettings(true);
    setError("");
    setSuccess("");
    try {
      await adminApi.updateBusinessSettings({
        client_service_fee_rate: clientFee,
        intervenant_commission_rate: coachCommission,
      });
      setSettingsOpen(false);
      setSuccess("Les paramètres financiers ont été mis à jour.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de mettre à jour les taux financiers."));
    } finally {
      setSavingSettings(false);
    }
  };

  const selectedReservation = getReservation(selected);

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Pilotage financier"
        title="Paiements & reversements"
        description="Contrôlez les encaissements, la part GotFit, les revenus coachs, les reversements Stripe et les remboursements."
        actions={<>
          <button type="button" className="ops-button ops-button--secondary" onClick={() => setSettingsOpen(true)}><Icon name="settings" size={16}/> Paramètres</button>
          <button type="button" className="ops-button ops-button--secondary" onClick={loadFinance}>
            <Icon name="refresh" size={16}/> Actualiser
          </button>
        </>}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Volume encaissé" value={currency(summary.total)} detail="Paiements suivis" icon="payment" tone="green"/>
        <MetricCard label="Revenus GotFit" value={currency(summary.totalGotfit)} detail="Frais + commissions" icon="trend" tone="orange"/>
        <MetricCard label="Part des coachs" value={currency(summary.totalIntervenant)} detail="Montant net cumulé" icon="wallet" tone="blue"/>
        <MetricCard label="Reversements prêts" value={waitingPayouts} detail="Action financière requise" icon="alert" tone={waitingPayouts ? "red" : "neutral"}/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Client, coach, réservation, identifiant Stripe…"/></label>
        <select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="all">Tous les paiements</option>
          <option value="paid">Encaissés</option>
          <option value="transferred">Reversés</option>
          <option value="pending">En attente</option>
          <option value="refunded">Remboursés</option>
          <option value="failed">Échoués</option>
        </select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Grand livre des transactions</h2><p>{filtered.length} transaction(s) affichée(s)</p></div></header>
        {loading ? <LoadingState label="Chargement des flux financiers…"/> : filtered.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Transaction</th><th>Client</th><th>Coach</th><th>État</th><th>Brut</th><th>GotFit</th><th>Coach</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((payment) => {
                  const badge = paymentBadge(payment);
                  const reservation = getReservation(payment);
                  return (
                    <tr key={payment.id}>
                      <td><div className="ops-stack"><strong>PAY-{String(payment.id).padStart(5, "0")}</strong><span>RES-{String(reservationId(payment) || "—").padStart(5, "0")} · {formatDate(payment.created_at)}</span></div></td>
                      <td><div className="ops-stack"><strong>{payment.client?.name || reservation?.client?.name || "Client"}</strong><span>{payment.client?.email || reservation?.client?.email}</span></div></td>
                      <td><div className="ops-stack"><strong>{payment.intervenant?.name || reservation?.intervenant?.name || "Coach"}</strong><span>{reservation?.intervenant?.stripe_onboarding_completed ? "Compte Stripe prêt" : "Stripe à contrôler"}</span></div></td>
                      <td><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></td>
                      <td><strong>{currency(payment.amount || reservation?.total_client_amount, payment.currency)}</strong></td>
                      <td>{currency(Number(payment.service_fee || 0) + Number(payment.commission || 0), payment.currency)}</td>
                      <td>{currency(payment.intervenant_amount || payment.net_amount || reservation?.intervenant_amount, payment.currency)}</td>
                      <td><div className="ops-row-actions"><button type="button" className="ops-row-action" onClick={() => setSelected(payment)}><Icon name="eye" size={13}/> Contrôler</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="payment" title="Aucune transaction" description="Aucun paiement ne correspond à la recherche ou au statut sélectionné."/>}
      </section>

      {selected && !refundOpen && (
        <Modal
          eyebrow={"Transaction PAY-" + String(selected.id).padStart(5, "0")}
          title="Contrôle du paiement"
          onClose={() => setSelected(null)}
          footer={
            <>
              {selectedReservation && normalizedStatus(selected) !== "refunded" && normalizedStatus(selected) !== "failed" && (
                <button type="button" className="ops-button ops-button--danger" onClick={() => setRefundOpen(true)}>Rembourser</button>
              )}
              {selectedReservation && !["validated", "transferred", "refunded"].includes(String(selectedReservation.prestation_status)) && (
                <button type="button" className="ops-button ops-button--secondary" disabled={actionId === selectedReservation.id} onClick={() => validatePrestation(selectedReservation)}>Valider la prestation</button>
              )}
              {selectedReservation?.prestation_status === "validated" && !selectedReservation.stripe_transfer_id && (
                <button type="button" className="ops-button ops-button--primary" disabled={actionId === selectedReservation.id} onClick={() => transfer(selectedReservation)}><Icon name="wallet" size={15}/> Reverser au coach</button>
              )}
            </>
          }
        >
          <div className="ops-detail-grid">
            <div className="ops-detail"><span>Client</span><strong>{selected.client?.name || selectedReservation?.client?.name || "Non renseigné"}<br/>{selected.client?.email || selectedReservation?.client?.email}</strong></div>
            <div className="ops-detail"><span>Coach</span><strong>{selected.intervenant?.name || selectedReservation?.intervenant?.name || "Non renseigné"}<br/>{selected.intervenant?.email || selectedReservation?.intervenant?.email}</strong></div>
            <div className="ops-detail"><span>Identifiant Stripe</span><strong>{selected.payment_intent_id || selectedReservation?.payment_intent_id || "Non disponible"}</strong></div>
            <div className="ops-detail"><span>Reversement Stripe</span><strong>{selected.stripe_transfer_id || selectedReservation?.stripe_transfer_id || "Non effectué"}</strong></div>
            <div className="ops-detail"><span>Statut paiement</span><strong>{selected.status || selectedReservation?.payment_status || "pending"}</strong></div>
            <div className="ops-detail"><span>Statut prestation</span><strong>{selectedReservation?.prestation_status || "Non rattachée"}</strong></div>
          </div>
          <div className="ops-finance-strip">
            <div><span>Payé par le client</span><strong>{currency(selected.amount || selectedReservation?.total_client_amount, selected.currency)}</strong></div>
            <div><span>Revenu GotFit</span><strong>{currency(Number(selected.service_fee || 0) + Number(selected.commission || 0), selected.currency)}</strong></div>
            <div><span>Net coach</span><strong>{currency(selected.intervenant_amount || selected.net_amount || selectedReservation?.intervenant_amount, selected.currency)}</strong></div>
          </div>
        </Modal>
      )}

      {selected && refundOpen && selectedReservation && (
        <Modal
          eyebrow="Opération Stripe sensible"
          title="Rembourser le client"
          onClose={() => setRefundOpen(false)}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={() => setRefundOpen(false)}>Annuler</button><button type="button" className="ops-button ops-button--danger" disabled={actionId === selectedReservation.id} onClick={submitRefund}>Confirmer le remboursement</button></>}
        >
          <Notice tone="info">Laissez le montant vide pour rembourser la totalité de {currency(selected.amount || selectedReservation.total_client_amount, selected.currency)}.</Notice>
          <div className="ops-form-grid" style={{ marginTop: 14 }}>
            <label className="ops-field"><span>Montant partiel en euros</span><input type="number" min="0.5" step="0.01" value={refundAmount} onChange={(event) => setRefundAmount(event.target.value)} placeholder="Vide = remboursement total"/></label>
            <label className="ops-field"><span>Réservation</span><input value={"RES-" + String(selectedReservation.id).padStart(5, "0")} disabled/></label>
            <label className="ops-field ops-detail--wide"><span>Justification administrative</span><textarea value={adminNote} onChange={(event) => setAdminNote(event.target.value)} placeholder="Contexte, demande du client et décision…"/></label>
          </div>
        </Modal>
      )}

      {settingsOpen && (
        <Modal
          eyebrow="Configuration business"
          title="Frais et commissions"
          onClose={() => setSettingsOpen(false)}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={() => setSettingsOpen(false)}>Annuler</button><button type="button" className="ops-button ops-button--primary" disabled={savingSettings} onClick={saveRates}>{savingSettings ? "Enregistrement…" : "Enregistrer les taux"}</button></>}
        >
          <Notice tone="info">Ces taux seront appliqués par Laravel lors du calcul des prochains paiements. Les transactions déjà créées ne sont pas recalculées.</Notice>
          <div className="ops-form-grid" style={{ marginTop: 14 }}>
            <label className="ops-field"><span>Frais de service client (%)</span><input type="number" min="0" max="100" step="0.01" value={rates.clientFee} onChange={(event) => setRates((current) => ({ ...current, clientFee: event.target.value }))}/></label>
            <label className="ops-field"><span>Commission coach (%)</span><input type="number" min="0" max="100" step="0.01" value={rates.coachCommission} onChange={(event) => setRates((current) => ({ ...current, coachCommission: event.target.value }))}/></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
