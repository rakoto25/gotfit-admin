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
import type { Pack as PackRecord, PackSession } from "../types/admin";

type Filter = "all" | "active" | "disputed" | "completed" | "refunded";

const money = (cents: unknown, currency = "EUR") =>
  new Intl.NumberFormat("fr-FR", { style: "currency", currency: currency || "EUR" }).format(
    (Number(cents ?? 0) || 0) / 100
  );

const dateTime = (value?: string | null) => {
  if (!value) return "Non planifiée";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("fr-FR", { dateStyle: "medium", timeStyle: "short" });
};

const packBadge = (status: string) => {
  if (status === "active") return { label: "Actif", tone: "info" as const };
  if (status === "completed") return { label: "Terminé", tone: "success" as const };
  if (status === "disputed") return { label: "Litige", tone: "danger" as const };
  if (status.includes("refund")) return { label: "Remboursé", tone: "danger" as const };
  return { label: status || "En attente", tone: "warning" as const };
};

const sessionBadge = (status: string) => {
  const labels: Record<string, string> = {
    pending: "En attente",
    awaiting_client_confirmation: "À confirmer",
    validated: "Validée",
    paid: "Payée",
    disputed: "Contestée",
    cancelled: "Annulée",
  };
  const tone = status === "paid" ? "success" : status === "disputed" ? "danger" :
    status === "validated" ? "info" : status === "cancelled" ? "dark" : "warning";
  return { label: labels[status] || status, tone } as const;
};

