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
import type { AccountStatus, AdminUser, CredentialDocument } from "../types/admin";

type RoleFilter = "all" | "admin" | "intervenant" | "client" | "structure";
type StatusFilter = "all" | AccountStatus;
type PageToken = number | "ellipsis-start" | "ellipsis-end";
type UserForm = {
  name: string;
  display_name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  role: Exclude<RoleFilter, "all">;
  account_status: AccountStatus;
  siret: string;
  bio: string;
  coach_title: string;
  coach_speciality: string;
  coach_experience_years: string;
};

const emptyForm: UserForm = {
  name: "",
  display_name: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  role: "client",
  account_status: "approved",
  siret: "",
  bio: "",
  coach_title: "",
  coach_speciality: "",
  coach_experience_years: "",
};

const normalizeStatus = (user: AdminUser): AccountStatus => {
  const value = String(user.account_status || user.status || "pending").toLowerCase();
  if (["approved", "active", "actif", "valide", "validé", "accepte", "accepté"].includes(value)) return "approved";
  if (["rejected", "refuse", "refusé"].includes(value)) return "rejected";
  if (["suspended", "suspendu", "blocked", "bloque", "bloqué"].includes(value)) return "suspended";
  return "pending";
};

const roleSlug = (user: AdminUser): Exclude<RoleFilter, "all"> => {
  const value = String(user.roles?.[0]?.slug || user.roles?.[0]?.name || "client").toLowerCase();
  if (value.includes("admin")) return "admin";
  if (value.includes("intervenant") || value.includes("coach")) return "intervenant";
  if (value.includes("structure")) return "structure";
  return "client";
};

const roleLabel: Record<Exclude<RoleFilter, "all">, string> = {
  admin: "Administrateur",
  intervenant: "Coach",
  client: "Client",
  structure: "Structure",
};

const statusBadge = (user: AdminUser) => {
  const status = normalizeStatus(user);
  if (status === "approved") return { label: "Actif", tone: "success" as const };
  if (status === "rejected") return { label: "Refusé", tone: "danger" as const };
  if (status === "suspended") return { label: "Suspendu", tone: "danger" as const };
  return { label: "À valider", tone: "warning" as const };
};

const formatDate = (value?: string | null) => {
  if (!value) return "Jamais";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("fr-FR", { day: "2-digit", month: "short", year: "numeric" });
};

const formFromUser = (user: AdminUser): UserForm => ({
  name: user.name || "",
  display_name: user.display_name || user.name || "",
  email: user.email || "",
  password: "",
  phone: user.phone || "",
  address: user.address || "",
  role: roleSlug(user),
  account_status: normalizeStatus(user),
  siret: user.siret || "",
  bio: user.bio || "",
  coach_title: user.coach_title || "",
  coach_speciality: user.coach_speciality || "",
  coach_experience_years: user.coach_experience_years === null || user.coach_experience_years === undefined ? "" : String(user.coach_experience_years),
});

const documentTypeLabel = (document: CredentialDocument) => {
  if (document.document_type === "diploma") return "Diplôme";
  if (document.document_type === "certification") return "Certification";
  return document.name || "Justificatif professionnel";
};

const isDiplomaDocument = (document: CredentialDocument) => {
  const type = String(document.document_type || "").toLowerCase();
  const name = String(document.name || "").toLowerCase();
  return ["diploma", "certification"].includes(type) || /dipl[oô]me|certificat/.test(name);
};

const documentFileUrl = (document: CredentialDocument) => {
  const value = document.file_url || document.file_path;
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;

  const apiOrigin = String(import.meta.env.VITE_API_URL || "").replace(/\/api\/?$/, "");
  const normalizedPath = value.replace(/^\//, "");
  const publicPath = normalizedPath.startsWith("storage/")
    ? normalizedPath
    : `storage/${normalizedPath}`;
  return `${apiOrigin}/${publicPath}`;
};

const paginationTokens = (currentPage: number, totalPages: number): PageToken[] => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const visiblePages = new Set([1, totalPages, currentPage - 1, currentPage, currentPage + 1]);
  const pages = [...visiblePages]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((first, second) => first - second);
  const tokens: PageToken[] = [];

  pages.forEach((page, index) => {
    const previous = pages[index - 1];
    if (previous && page - previous > 1) {
      tokens.push(previous === 1 ? "ellipsis-start" : "ellipsis-end");
    }
    tokens.push(page);
  });

  return tokens;
};

