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
import type { Announcement, AnnouncementStatus } from "../types/admin";

type StatusFilter = "all" | AnnouncementStatus;
type TypeFilter = "all" | "coach_service" | "client_request";
type AnnouncementForm = {
  titre: string;
  contenu: string;
  category: string;
  price: string;
  duration: string;
};

const titleOf = (item: Announcement) => item.titre || item.title || "Annonce sans titre";
const descriptionOf = (item: Announcement) => item.contenu || item.description || "Aucune description.";
const locationOf = (item: Announcement) => item.city || item.location || item.address || "Non précisé";
const typeLabel = (item: Announcement) =>
  item.announcement_type === "client_request" ? "Recherche client" : "Service coach";

const money = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "Non précisé";
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(Number(value) || 0);
};

const formatDate = (value?: string) => {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const statusPresentation = (status?: string) => {
  if (status === "valide") return { label: "Publiée", tone: "success" as const };
  if (status === "refuse") return { label: "Refusée", tone: "danger" as const };
  if (status === "brouillon") return { label: "Brouillon", tone: "neutral" as const };
  return { label: "À modérer", tone: "warning" as const };
};

const imageUrl = (item: Announcement) => {
  if (!item.image) return "";
  if (item.image.startsWith("http")) return item.image;
  const apiUrl = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  return apiUrl + "/storage/" + item.image.replace(/^\//, "");
};

export default function Annonce() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [selected, setSelected] = useState<Announcement | null>(null);
  const [editing, setEditing] = useState<Announcement | null>(null);
  const [form, setForm] = useState<AnnouncementForm>({ titre: "", contenu: "", category: "", price: "", duration: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");

  const loadAnnouncements = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setAnnouncements(await adminApi.announcements());
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger les annonces."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadAnnouncements);
  }, [loadAnnouncements]);

  const counts = useMemo(
    () => ({
      total: announcements.length,
      pending: announcements.filter((item) => item.status === "en_attente").length,
      clients: announcements.filter((item) => item.announcement_type === "client_request").length,
      published: announcements.filter((item) => item.status === "valide").length,
    }),
    [announcements]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return announcements.filter((item) => {
      const haystack = [
        titleOf(item),
        descriptionOf(item),
        item.user?.name,
        item.user?.email,
        locationOf(item),
        item.category,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return (
        (!keyword || haystack.includes(keyword)) &&
        (statusFilter === "all" || item.status === statusFilter) &&
        (typeFilter === "all" || item.announcement_type === typeFilter)
      );
    });
  }, [announcements, search, statusFilter, typeFilter]);

  const replaceAnnouncement = (updated: Announcement) => {
    setAnnouncements((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelected((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
  };

  const runAction = async (item: Announcement, action: "approve" | "reject") => {
    if (item.status !== "en_attente") return;
    setActionId(item.id);
    setError("");
    setSuccess("");
    try {
      const updated = action === "approve"
        ? await adminApi.approveAnnouncement(item.id)
        : await adminApi.rejectAnnouncement(item.id);
      replaceAnnouncement(updated);
      setSuccess(action === "approve" ? "Annonce validée avec succès." : "Annonce refusée avec succès.");
    } catch (caught) {
      setError(getApiError(caught, "La décision n’a pas pu être enregistrée."));
    } finally {
      setActionId(null);
    }
  };

  const openEdit = (item: Announcement) => {
    setSelected(null);
    setEditing(item);
    setForm({
      titre: titleOf(item),
      contenu: item.contenu || item.description || "",
      category: item.category || "",
      price: item.price === null || item.price === undefined ? "" : String(item.price),
      duration: item.duration === null || item.duration === undefined ? "" : String(item.duration),
    });
  };

  const saveAnnouncement = async () => {
    if (!editing || !form.titre.trim() || !form.contenu.trim()) {
      setError("Le titre et la description sont obligatoires.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, unknown> = {
        titre: form.titre.trim(),
        contenu: form.contenu.trim(),
        category: form.category.trim() || null,
      };
      if (form.price.trim()) payload.price = Number(form.price);
      if (form.duration.trim()) payload.duration = Number(form.duration);
      const updated = await adminApi.updateAnnouncement(editing.id, payload);
      replaceAnnouncement(updated);
      setEditing(null);
      setSuccess("Annonce modifiée avec succès.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de modifier l’annonce."));
    } finally {
      setSaving(false);
    }
  };

  const deleteAnnouncement = async (item: Announcement) => {
    if (!window.confirm("Supprimer définitivement « " + titleOf(item) + " » ?")) return;
    setActionId(item.id);
    setError("");
    try {
      await adminApi.deleteAnnouncement(item.id);
      setAnnouncements((items) => items.filter((candidate) => candidate.id !== item.id));
      setSelected(null);
      setSuccess("Annonce supprimée.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de supprimer l’annonce."));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Marketplace"
        title="Modération des annonces"
        description="Examinez les prestations proposées par les coachs et les recherches publiées par les clients avant leur mise en ligne."
        actions={
          <button type="button" className="ops-button ops-button--secondary" onClick={loadAnnouncements}>
            <Icon name="refresh" size={16}/> Actualiser
          </button>
        }
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Total annonces" value={counts.total} detail="Tous les contenus" icon="announcement"/>
        <MetricCard label="À modérer" value={counts.pending} detail="Décision requise" icon="clock" tone="orange"/>
        <MetricCard label="Recherches clients" value={counts.clients} detail="Demandes de coaching" icon="users" tone="blue"/>
        <MetricCard label="Publiées" value={counts.published} detail="Visibles sur le site" icon="check" tone="green"/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search">
          <Icon name="search" size={18}/>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Titre, auteur, catégorie ou ville…"
          />
        </label>
        <select className="ops-select" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as TypeFilter)}>
          <option value="all">Tous les types</option>
          <option value="coach_service">Services coach</option>
          <option value="client_request">Recherches clients</option>
        </select>
        <select className="ops-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}>
          <option value="all">Tous les statuts</option>
          <option value="en_attente">À modérer</option>
          <option value="valide">Publiées</option>
          <option value="refuse">Refusées</option>
          <option value="brouillon">Brouillons</option>
        </select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header">
          <div><h2>File de modération</h2><p>{filtered.length} résultat(s) selon vos filtres</p></div>
        </header>

        {loading ? (
          <LoadingState label="Chargement des annonces…"/>
        ) : filtered.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead>
                <tr><th>Annonce</th><th>Type</th><th>Auteur</th><th>Prix</th><th>Localisation</th><th>Statut</th><th>Actions</th></tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const status = statusPresentation(item.status);
                  return (
                    <tr key={item.id}>
                      <td><div className="ops-stack"><strong>{titleOf(item)}</strong><span>{item.category || "Sans catégorie"} · {formatDate(item.created_at)}</span></div></td>
                      <td><StatusBadge tone={item.announcement_type === "client_request" ? "info" : "dark"}>{typeLabel(item)}</StatusBadge></td>
                      <td><div className="ops-stack"><strong>{item.user?.name || "Utilisateur"}</strong><span>{item.user?.email || "Email indisponible"}</span></div></td>
                      <td>{money(item.price)}</td>
                      <td>{item.is_online ? "En ligne" : locationOf(item)}</td>
                      <td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                      <td>
                        <div className="ops-row-actions">
                          <button type="button" className="ops-row-action" onClick={() => setSelected(item)}><Icon name="eye" size={13}/> Examiner</button>
                          <button type="button" className="ops-row-action primary" onClick={() => openEdit(item)}><Icon name="settings" size={13}/> Modifier</button>
                          {item.status === "en_attente" && <button type="button" className="ops-row-action success" disabled={actionId === item.id} onClick={() => runAction(item, "approve")}><Icon name="check" size={13}/> Valider</button>}
                          {item.status === "en_attente" && <button type="button" className="ops-row-action danger" disabled={actionId === item.id} onClick={() => runAction(item, "reject")}><Icon name="reject" size={13}/> Refuser</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState icon="announcement" title="Aucune annonce trouvée" description="Modifiez les filtres ou actualisez les données de la marketplace."/>
        )}
      </section>

      {selected && (
        <Modal
          eyebrow={typeLabel(selected)}
          title={titleOf(selected)}
          onClose={() => setSelected(null)}
          footer={
            <>
              <button type="button" className="ops-button ops-button--danger" disabled={actionId === selected.id} onClick={() => deleteAnnouncement(selected)}><Icon name="trash" size={15}/> Supprimer</button>
              <button type="button" className="ops-button ops-button--secondary" onClick={() => openEdit(selected)}><Icon name="settings" size={15}/> Modifier</button>
              {selected.status === "en_attente" && <button type="button" className="ops-button ops-button--danger" disabled={actionId === selected.id} onClick={() => runAction(selected, "reject")}>Refuser</button>}
              {selected.status === "en_attente" && <button type="button" className="ops-button ops-button--primary" disabled={actionId === selected.id} onClick={() => runAction(selected, "approve")}><Icon name="check" size={15}/> Valider</button>}
            </>
          }
        >
          {imageUrl(selected) && <img src={imageUrl(selected)} alt="" style={{ width: "100%", maxHeight: 260, objectFit: "cover", borderRadius: 16, marginBottom: 14 }}/>}
          <div className="ops-detail-grid">
            <div className="ops-detail"><span>Auteur</span><strong>{selected.user?.name || "Utilisateur"}<br/>{selected.user?.email}</strong></div>
            <div className="ops-detail"><span>Statut du compte</span><strong>{selected.user?.account_status || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>Catégorie</span><strong>{selected.category || selected.type_prestation || "Non précisée"}</strong></div>
            <div className="ops-detail"><span>Prix / budget</span><strong>{money(selected.price)}</strong></div>
            <div className="ops-detail"><span>Format</span><strong>{selected.is_online ? "En ligne" : locationOf(selected)}</strong></div>
            <div className="ops-detail"><span>Durée</span><strong>{selected.duration ? selected.duration + " min" : "Non précisée"}</strong></div>
            <div className="ops-detail ops-detail--wide"><span>Description</span><strong>{descriptionOf(selected)}</strong></div>
          </div>
        </Modal>
      )}

      {editing && (
        <Modal
          eyebrow={`Annonce ANN-${String(editing.id).padStart(5, "0")}`}
          title="Modifier l’annonce"
          onClose={() => setEditing(null)}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={() => setEditing(null)}>Annuler</button><button type="button" className="ops-button ops-button--primary" disabled={saving || !form.titre.trim() || !form.contenu.trim()} onClick={saveAnnouncement}>{saving ? "Enregistrement…" : "Enregistrer"}</button></>}
        >
          <Notice tone="info">Le statut actuel sera conservé lors d’une correction effectuée par l’administration.</Notice>
          <div className="ops-form-grid" style={{ marginTop: 14 }}>
            <label className="ops-field ops-detail--wide"><span>Titre</span><input value={form.titre} onChange={(event) => setForm((current) => ({ ...current, titre: event.target.value }))} maxLength={255}/></label>
            <label className="ops-field ops-detail--wide"><span>Description</span><textarea value={form.contenu} onChange={(event) => setForm((current) => ({ ...current, contenu: event.target.value }))}/></label>
            <label className="ops-field"><span>Catégorie</span><input value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} maxLength={100}/></label>
            <label className="ops-field"><span>Prix (€)</span><input type="number" min="0" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}/></label>
            <label className="ops-field"><span>Durée (minutes)</span><input type="number" min="15" max="480" value={form.duration} onChange={(event) => setForm((current) => ({ ...current, duration: event.target.value }))}/></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