export default function Pack() {
  const [packs, setPacks] = useState<PackRecord[]>([]);
  const [selected, setSelected] = useState<PackRecord | null>(null);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadPacks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await adminApi.packs();
      setPacks(result);
      setSelected((current) => current ? result.find((pack) => pack.id === current.id) || null : null);
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger les packs payés."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadPacks);
  }, [loadPacks]);

  const totals = useMemo(() => ({
    collected: packs.reduce((sum, pack) => sum + Number(pack.amount_total || 0), 0),
    commission: packs.reduce((sum, pack) => sum + Number(pack.commission_amount || 0), 0),
    transferred: packs.reduce((sum, pack) => sum + Number(pack.amount_transferred || 0), 0),
    disputes: packs.flatMap((pack) => pack.sessions || []).filter((session) => session.status === "disputed").length,
  }), [packs]);

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return packs.filter((pack) => {
      const haystack = [pack.id, pack.offer?.title, pack.client?.name, pack.client?.email,
        pack.coach?.name, pack.coach?.email, pack.stripe_payment_intent_id].join(" ").toLowerCase();
      return (!keyword || haystack.includes(keyword)) && (filter === "all" || pack.status === filter);
    });
  }, [filter, packs, search]);

  const resolve = async (session: PackSession, decision: "validate" | "cancel") => {
    const wording = decision === "validate" ? "valider et déclencher le reversement" : "annuler sans reversement";
    if (!window.confirm(`Confirmer : ${wording} pour la séance ${session.sequence} ?`)) return;
    setActionId(session.id);
    setError("");
    setSuccess("");
    try {
      await adminApi.resolvePackSession(session.id, decision);
      await loadPacks();
      setSuccess(decision === "validate" ? "Litige résolu : séance validée et reversement traité." : "Litige résolu : séance annulée.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de résoudre ce litige."));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="ops-page">
      <PageHeader eyebrow="Stripe Connect" title="Packs & séances"
        description="Suivez l’encaissement intégral des packs et le reversement progressif au coach après validation de chaque séance."
        actions={<button type="button" className="ops-button ops-button--secondary" onClick={loadPacks}><Icon name="refresh" size={16}/> Actualiser</button>}/>

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Packs encaissés" value={money(totals.collected)} detail={`${packs.length} pack(s) payé(s)`} icon="payment" tone="green"/>
        <MetricCard label="Commission GotFit" value={money(totals.commission)} detail="Calculée avant reversement" icon="trend" tone="orange"/>
        <MetricCard label="Déjà reversé" value={money(totals.transferred)} detail="Transferts séance par séance" icon="wallet" tone="blue"/>
        <MetricCard label="Litiges ouverts" value={totals.disputes} detail="Décision administrateur requise" icon="alert" tone={totals.disputes ? "red" : "neutral"}/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Pack, offre, client, coach, identifiant Stripe…"/></label>
        <select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="all">Tous les packs</option><option value="active">Actifs</option>
          <option value="disputed">En litige</option><option value="completed">Terminés</option>
          <option value="refunded">Remboursés</option>
        </select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Registre des packs</h2><p>{filtered.length} pack(s) affiché(s)</p></div></header>
        {loading ? <LoadingState label="Chargement des packs et des séances…"/> : filtered.length ? (
          <div className="ops-table-wrap"><table className="ops-table">
            <thead><tr><th>Pack</th><th>Client</th><th>Coach</th><th>État</th><th>Progression</th><th>Encaissé</th><th>Reversé</th><th>Actions</th></tr></thead>
            <tbody>{filtered.map((pack) => { const badge = packBadge(pack.status); return (
              <tr key={pack.id}>
                <td><div className="ops-stack"><strong>PACK-{String(pack.id).padStart(5, "0")}</strong><span>{pack.offer?.title || "Offre personnalisée"}</span></div></td>
                <td><div className="ops-stack"><strong>{pack.client?.name || "Client"}</strong><span>{pack.client?.email}</span></div></td>
                <td><div className="ops-stack"><strong>{pack.coach?.name || "Coach"}</strong><span>{pack.coach?.email}</span></div></td>
                <td><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></td>
                <td><strong>{pack.completed_sessions || 0}/{pack.session_count}</strong></td>
                <td>{money(pack.amount_total, pack.currency)}</td><td>{money(pack.amount_transferred, pack.currency)}</td>
                <td><button type="button" className="ops-row-action" onClick={() => setSelected(pack)}><Icon name="eye" size={13}/> Contrôler</button></td>
              </tr>); })}</tbody>
          </table></div>
        ) : <EmptyState icon="wallet" title="Aucun pack trouvé" description="Les packs apparaîtront ici après confirmation du paiement Stripe."/>}
      </section>

      {selected && <Modal eyebrow={`PACK-${String(selected.id).padStart(5, "0")}`} title={selected.offer?.title || "Détail du pack"} onClose={() => setSelected(null)}>
        <div className="ops-detail-grid">
          <div className="ops-detail"><span>Client</span><strong>{selected.client?.name || "—"}<br/>{selected.client?.email}</strong></div>
          <div className="ops-detail"><span>Coach</span><strong>{selected.coach?.name || "—"}<br/>{selected.coach?.email}</strong></div>
          <div className="ops-detail"><span>Paiement Stripe</span><strong>{selected.stripe_payment_intent_id || "Non disponible"}</strong></div>
          <div className="ops-detail"><span>Cashback utilisé</span><strong>{money(selected.wallet_amount_used, selected.currency)}</strong></div>
        </div>
        <div className="ops-finance-strip"><div><span>Montant encaissé</span><strong>{money(selected.amount_total, selected.currency)}</strong></div><div><span>Commission GotFit</span><strong>{money(selected.commission_amount, selected.currency)}</strong></div><div><span>Net coach</span><strong>{money(selected.coach_net_amount, selected.currency)}</strong></div></div>
        <h3 className="ops-section-title">Séances et reversements</h3>
        <div className="pack-session-list">{(selected.sessions || []).map((session) => { const badge = sessionBadge(session.status); return (
          <article className="pack-session" key={session.id}>
            <div className="pack-session__heading"><div><strong>Séance {session.sequence}</strong><span>{dateTime(session.scheduled_at)}</span></div><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></div>
            <div className="pack-session__meta"><span>Dû au coach <strong>{money(session.amount_due, selected.currency)}</strong></span><span>Reversement <strong>{session.stripe_transfer_id || session.payout_status || "En attente"}</strong></span></div>
            {session.dispute_reason && <div className="pack-session__dispute"><strong>Motif du litige</strong><span>{session.dispute_reason}</span></div>}
            {session.payout_error && <div className="pack-session__dispute"><strong>Anomalie Stripe</strong><span>{session.payout_error}</span></div>}
            {session.status === "disputed" && <div className="ops-row-actions"><button type="button" className="ops-button ops-button--primary" disabled={actionId === session.id} onClick={() => resolve(session, "validate")}><Icon name="check" size={14}/> Valider et payer</button><button type="button" className="ops-button ops-button--secondary" disabled={actionId === session.id} onClick={() => resolve(session, "cancel")}><Icon name="reject" size={14}/> Annuler</button></div>}
          </article>); })}</div>
      </Modal>}
    </div>
  );
}