export default function User() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [rejecting, setRejecting] = useState<AdminUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [coachDocuments, setCoachDocuments] = useState<CredentialDocument[]>([]);
  const [documentsLoading, setDocumentsLoading] = useState(false);
  const [documentsError, setDocumentsError] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setUsers(await adminApi.users());
      setPage(1);
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger les comptes utilisateurs."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadUsers);
  }, [loadUsers]);

  const counts = useMemo(
    () => ({
      total: users.length,
      pending: users.filter((user) => normalizeStatus(user) === "pending").length,
      coaches: users.filter((user) => roleSlug(user) === "intervenant").length,
      stripeReady: users.filter((user) => roleSlug(user) === "intervenant" && user.stripe_onboarding_completed).length,
    }),
    [users]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return users.filter((user) => {
      const haystack = [user.id, user.name, user.display_name, user.email, user.phone, user.siret, user.coach_speciality].join(" ").toLowerCase();
      return (
        (!keyword || haystack.includes(keyword)) &&
        (roleFilter === "all" || roleSlug(user) === roleFilter) &&
        (statusFilter === "all" || normalizeStatus(user) === statusFilter)
      );
    });
  }, [roleFilter, search, statusFilter, users]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const firstVisibleIndex = (currentPage - 1) * pageSize;
  const paginatedUsers = filtered.slice(firstVisibleIndex, firstVisibleIndex + pageSize);
  const visiblePageTokens = paginationTokens(currentPage, totalPages);
  const diplomaDocuments = useMemo(
    () => coachDocuments.filter(isDiplomaDocument),
    [coachDocuments]
  );

  const applyUpdate = (updated: AdminUser) => {
    setUsers((items) => items.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
    setSelected((item) => (item?.id === updated.id ? { ...item, ...updated } : item));
  };

  const openCreate = () => {
    setEditing("new");
    setForm(emptyForm);
    setError("");
  };

  const openEdit = (user: AdminUser) => {
    setEditing(user);
    setForm(formFromUser(user));
    setError("");
  };

  const openDossier = async (user: AdminUser) => {
    setSelected(user);
    setCoachDocuments([]);
    setDocumentsError("");

    if (roleSlug(user) !== "intervenant") return;

    setDocumentsLoading(true);
    try {
      setCoachDocuments(await adminApi.userDocuments(user.id));
    } catch (caught) {
      setDocumentsError(getApiError(caught, "Impossible de charger les diplômes de ce coach."));
    } finally {
      setDocumentsLoading(false);
    }
  };

  const closeDossier = () => {
    setSelected(null);
    setCoachDocuments([]);
    setDocumentsError("");
    setDocumentsLoading(false);
  };

  const downloadDiploma = (document: CredentialDocument) => {
    const url = documentFileUrl(document);
    if (!url) {
      setDocumentsError("Le fichier de ce diplôme n’est pas disponible.");
      return;
    }

    const link = window.document.createElement("a");
    link.href = url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.download = document.name || `diplome-coach-${selected?.id || document.id}`;
    window.document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const updateForm = (key: keyof UserForm, value: string) => {
    setForm((current) => ({ ...current, [key]: value }));
  };

  const saveUser = async () => {
    if (!form.name.trim() || !form.email.trim() || (editing === "new" && form.password.length < 6)) {
      setError("Le nom, l’e-mail et un mot de passe d’au moins 6 caractères sont requis pour un nouveau compte.");
      return;
    }
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const payload: Record<string, unknown> = {
        name: form.name.trim(),
        display_name: form.display_name.trim() || null,
        email: form.email.trim(),
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        role: form.role,
        account_status: form.account_status,
        siret: form.siret.replace(/\D/g, "") || null,
        bio: form.bio.trim() || null,
        coach_title: form.coach_title.trim() || null,
        coach_speciality: form.coach_speciality.trim() || null,
        coach_experience_years: form.coach_experience_years ? Number(form.coach_experience_years) : null,
      };
      if (form.password) payload.password = form.password;

      if (editing === "new") {
        const created = await adminApi.createUser(payload);
        setUsers((items) => [created, ...items]);
        setPage(1);
        setSuccess("Le compte a été créé.");
      } else if (editing) {
        applyUpdate(await adminApi.updateUser(editing.id, payload));
        setSuccess("Le compte a été mis à jour.");
      }
      setEditing(null);
    } catch (caught) {
      setError(getApiError(caught, "Impossible d’enregistrer le compte."));
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (user: AdminUser, status: AccountStatus, reason?: string) => {
    setActionId(user.id);
    setError("");
    setSuccess("");
    try {
      const result = await adminApi.validateUser(user.id, status, reason);
      applyUpdate(result.user);
      setSuccess(
        result.message ||
          (status === "approved"
            ? roleSlug(user) === "intervenant"
              ? "Compte coach autorisé. L’email de validation a été déclenché."
              : "Compte autorisé."
            : status === "suspended"
              ? "Compte suspendu."
              : "Compte refusé.")
      );
      setRejecting(null);
      setRejectionReason("");
    } catch (caught) {
      setError(getApiError(caught, "Le statut du compte n’a pas pu être modifié."));
    } finally {
      setActionId(null);
    }
  };

  const toggleSiret = async (user: AdminUser) => {
    setActionId(user.id);
    setError("");
    try {
      applyUpdate(await adminApi.verifySiret(user.id, !user.siret_verified_at));
      setSuccess(user.siret_verified_at ? "La vérification SIRET a été retirée." : "Le SIRET a été vérifié.");
    } catch (caught) {
      setError(getApiError(caught, "La vérification du SIRET a échoué."));
    } finally {
      setActionId(null);
    }
  };

  const removeUser = async (user: AdminUser) => {
    if (!window.confirm(`Supprimer définitivement le compte de ${user.name || user.email} ?`)) return;
    setActionId(user.id);
    setError("");
    try {
      await adminApi.deleteUser(user.id);
      setUsers((items) => items.filter((item) => item.id !== user.id));
      setSelected(null);
      setSuccess("Compte supprimé.");
    } catch (caught) {
      setError(getApiError(caught, "Impossible de supprimer ce compte."));
    } finally {
      setActionId(null);
    }
  };

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Comptes & habilitations"
        title="Utilisateurs"
        description="Pilotez l’onboarding, les rôles, la conformité professionnelle, Stripe et l’accès à la plateforme."
        actions={<><button type="button" className="ops-button ops-button--secondary" onClick={loadUsers}><Icon name="refresh" size={16}/> Actualiser</button><button type="button" className="ops-button ops-button--primary" onClick={openCreate}><Icon name="users" size={16}/> Nouveau compte</button></>}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Utilisateurs" value={counts.total} detail="Tous les rôles" icon="users"/>
        <MetricCard label="À valider" value={counts.pending} detail="Décision requise" icon="clock" tone="orange"/>
        <MetricCard label="Coachs" value={counts.coaches} detail="Intervenants inscrits" icon="shield" tone="green"/>
        <MetricCard label="Stripe opérationnel" value={counts.stripeReady} detail="Coachs prêts au reversement" icon="payment" tone="blue"/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Nom, e-mail, téléphone, SIRET, spécialité…"/></label>
        <select className="ops-select" value={roleFilter} onChange={(event) => { setRoleFilter(event.target.value as RoleFilter); setPage(1); }}><option value="all">Tous les rôles</option><option value="intervenant">Coachs</option><option value="client">Clients</option><option value="structure">Structures</option><option value="admin">Administrateurs</option></select>
        <select className="ops-select" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as StatusFilter); setPage(1); }}><option value="all">Tous les statuts</option><option value="pending">À valider</option><option value="approved">Actifs</option><option value="rejected">Refusés</option><option value="suspended">Suspendus</option></select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Répertoire opérationnel</h2><p>{filtered.length} compte(s) · page {currentPage} sur {totalPages}</p></div></header>
        {loading ? <LoadingState label="Chargement des utilisateurs…"/> : filtered.length ? (
          <>
            <div className="ops-table-wrap">
              <table className="ops-table">
                <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Compte</th><th>Conformité coach</th><th>Dernière activité</th><th>Actions</th></tr></thead>
                <tbody>
                  {paginatedUsers.map((user) => {
                    const badge = statusBadge(user);
                    const role = roleSlug(user);
                    return (
                      <tr key={user.id}>
                        <td><div className="ops-identity"><span className="ops-identity__avatar">{user.photo_url ? <img src={user.photo_url} alt=""/> : (user.name || "GF").slice(0, 2)}</span><div><strong>{user.name || `Utilisateur #${user.id}`}</strong><span>{user.email || user.phone || "Coordonnées indisponibles"}</span></div></div></td>
                        <td><StatusBadge tone={role === "admin" ? "dark" : role === "intervenant" ? "info" : "neutral"}>{roleLabel[role]}</StatusBadge></td>
                        <td><StatusBadge tone={badge.tone}>{badge.label}</StatusBadge></td>
                        <td>{role === "intervenant" ? <div className="ops-stack"><strong>{user.siret_verified_at ? "SIRET vérifié" : user.siret ? "SIRET à vérifier" : "SIRET absent"}</strong><span>{user.stripe_onboarding_completed ? "Stripe opérationnel" : "Stripe incomplet"}</span></div> : "—"}</td>
                        <td><div className="ops-stack"><strong>{formatDate(user.last_login_at)}</strong><span>Inscrit le {formatDate(user.created_at)}</span></div></td>
                        <td><div className="ops-row-actions">
                          <button type="button" className="ops-row-action" onClick={() => openDossier(user)}><Icon name="eye" size={13}/> Dossier</button>
                          {normalizeStatus(user) !== "approved" && <button type="button" className="ops-row-action success" disabled={actionId === user.id} onClick={() => changeStatus(user, "approved")}><Icon name="check" size={13}/> Autoriser</button>}
                          {normalizeStatus(user) === "pending" && <button type="button" className="ops-row-action danger" onClick={() => { setRejecting(user); setRejectionReason(""); }}><Icon name="reject" size={13}/> Refuser</button>}
                        </div></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <nav className="ops-pagination" aria-label="Pagination des utilisateurs">
              <div className="ops-pagination__summary">
                <strong>{firstVisibleIndex + 1}–{Math.min(firstVisibleIndex + pageSize, filtered.length)}</strong>
                <span>sur {filtered.length} utilisateurs</span>
              </div>
              <div className="ops-pagination__controls">
                <button type="button" className="ops-page-button ops-page-button--wide" disabled={currentPage === 1} onClick={() => setPage(Math.max(1, currentPage - 1))}>Précédent</button>
                {visiblePageTokens.map((token) => typeof token === "number" ? (
                  <button key={token} type="button" className={`ops-page-button ${token === currentPage ? "active" : ""}`} aria-current={token === currentPage ? "page" : undefined} onClick={() => setPage(token)}>{token}</button>
                ) : <span className="ops-page-ellipsis" key={token}>…</span>)}
                <button type="button" className="ops-page-button ops-page-button--wide" disabled={currentPage === totalPages} onClick={() => setPage(Math.min(totalPages, currentPage + 1))}>Suivant</button>
              </div>
              <label className="ops-pagination__size"><span>Par page</span><select value={pageSize} onChange={(event) => { setPageSize(Number(event.target.value)); setPage(1); }}><option value="10">10</option><option value="20">20</option><option value="50">50</option></select></label>
            </nav>
          </>
        ) : <EmptyState icon="users" title="Aucun compte" description="Aucun utilisateur ne correspond aux filtres sélectionnés."/>}
      </section>

      {selected && !editing && !rejecting && (
        <Modal
          eyebrow={`Compte USR-${String(selected.id).padStart(5, "0")}`}
          title={selected.name || "Dossier utilisateur"}
          onClose={closeDossier}
          footer={
            <>
              <button type="button" className="ops-button ops-button--danger" disabled={actionId === selected.id} onClick={() => removeUser(selected)}><Icon name="trash" size={14}/> Supprimer</button>
              {normalizeStatus(selected) === "approved" ? <button type="button" className="ops-button ops-button--secondary" disabled={actionId === selected.id} onClick={() => changeStatus(selected, "suspended")}>Suspendre</button> : <button type="button" className="ops-button ops-button--success" disabled={actionId === selected.id} onClick={() => changeStatus(selected, "approved")}>Autoriser</button>}
              {roleSlug(selected) === "intervenant" && selected.siret && <button type="button" className="ops-button ops-button--secondary" disabled={actionId === selected.id} onClick={() => toggleSiret(selected)}>{selected.siret_verified_at ? "Retirer la vérification SIRET" : "Vérifier le SIRET"}</button>}
              <button type="button" className="ops-button ops-button--primary" onClick={() => openEdit(selected)}><Icon name="settings" size={14}/> Modifier</button>
            </>
          }
        >
          <div className="ops-detail-grid">
            <div className="ops-detail"><span>Rôle</span><strong>{roleLabel[roleSlug(selected)]}</strong></div>
            <div className="ops-detail"><span>Statut du compte</span><strong>{statusBadge(selected).label}</strong></div>
            <div className="ops-detail"><span>Pseudo public</span><strong>{selected.display_name || selected.name || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>E-mail</span><strong>{selected.email || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>Téléphone</span><strong>{selected.phone || "Non renseigné"}</strong></div>
            <div className="ops-detail ops-detail--wide"><span>Adresse</span><strong>{selected.address || "Non renseignée"}</strong></div>
            {roleSlug(selected) === "intervenant" && <><div className="ops-detail"><span>SIRET</span><strong>{selected.siret || "Non renseigné"}<br/>{selected.siret_verified_at ? `Vérifié le ${formatDate(selected.siret_verified_at)}` : "Non vérifié"}</strong></div><div className="ops-detail"><span>Compte Stripe</span><strong>{selected.stripe_onboarding_completed ? "Onboarding terminé" : "Onboarding incomplet"}<br/>{selected.stripe_account_id || "Aucun compte lié"}</strong></div><div className="ops-detail"><span>Positionnement</span><strong>{selected.coach_title || selected.coach_speciality || "Non renseigné"}</strong></div></>}
            {selected.bio && <div className="ops-detail ops-detail--wide"><span>Présentation</span><strong>{selected.bio}</strong></div>}
            {selected.rejection_reason && <div className="ops-detail ops-detail--wide"><span>Motif de refus</span><strong>{selected.rejection_reason}</strong></div>}
          </div>
          {roleSlug(selected) === "intervenant" && normalizeStatus(selected) !== "approved" && (
            <Notice tone="info">
              L’autorisation du compte coach déclenche automatiquement un email confirmant qu’il peut accéder à son espace et publier ses annonces.
            </Notice>
          )}
          {roleSlug(selected) === "intervenant" && (
            <section className="ops-coach-documents">
              <div className="ops-coach-documents__header">
                <div><span>Qualifications du coach</span><h3>Diplômes et certifications</h3></div>
                <StatusBadge tone={diplomaDocuments.length ? "success" : "warning"}>{diplomaDocuments.length} document(s)</StatusBadge>
              </div>

              {documentsLoading ? (
                <div className="ops-inline-state"><span className="ops-spinner"/><strong>Chargement des diplômes…</strong></div>
              ) : documentsError ? (
                <Notice tone="error">{documentsError}</Notice>
              ) : diplomaDocuments.length ? (
                <div className="ops-document-list">
                  {diplomaDocuments.map((document) => (
                    <article className="ops-document-item" key={document.id}>
                      <span className="ops-document-item__icon"><Icon name="document" size={20}/></span>
                      <div className="ops-document-item__content">
                        <strong>{document.name || documentTypeLabel(document)}</strong>
                        <span>{documentTypeLabel(document)} · {document.issuing_organization || "Organisme non renseigné"}</span>
                        <small>{document.status === "valide" ? "Document validé" : document.status === "refuse" ? "Document refusé" : "En attente de validation"}{document.expires_at ? ` · expire le ${formatDate(document.expires_at)}` : ""}</small>
                      </div>
                      <button type="button" className="ops-button ops-button--secondary" onClick={() => downloadDiploma(document)}><Icon name="document" size={15}/> Télécharger le diplôme</button>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="ops-document-empty"><Icon name="alert" size={20}/><div><strong>Aucun diplôme disponible</strong><span>Ce coach n’a pas encore envoyé de diplôme ou de certification téléchargeable.</span></div></div>
              )}
            </section>
          )}
        </Modal>
      )}

      {editing && (
        <Modal
          eyebrow={editing === "new" ? "Création administrateur" : `Modification USR-${String(editing.id).padStart(5, "0")}`}
          title={editing === "new" ? "Créer un compte" : "Modifier le compte"}
          onClose={() => setEditing(null)}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={() => setEditing(null)}>Annuler</button><button type="button" className="ops-button ops-button--primary" disabled={saving} onClick={saveUser}>{saving ? "Enregistrement…" : "Enregistrer"}</button></>}
        >
          <div className="ops-form-grid">
            <label className="ops-field"><span>Nom complet *</span><input value={form.name} onChange={(event) => updateForm("name", event.target.value)} placeholder="Nom et prénom"/></label>
            <label className="ops-field"><span>Pseudo / nom affiché</span><input value={form.display_name} onChange={(event) => updateForm("display_name", event.target.value)} placeholder="Nom visible publiquement"/></label>
            <label className="ops-field"><span>Adresse e-mail *</span><input type="email" value={form.email} onChange={(event) => updateForm("email", event.target.value)} placeholder="nom@exemple.fr"/></label>
            <label className="ops-field"><span>{editing === "new" ? "Mot de passe *" : "Nouveau mot de passe"}</span><input type="password" value={form.password} onChange={(event) => updateForm("password", event.target.value)} placeholder={editing === "new" ? "6 caractères minimum" : "Laisser vide pour conserver"}/></label>
            <label className="ops-field"><span>Téléphone</span><input value={form.phone} onChange={(event) => updateForm("phone", event.target.value)} placeholder="+33…"/></label>
            <label className="ops-field"><span>Rôle</span><select value={form.role} onChange={(event) => updateForm("role", event.target.value)}><option value="client">Client</option><option value="intervenant">Coach</option><option value="structure">Structure</option><option value="admin">Administrateur</option></select></label>
            <label className="ops-field"><span>Statut du compte</span><select value={form.account_status} onChange={(event) => updateForm("account_status", event.target.value)}><option value="approved">Actif</option><option value="pending">À valider</option><option value="rejected">Refusé</option><option value="suspended">Suspendu</option></select></label>
            <label className="ops-field ops-detail--wide"><span>Adresse</span><input value={form.address} onChange={(event) => updateForm("address", event.target.value)} placeholder="Adresse postale"/></label>
            {(form.role === "intervenant" || form.role === "structure") && <label className="ops-field"><span>SIRET (14 chiffres)</span><input value={form.siret} onChange={(event) => updateForm("siret", event.target.value)} maxLength={18} placeholder="123 456 789 00012"/></label>}
            {form.role === "intervenant" && <><label className="ops-field"><span>Titre professionnel</span><input value={form.coach_title} onChange={(event) => updateForm("coach_title", event.target.value)} placeholder="Coach sportif certifié"/></label><label className="ops-field"><span>Spécialité</span><input value={form.coach_speciality} onChange={(event) => updateForm("coach_speciality", event.target.value)} placeholder="Remise en forme, yoga…"/></label><label className="ops-field"><span>Années d’expérience</span><input type="number" min="0" max="80" value={form.coach_experience_years} onChange={(event) => updateForm("coach_experience_years", event.target.value)}/></label></>}
            <label className="ops-field ops-detail--wide"><span>Présentation</span><textarea value={form.bio} onChange={(event) => updateForm("bio", event.target.value)} placeholder="Informations administratives ou présentation publique…"/></label>
          </div>
        </Modal>
      )}

      {rejecting && (
        <Modal
          eyebrow="Décision d’onboarding"
          title={`Refuser le compte de ${rejecting.name || rejecting.email}`}
          onClose={() => setRejecting(null)}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={() => setRejecting(null)}>Annuler</button><button type="button" className="ops-button ops-button--danger" disabled={actionId === rejecting.id || !rejectionReason.trim()} onClick={() => changeStatus(rejecting, "rejected", rejectionReason.trim())}>Confirmer le refus</button></>}
        >
          <Notice tone="info">Précisez la raison afin que le dossier puisse être corrigé et réexaminé.</Notice>
          <label className="ops-field" style={{ marginTop: 14 }}><span>Motif du refus</span><textarea value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} placeholder="Pièces manquantes, informations incohérentes…"/></label>
        </Modal>
      )}
    </div>
  );
}
