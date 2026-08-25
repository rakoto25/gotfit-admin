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
import type { CredentialDocument } from "../types/admin";

type Filter = "all" | "en_attente" | "valide" | "refuse" | "expired";

const typeLabels: Record<string, string> = {
  diploma: "Diplôme",
  certification: "Certification",
  professional_card: "Carte professionnelle",
  identity: "Pièce d’identité",
  other: "Autre justificatif",
};

const normalizeStatus = (value?: string) => {
  const status = String(value || "en_attente").toLowerCase();
  if (["valide", "validé", "approved", "accepted"].includes(status)) return "valide";
  if (["refuse", "refusé", "rejected"].includes(status)) return "refuse";
  return "en_attente";
};

const documentBadge = (item: CredentialDocument) => {
  if (item.is_expired) return { label: "Expiré", tone: "danger" as const };
  const status = normalizeStatus(item.status);
  if (status === "valide") return { label: "Validé", tone: "success" as const };
  if (status === "refuse") return { label: "Refusé", tone: "danger" as const };
  return { label: "À vérifier", tone: "warning" as const };
};

const formatDate = (value?: string | null) => {
  if (!value) return "Non renseignée";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const fileUrl = (value?: string | null) => {
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const apiOrigin = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  return `${apiOrigin}/${value.replace(/^\//, "")}`;
};

export default function Document() {
  const [documents, setDocuments] = useState<CredentialDocument[]>([]);
  const [selected, setSelected] = useState<CredentialDocument | null>(null);
  const [rejecting, setRejecting] = useState<CredentialDocument | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDocuments = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setDocuments(await adminApi.documents());
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger les justificatifs professionnels."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDocuments);
  }, [loadDocuments]);

  const counts = useMemo(
    () => ({
      total: documents.length,
      pending: documents.filter((item) => normalizeStatus(item.status) === "en_attente").length,
      approved: documents.filter((item) => normalizeStatus(item.status) === "valide" && !item.is_expired).length,
      expired: documents.filter((item) => item.is_expired).length,
    }),
    [documents]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return documents.filter((item) => {
      const haystack = [
        item.id,
        item.name,
        item.document_type,
        item.document_number,
        item.issuing_organization,
        item.user?.name,
        item.user?.email,
        item.user?.siret,
      ].join(" ").toLowerCase();
      const matchesStatus =
        filter === "all" ||
        (filter === "expired" ? item.is_expired : normalizeStatus(item.status) === filter);
      return (!keyword || haystack.includes(keyword)) && matchesStatus;
    });
  }, [documents, filter, search]);

  const applyUpdate = (updated: CredentialDocument) => {
    setDocuments((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelected((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
  };

  const approve = async (item: CredentialDocument) => {
    setActionId(item.id);
    setError("");
    setSuccess("");
    try {
      applyUpdate(await adminApi.approveDocument(item.id));
      setSuccess(`Le document « ${item.name || "sans titre"} » a été validé.`);
    } catch (caught) {
      setError(getApiError(caught, "Impossible de valider le document."));
    } finally {
      setActionId(null);
    }
  };

  const submitRejection = async () => {
    if (!rejecting || !rejectionReason.trim()) {
      setError("Le motif du refus est obligatoire.");
      return;
    }
    setActionId(rejecting.id);
    setError("");
    setSuccess("");
    try {
      applyUpdate(await adminApi.rejectDocument(rejecting.id, rejectionReason.trim()));
      setSuccess(`Le document « ${rejecting.name || "sans titre"} » a été refusé.`);
      setRejecting(null);
      setRejectionReason("");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de refuser le document."));
    } finally {
      setActionId(null);
    }
  };

  const remove = async (item: CredentialDocument) => {
    if (!window.confirm(`Supprimer définitivement le document « ${item.name || item.id} » ?`)) return;
    setActionId(item.id);
    setError("");
    try {
      await adminApi.deleteDocument(item.id);
      setDocuments((items) => items.filter((document) => document.id !== item.id));
      setSelected(null);
      setSuccess("Document supprimé.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de supprimer le document."));
    } finally {
      setActionId(null);
    }
  };

  const openFile = (item: CredentialDocument) => {
    const url = fileUrl(item.file_url || item.file_path);
    if (url) window.open(url, "_blank", "noopener,noreferrer");
    else setError("Aucun fichier n’est disponible pour ce justificatif.");
  };

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Conformité & qualifications"
        title="Documents professionnels"
        description="Vérifiez les diplômes, certifications, cartes professionnelles et pièces d’identité avant d’autoriser les coachs."
        actions={<button type="button" className="ops-button ops-button--secondary" onClick={loadDocuments}><Icon name="refresh" size={16}/> Actualiser</button>}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Documents" value={counts.total} detail="Tous justificatifs" icon="document"/>
        <MetricCard label="À vérifier" value={counts.pending} detail="Décision requise" icon="clock" tone="orange"/>
        <MetricCard label="Conformes" value={counts.approved} detail="Validés et actifs" icon="shield" tone="green"/>
        <MetricCard label="Expirés" value={counts.expired} detail="Renouvellement nécessaire" icon="alert" tone={counts.expired ? "red" : "neutral"}/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Coach, SIRET, diplôme, organisme, numéro…"/></label>
        <select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}>
          <option value="all">Tous les documents</option>
          <option value="en_attente">À vérifier</option>
          <option value="valide">Validés</option>
          <option value="refuse">Refusés</option>
          <option value="expired">Expirés</option>
        </select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Registre de conformité</h2><p>{filtered.length} justificatif(s) affiché(s)</p></div></header>
        {loading ? <LoadingState label="Chargement des documents…"/> : filtered.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Document</th><th>Professionnel</th><th>Type</th><th>Référence</th><th>Expiration</th><th>État</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const badge = documentBadge(item);
                  return (
                    <tr key={item.id}>
                      <td><div className="ops-stack"><strong>{item.name || `Document #${item.id}`}</strong><span>Déposé le {formatDate(item.created_at)}</span></div></td>
                      <td><div className="ops-identity"><span className="ops-identity__avatar">{(item.user?.name || "GF").slice(0, 2)}</span><div><strong>{item.user?.name || "Utilisateur inconnu"}</strong><span>{item.user?.email || item.user?.siret || "—"}</span></div></div></td>
                      <td>{typeLabels[item.document_type || ""] || item.document_type || "Non classé"}</td>
                      <td><div className="ops-stack"><strong>{item.document_number || "—"}</strong><span>{item.issuing_organization || "Organisme non renseigné"}</span></div></td>
                      <td>{formatDate(item.expires_at)}</td>
                      <td><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></td>
                      <td><div className="ops-row-actions">
                        <button type="button" className="ops-row-action" onClick={() => setSelected(item)}><Icon name="eye" size={13}/> Examiner</button>
                        {normalizeStatus(item.status) === "en_attente" && <button type="button" className="ops-row-action success" disabled={actionId === item.id} onClick={() => approve(item)}><Icon name="check" size={13}/> Valider</button>}
                        {normalizeStatus(item.status) === "en_attente" && <button type="button" className="ops-row-action danger" disabled={actionId === item.id} onClick={() => { setRejecting(item); setRejectionReason(""); }}><Icon name="reject" size={13}/> Refuser</button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="document" title="Aucun justificatif" description="Aucun document ne correspond aux critères sélectionnés."/>}
      </section>

      {selected && !rejecting && (
        <Modal
          eyebrow={`Document DOC-${String(selected.id).padStart(5, "0")}`}
          title={selected.name || "Justificatif professionnel"}
          onClose={() => setSelected(null)}
          footer={
            <>
              <button type="button" className="ops-button ops-button--danger" disabled={actionId === selected.id} onClick={() => remove(selected)}><Icon name="trash" size={14}/> Supprimer</button>
              <button type="button" className="ops-button ops-button--secondary" onClick={() => openFile(selected)}><Icon name="eye" size={14}/> Ouvrir le fichier</button>
              {normalizeStatus(selected.status) === "en_attente" && <button type="button" className="ops-button ops-button--danger" onClick={() => { setRejecting(selected); setRejectionReason(""); }}>Refuser</button>}
              {normalizeStatus(selected.status) !== "valide" && <button type="button" className="ops-button ops-button--success" disabled={actionId === selected.id} onClick={() => approve(selected)}>Valider</button>}
            </>
          }
        >
          <div className="ops-detail-grid">
            <div className="ops-detail"><span>Professionnel</span><strong>{selected.user?.name || "Inconnu"}<br/>{selected.user?.email}</strong></div>
            <div className="ops-detail"><span>SIRET</span><strong>{selected.user?.siret || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>Nature</span><strong>{typeLabels[selected.document_type || ""] || selected.document_type || "Autre"}</strong></div>
            <div className="ops-detail"><span>Numéro</span><strong>{selected.document_number || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>Organisme</span><strong>{selected.issuing_organization || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>Validité</span><strong>Du {formatDate(selected.issued_at)} au {formatDate(selected.expires_at)}</strong></div>
            {selected.rejection_reason && <div className="ops-detail ops-detail--wide"><span>Motif du précédent refus</span><strong>{selected.rejection_reason}</strong></div>}
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal
          eyebrow="Décision de conformité"
          title="Refuser le justificatif"
          onClose={() => setRejecting(null)}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={() => setRejecting(null)}>Annuler</button><button type="button" className="ops-button ops-button--danger" disabled={actionId === rejecting.id || !rejectionReason.trim()} onClick={submitRejection}>Confirmer le refus</button></>}
        >
          <Notice tone="info">Le motif sera conservé dans le dossier afin d’expliquer précisément la correction attendue.</Notice>
          <label className="ops-field" style={{ marginTop: 14 }}><span>Motif obligatoire</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Ex. document illisible, date expirée, nom incohérent…"/></label>
        </Modal>
      )}
    </div>
  );
}
