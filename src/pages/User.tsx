import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "../assets/css/user.css";

type UserStatus = "en_attente" | "accepte" | "refuse";
type UserRoleName = "Client" | "Intervenant" | "Admin";

type UserRole = {
  id?: number;
  name?: string;
};

type ApiUser = {
  id: number;
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  bio?: string;
  status?: UserStatus;
  photo?: string | null;
  photo_url?: string | null;
  created_at?: string;
  roles?: UserRole[];
};

type UserForm = {
  name: string;
  email: string;
  password: string;
  phone: string;
  address: string;
  bio: string;
  role: UserRoleName;
  status: UserStatus;
};

const emptyForm: UserForm = {
  name: "",
  email: "",
  password: "",
  phone: "",
  address: "",
  bio: "",
  role: "Client",
  status: "accepte",
};

const API_URL = import.meta.env.VITE_API_URL || "";

const normalizeRole = (role?: string) => {
  const value = (role || "").toLowerCase();
  if (value.includes("admin")) return "Admin";
  if (value.includes("intervenant") || value.includes("coach")) return "Intervenant";
  return "Client";
};

const getUserRole = (user: ApiUser): UserRoleName => {
  const firstRole = user.roles?.[0]?.name;
  return normalizeRole(firstRole) as UserRoleName;
};

