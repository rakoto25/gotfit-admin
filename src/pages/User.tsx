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
import type { AccountStatus, AdminUser } from "../types/admin";

type RoleFilter = "all" | "admin" | "intervenant" | "client" | "structure";
type StatusFilter = "all" | AccountStatus;
type UserForm = {
  name: string;
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

export default function User() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<AdminUser | null>(null);
  const [editing, setEditing] = useState<AdminUser | "new" | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);
  const [rejecting, setRejecting] = useState<AdminUser | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
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
      const haystack = [user.id, user.name, user.email, user.phone, user.siret, user.coach_speciality].join(" ").toLowerCase();
      return (
        (!keyword || haystack.includes(keyword)) &&
        (roleFilter === "all" || roleSlug(user) === roleFilter) &&
        (statusFilter === "all" || normalizeStatus(user) === statusFilter)
      );
    });
  }, [roleFilter, search, statusFilter, users]);

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
      applyUpdate(await adminApi.validateUser(user.id, status, reason));
      setSuccess(status === "approved" ? "Compte autorisé." : status === "suspended" ? "Compte suspendu." : "Compte refusé.");
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
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail, téléphone, SIRET, spécialité…"/></label>
        <select className="ops-select" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}><option value="all">Tous les rôles</option><option value="intervenant">Coachs</option><option value="client">Clients</option><option value="structure">Structures</option><option value="admin">Administrateurs</option></select>
        <select className="ops-select" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}><option value="all">Tous les statuts</option><option value="pending">À valider</option><option value="approved">Actifs</option><option value="rejected">Refusés</option><option value="suspended">Suspendus</option></select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Répertoire opérationnel</h2><p>{filtered.length} compte(s) affiché(s)</p></div></header>
        {loading ? <LoadingState label="Chargement des utilisateurs…"/> : filtered.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Utilisateur</th><th>Rôle</th><th>Compte</th><th>Conformité coach</th><th>Dernière activité</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((user) => {
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
                        <button type="button" className="ops-row-action" onClick={() => setSelected(user)}><Icon name="eye" size={13}/> Dossier</button>
                        {normalizeStatus(user) !== "approved" && <button type="button" className="ops-row-action success" disabled={actionId === user.id} onClick={() => changeStatus(user, "approved")}><Icon name="check" size={13}/> Autoriser</button>}
                        {normalizeStatus(user) === "pending" && <button type="button" className="ops-row-action danger" onClick={() => { setRejecting(user); setRejectionReason(""); }}><Icon name="reject" size={13}/> Refuser</button>}
                      </div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="users" title="Aucun compte" description="Aucun utilisateur ne correspond aux filtres sélectionnés."/>}
      </section>

      {selected && !editing && !rejecting && (
        <Modal
          eyebrow={`Compte USR-${String(selected.id).padStart(5, "0")}`}
          title={selected.name || "Dossier utilisateur"}
          onClose={() => setSelected(null)}
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
            <div className="ops-detail"><span>E-mail</span><strong>{selected.email || "Non renseigné"}</strong></div>
            <div className="ops-detail"><span>Téléphone</span><strong>{selected.phone || "Non renseigné"}</strong></div>
            <div className="ops-detail ops-detail--wide"><span>Adresse</span><strong>{selected.address || "Non renseignée"}</strong></div>
            {roleSlug(selected) === "intervenant" && <><div className="ops-detail"><span>SIRET</span><strong>{selected.siret || "Non renseigné"}<br/>{selected.siret_verified_at ? `Vérifié le ${formatDate(selected.siret_verified_at)}` : "Non vérifié"}</strong></div><div className="ops-detail"><span>Compte Stripe</span><strong>{selected.stripe_onboarding_completed ? "Onboarding terminé" : "Onboarding incomplet"}<br/>{selected.stripe_account_id || "Aucun compte lié"}</strong></div><div className="ops-detail"><span>Positionnement</span><strong>{selected.coach_title || selected.coach_speciality || "Non renseigné"}</strong></div></>}
            {selected.bio && <div className="ops-detail ops-detail--wide"><span>Présentation</span><strong>{selected.bio}</strong></div>}
            {selected.rejection_reason && <div className="ops-detail ops-detail--wide"><span>Motif de refus</span><strong>{selected.rejection_reason}</strong></div>}
          </div>
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