export default function User() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | UserStatus>("all");
  const [roleFilter, setRoleFilter] = useState<"all" | UserRoleName>("all");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<ApiUser | null>(null);
  const [form, setForm] = useState<UserForm>(emptyForm);

  useEffect(() => {
    fetchUsers();
  }, []);

  const extractUsers = (payload: any): ApiUser[] => {
    const list = payload?.users || payload?.data?.users || payload?.data || payload;
    return Array.isArray(list)
      ? list.map((user) => ({ ...user, status: user.status || "accepte" }))
      : [];
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await api.get("/users");
      setUsers(extractUsers(response.data));
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les utilisateurs. Vérifie la route GET /api/users et le token admin.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const keyword = search.toLowerCase().trim();

    return users.filter((user) => {
      const role = getUserRole(user);
      const text = [user.name, user.email, user.phone, user.address, role]
        .join(" ")
        .toLowerCase();

      const matchSearch = !keyword || text.includes(keyword);
      const matchStatus = statusFilter === "all" || user.status === statusFilter;
      const matchRole = roleFilter === "all" || role === roleFilter;

      return matchSearch && matchStatus && matchRole;
    });
  }, [users, search, statusFilter, roleFilter]);

  const counts = useMemo(() => {
    return users.reduce(
      (acc, user) => {
        const role = getUserRole(user);
        acc.total += 1;
        if (role === "Client") acc.clients += 1;
        if (role === "Intervenant") acc.intervenants += 1;
        if (role === "Admin") acc.admins += 1;
        return acc;
      },
      { total: 0, clients: 0, intervenants: 0, admins: 0 }
    );
  }, [users]);

  const openCreateModal = (role: UserRoleName = "Client") => {
    setEditingUser(null);
    setForm({ ...emptyForm, role });
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  };

  const openEditModal = (user: ApiUser) => {
    setEditingUser(user);
    setForm({
      name: user.name || "",
      email: user.email || "",
      password: "",
      phone: user.phone || "",
      address: user.address || "",
      bio: user.bio || "",
      role: getUserRole(user),
      status: user.status || "accepte",
    });
    setError("");
    setSuccess("");
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingUser(null);
    setForm(emptyForm);
  };

  const buildPayload = () => {
    const payload: Record<string, any> = {
      name: form.name,
      email: form.email,
      phone: form.phone,
      address: form.address,
      bio: form.bio,
      status: form.status,
      role: form.role,
      role_name: form.role,
      role_id: form.role === "Admin" ? 1 : form.role === "Intervenant" ? 2 : 3,
    };

    if (form.password.trim()) {
      payload.password = form.password;
      payload.password_confirmation = form.password;
    }

    return payload;
  };

  const saveUser = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!editingUser && form.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (editingUser) {
        const response = await api.put(`/users/${editingUser.id}`, buildPayload());
        const updatedUser = response.data?.user || response.data?.data || { ...editingUser, ...buildPayload(), roles: [{ name: form.role }] };
        setUsers((prev) => prev.map((user) => (user.id === editingUser.id ? updatedUser : user)));
        setSuccess("Utilisateur modifié avec succès.");
      } else {
        let response;
        try {
          response = await api.post("/users", buildPayload());
        } catch (createError: any) {
          if (createError?.response?.status === 404 || createError?.response?.status === 405) {
            response = await api.post("/register", buildPayload());
          } else {
            throw createError;
          }
        }

        const createdUser = response.data?.user || response.data?.data?.user || response.data?.data || response.data;
        setUsers((prev) => [{ ...createdUser, roles: createdUser.roles || [{ name: form.role }], status: createdUser.status || form.status }, ...prev]);
        setSuccess(`${form.role} créé avec succès.`);
      }

      closeModal();
      fetchUsers();
    } catch (err: any) {
      console.error(err);
      const apiMessage = err?.response?.data?.message || err?.response?.data?.error;
      setError(apiMessage || "Impossible d'enregistrer. Vérifie les routes POST/PUT /api/users côté Laravel.");
    } finally {
      setSaving(false);
    }
  };

  const updateUserStatus = async (userId: number, status: UserStatus) => {
    try {
      setActionLoading(userId);
      setError("");
      await api.put(`/users/${userId}`, { status });
      setUsers((prevUsers) => prevUsers.map((user) => (user.id === userId ? { ...user, status } : user)));
    } catch (err) {
      console.error(err);
      setError("Impossible de modifier le statut. Vérifie la route PUT /api/users/{id}.");
    } finally {
      setActionLoading(null);
    }
  };

  const deleteUser = async (user: ApiUser) => {
    const confirmDelete = window.confirm(`Voulez-vous vraiment supprimer ${user.name || "cet utilisateur"} ?`);
    if (!confirmDelete) return;

    try {
      setActionLoading(user.id);
      setError("");
      await api.delete(`/users/${user.id}`);
      setUsers((prevUsers) => prevUsers.filter((item) => item.id !== user.id));
      setSuccess("Utilisateur supprimé avec succès.");
    } catch (err) {
      console.error(err);
      setError("Impossible de supprimer l'utilisateur. Vérifie la route DELETE /api/users/{id}.");
    } finally {
      setActionLoading(null);
    }
  };

  const getRoleLabel = (user: ApiUser) => getUserRole(user);
  const getUserInitial = (name?: string) => name?.charAt(0)?.toUpperCase() || "U";

  const getStatusLabel = (status?: UserStatus) => {
    switch (status) {
      case "accepte":
        return "Accepté";
      case "refuse":
        return "Refusé";
      case "en_attente":
      default:
        return "En attente";
    }
  };

  const formatDate = (date?: string) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  return (
    <div className="users-page">
      <div className="users-page__header">
        <div>
          <h1>Utilisateurs</h1>
          <p>Création, modification et suppression des clients et intervenants GotFit.</p>
        </div>

        <div className="users-header-actions">
          <button type="button" className="users-primary-btn users-primary-btn--light" onClick={() => openCreateModal("Client")}>
            + Client
          </button>
          <button type="button" className="users-primary-btn" onClick={() => openCreateModal("Intervenant")}>
            + Intervenant
          </button>
        </div>
      </div>

      <div className="users-mini-stats">
        <button type="button" className={roleFilter === "all" ? "active" : ""} onClick={() => setRoleFilter("all")}>
          <span>Total</span><strong>{counts.total}</strong>
        </button>
        <button type="button" className={roleFilter === "Client" ? "active" : ""} onClick={() => setRoleFilter("Client")}>
          <span>Clients</span><strong>{counts.clients}</strong>
        </button>
        <button type="button" className={roleFilter === "Intervenant" ? "active" : ""} onClick={() => setRoleFilter("Intervenant")}>
          <span>Intervenants</span><strong>{counts.intervenants}</strong>
        </button>
        <button type="button" className={roleFilter === "Admin" ? "active" : ""} onClick={() => setRoleFilter("Admin")}>
          <span>Admins</span><strong>{counts.admins}</strong>
        </button>
      </div>

      <div className="users-toolbar">
        <div className="users-search">
          <span>⌕</span>
          <input type="text" placeholder="Rechercher par nom, email, téléphone ou rôle..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>

        <select className="users-filter" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as "all" | UserStatus)}>
          <option value="all">Tous les statuts</option>
          <option value="en_attente">En attente</option>
          <option value="accepte">Accepté</option>
          <option value="refuse">Refusé</option>
        </select>
      </div>

      {loading && <div className="users-alert users-alert--loading">Chargement des utilisateurs...</div>}
      {error && <div className="users-alert users-alert--error">{error}</div>}
      {success && <div className="users-alert users-alert--success">{success}</div>}

      {!loading && (
        <div className="users-card">
          {filteredUsers.length > 0 ? (
            <div className="users-table">
              <div className="users-table__head">
                <span>Utilisateur</span>
                <span>Rôle</span>
                <span>Téléphone</span>
                <span>Adresse</span>
                <span>Statut</span>
                <span>Date</span>
                <span>Actions</span>
              </div>

              {filteredUsers.map((user) => (
                <div className="users-table__row" key={user.id}>
                  <div className="users-profile">
                    {user.photo_url || user.photo ? (
                      <img src={user.photo_url || `${API_URL.replace("/api", "")}/storage/${user.photo}`} alt={user.name || "Utilisateur"} />
                    ) : (
                      <div className="users-profile__avatar">{getUserInitial(user.name)}</div>
                    )}

                    <div>
                      <strong>{user.name || "Utilisateur sans nom"}</strong>
                      <span>{user.email || "Email non renseigné"}</span>
                    </div>
                  </div>

                  <div><span className={`users-role users-role--${getRoleLabel(user).toLowerCase()}`}>{getRoleLabel(user)}</span></div>
                  <div className="users-muted">{user.phone || "Non renseigné"}</div>
                  <div className="users-muted">{user.address || "Non renseignée"}</div>
                  <div><span className={`users-status users-status--${user.status}`}>{getStatusLabel(user.status)}</span></div>
                  <div className="users-muted">{formatDate(user.created_at)}</div>

                  <div className="users-actions">
                    {user.status !== "accepte" && (
                      <button type="button" className="users-action users-action--accept" disabled={actionLoading === user.id} onClick={() => updateUserStatus(user.id, "accepte")}>
                        Accepter
                      </button>
                    )}
                    {user.status !== "refuse" && (
                      <button type="button" className="users-action users-action--refuse" disabled={actionLoading === user.id} onClick={() => updateUserStatus(user.id, "refuse")}>
                        Refuser
                      </button>
                    )}
                    <button type="button" className="users-action users-action--edit" disabled={actionLoading === user.id} onClick={() => openEditModal(user)}>
                      Modifier
                    </button>
                    <button type="button" className="users-action users-action--delete" disabled={actionLoading === user.id} onClick={() => deleteUser(user)}>
                      Supprimer
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="users-empty">Aucun utilisateur trouvé.</div>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="users-modal-backdrop" role="dialog" aria-modal="true">
          <div className="users-modal">
            <div className="users-modal__head">
              <div>
                <h2>{editingUser ? "Modifier l'utilisateur" : `Créer un ${form.role.toLowerCase()}`}</h2>
                <p>{editingUser ? "Mets à jour les informations du compte." : "Le compte sera créé directement depuis le webadmin."}</p>
              </div>
              <button type="button" onClick={closeModal}>×</button>
            </div>

            <form onSubmit={saveUser} className="users-form">
              <div className="users-form__grid">
                <label>
                  Nom complet
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </label>
                <label>
                  Email
                  <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </label>
                <label>
                  Mot de passe {editingUser && <small>(laisser vide pour ne pas changer)</small>}
                  <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required={!editingUser} minLength={editingUser ? undefined : 6} />
                </label>
                <label>
                  Téléphone
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                </label>
                <label>
                  Rôle
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as UserRoleName })}>
                    <option value="Client">Client</option>
                    <option value="Intervenant">Intervenant</option>
                    <option value="Admin">Admin</option>
                  </select>
                </label>
                <label>
                  Statut
                  <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as UserStatus })}>
                    <option value="accepte">Accepté</option>
                    <option value="en_attente">En attente</option>
                    <option value="refuse">Refusé</option>
                  </select>
                </label>
              </div>

              <label>
                Adresse
                <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
              </label>

              <label>
                Bio / spécialité intervenant
                <textarea rows={4} value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} placeholder="Exemple : coach fitness, yoga, nutrition..." />
              </label>

              <div className="users-modal__actions">
                <button type="button" className="users-secondary-btn" onClick={closeModal}>Annuler</button>
                <button type="submit" className="users-primary-btn" disabled={saving}>{saving ? "Enregistrement..." : "Enregistrer"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
