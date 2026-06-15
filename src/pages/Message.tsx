import { useEffect, useMemo, useState } from "react";
import api from "../api/axios";
import "../assets/css/message.css";

type UserRole = {
  name?: string;
  slug?: string;
};

type UserOption = {
  id: number;
  name?: string;
  email?: string;
  roles?: UserRole[];
};

type MessageUser = {
  id?: number;
  name?: string;
  email?: string;
};

type MessageItem = {
  id: number;
  conversation_id?: number;
  sender_id?: number;
  receiver_id?: number;
  subject?: string;
  message?: string;
  body?: string;
  content?: string;
  is_read?: boolean;
  read_at?: string | null;
  replied_at?: string | null;
  status?: string | null;
  created_at?: string;
  updated_at?: string;
  sender?: MessageUser | null;
  receiver?: MessageUser | null;
};

type MessageStatus = "Tous les statuts" | "Lu" | "Non lu" | "Répondu";

const extractMessages = (payload: any): MessageItem[] => {
  const list =
    payload?.messages ||
    payload?.data?.messages ||
    payload?.data ||
    payload?.items ||
    [];

  return Array.isArray(list) ? list : [];
};

const extractUsers = (payload: any): UserOption[] => {
  const list =
    payload?.users ||
    payload?.data?.users ||
    payload?.data ||
    [];

  return Array.isArray(list) ? list : [];
};

const getMessageText = (item: MessageItem) => {
  return item.message || item.body || item.content || "";
};

const getStatus = (item: MessageItem): Exclude<MessageStatus, "Tous les statuts"> => {
  if (item.replied_at) return "Répondu";
  if (item.is_read) return "Lu";
  return "Non lu";
};

const getStatusClass = (status: Exclude<MessageStatus, "Tous les statuts">) => {
  if (status === "Non lu") return "is-unread";
  if (status === "Lu") return "is-read";
  return "is-replied";
};

const formatDate = (date?: string) => {
  if (!date) return "Date non renseignée";

  try {
    return new Date(date).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return date;
  }
};

const getInitial = (value?: string) => {
  if (!value) return "U";
  return value.trim().charAt(0).toUpperCase();
};

const getUserLabel = (user?: MessageUser | null) => {
  if (!user) return "Utilisateur non renseigné";
  return user.name || user.email || "Utilisateur non renseigné";
};

const getUserEmail = (user?: MessageUser | null) => {
  if (!user) return "Email non renseigné";
  return user.email || "Email non renseigné";
};

const getRoleLabel = (user: UserOption) => {
  return (
    user.roles?.[0]?.name ||
    user.roles?.[0]?.slug ||
    "Utilisateur"
  );
};

const getApiErrorMessage = (err: any) => {
  const status = err?.response?.status;
  const data = err?.response?.data;

  console.error("Erreur API complète :", err);
  console.error("Status Laravel :", status);
  console.error("Réponse Laravel :", data);

  if (status === 401) {
    return "Votre session admin a expiré ou le token n’est pas envoyé.";
  }

  if (status === 403) {
    return "Votre compte est connecté, mais Laravel ne le reconnaît pas comme admin.";
  }

  if (status === 404) {
    return "La route API messages est introuvable.";
  }

  if (status === 422) {
    const errors = data?.errors;

    if (errors) {
      const firstError = Object.values(errors).flat()[0];
      return String(firstError || "Les données envoyées sont invalides.");
    }

    return data?.message || "Les données envoyées sont invalides.";
  }

  if (status === 500) {
    return data?.message || "Erreur serveur Laravel. Vérifie storage/logs/laravel.log.";
  }

  if (data?.message) {
    return data.message;
  }

  return "Impossible d’effectuer cette action. Vérifie la console et l’onglet Network.";
};

export default function Message() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<MessageStatus>("Tous les statuts");

  const [showModal, setShowModal] = useState(false);
  const [selectedMessage, setSelectedMessage] = useState<MessageItem | null>(null);
  const [replyMode, setReplyMode] = useState(false);

  const [form, setForm] = useState({
    receiver_id: "",
    subject: "",
    message: "",
  });

  const selectedReceiver = useMemo(() => {
    if (!form.receiver_id) return null;
    return users.find((user) => String(user.id) === String(form.receiver_id)) || null;
  }, [form.receiver_id, users]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      setError("");

      let response;

      try {
        response = await api.get("/admin/messages");
      } catch {
        response = await api.get("/messages");
      }

      setMessages(extractMessages(response.data));
    } catch (err) {
      console.error(err);
      setError("Impossible de charger les messages. Vérifie la route GET /api/admin/messages.");
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.get("/users");
      setUsers(extractUsers(response.data));
    } catch (err) {
      console.error("Impossible de charger les utilisateurs", err);
      setError("Impossible de charger les utilisateurs. Vérifie la route GET /api/users.");
    }
  };

  useEffect(() => {
    loadMessages();
    loadUsers();
  }, []);

  const filteredMessages = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return messages.filter((item) => {
      const status = getStatus(item);
      const senderName = item.sender?.name || "";
      const senderEmail = item.sender?.email || "";
      const receiverName = item.receiver?.name || "";
      const receiverEmail = item.receiver?.email || "";
      const subject = item.subject || "";
      const text = getMessageText(item);

      const matchSearch =
        !normalizedSearch ||
        senderName.toLowerCase().includes(normalizedSearch) ||
        senderEmail.toLowerCase().includes(normalizedSearch) ||
        receiverName.toLowerCase().includes(normalizedSearch) ||
        receiverEmail.toLowerCase().includes(normalizedSearch) ||
        subject.toLowerCase().includes(normalizedSearch) ||
        text.toLowerCase().includes(normalizedSearch);

      const matchStatus =
        statusFilter === "Tous les statuts" || status === statusFilter;

      return matchSearch && matchStatus;
    });
  }, [messages, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: messages.length,
      unread: messages.filter((item) => getStatus(item) === "Non lu").length,
      read: messages.filter((item) => getStatus(item) === "Lu").length,
      replied: messages.filter((item) => getStatus(item) === "Répondu").length,
    };
  }, [messages]);

  const clearAlerts = () => {
    setError("");
    setSuccess("");
  };

  const openNewMessage = () => {
    clearAlerts();
    setSelectedMessage(null);
    setReplyMode(false);
    setForm({
      receiver_id: "",
      subject: "",
      message: "",
    });
    setShowModal(true);
  };

  const openView = async (item: MessageItem) => {
    clearAlerts();
    setSelectedMessage(item);
    setReplyMode(false);
    setShowModal(true);

    if (item.is_read) return;

    try {
      await api.put(`/admin/messages/${item.id}/read`);

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === item.id ? { ...msg, is_read: true } : msg
        )
      );
    } catch (err) {
      console.error("Impossible de marquer le message comme lu", err);
    }
  };

  const openReply = (item: MessageItem) => {
    clearAlerts();

    const receiverId =
      item.sender?.id ||
      item.sender_id ||
      item.receiver?.id ||
      item.receiver_id ||
      "";

    setSelectedMessage(item);
    setReplyMode(true);
    setForm({
      receiver_id: String(receiverId),
      subject: item.subject?.startsWith("Re:")
        ? item.subject
        : `Re: ${item.subject || "Message"}`,
      message: "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedMessage(null);
    setReplyMode(false);
    setForm({
      receiver_id: "",
      subject: "",
      message: "",
    });
  };

  const postWithFallback = async (
    primaryUrl: string,
    fallbackUrl: string,
    payload: any
  ) => {
    try {
      return await api.post(primaryUrl, payload);
    } catch (primaryError: any) {
      console.error(
        `Erreur sur ${primaryUrl}`,
        primaryError?.response?.data || primaryError
      );

      if (
        primaryError?.response?.status === 404 ||
        primaryError?.response?.status === 405
      ) {
        return await api.post(fallbackUrl, payload);
      }

      throw primaryError;
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!form.receiver_id || !form.subject || !form.message) {
      setError("Veuillez remplir le destinataire, le sujet et le message.");
      return;
    }

    const receiverId = Number(form.receiver_id);

    if (!receiverId || Number.isNaN(receiverId)) {
      setError("Destinataire invalide. Veuillez choisir un utilisateur.");
      return;
    }

    const payload = {
      receiver_id: receiverId,
      recipient_id: receiverId,
      user_id: receiverId,
      subject: form.subject.trim(),
      title: form.subject.trim(),
      message: form.message.trim(),
      body: form.message.trim(),
      content: form.message.trim(),
    };

    try {
      setSending(true);
      setError("");
      setSuccess("");

      let response;

      if (replyMode && selectedMessage) {
        response = await postWithFallback(
          `/admin/messages/${selectedMessage.id}/reply`,
          `/messages/${selectedMessage.id}/reply`,
          payload
        );
      } else {
        response = await postWithFallback(
          "/admin/messages",
          "/messages",
          payload
        );
      }

      console.log("Réponse API message :", response.data);

      setSuccess(replyMode ? "Réponse envoyée avec succès." : "Message envoyé avec succès.");
      closeModal();
      await loadMessages();
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    } finally {
      setSending(false);
    }
  };

  const deleteMessage = async (id: number) => {
    const confirmed = window.confirm("Voulez-vous vraiment supprimer ce message ?");

    if (!confirmed) return;

    try {
      clearAlerts();
      setDeletingId(id);

      await api.delete(`/admin/messages/${id}`);

      setMessages((prev) => prev.filter((item) => item.id !== id));
      setSuccess("Message supprimé avec succès.");
    } catch (err: any) {
      setError(getApiErrorMessage(err));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="message-page">
      <div className="message-hero">
        <div>
          <span className="message-eyebrow">Messagerie admin</span>
          <h1>Messages</h1>
          <p>
            Consultez les messages reçus, suivez les réponses et envoyez des messages
            aux clients, intervenants et administrateurs.
          </p>
        </div>

        <button className="message-add-btn" onClick={openNewMessage}>
          <span>+</span>
          Nouveau message
        </button>
      </div>

      {error && (
        <div className="message-alert message-alert--error">
          <span>!</span>
          <p>{error}</p>
        </div>
      )}

      {success && (
        <div className="message-alert message-alert--success">
          <span>✓</span>
          <p>{success}</p>
        </div>
      )}

      <div className="message-stats">
        <button
          type="button"
          className={`message-stat-card ${statusFilter === "Tous les statuts" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("Tous les statuts")}
        >
          <span>Total messages</span>
          <strong>{stats.total}</strong>
          <small>Tous les échanges</small>
        </button>

        <button
          type="button"
          className={`message-stat-card ${statusFilter === "Non lu" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("Non lu")}
        >
          <span>Non lus</span>
          <strong>{stats.unread}</strong>
          <small>À traiter</small>
        </button>

        <button
          type="button"
          className={`message-stat-card ${statusFilter === "Lu" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("Lu")}
        >
          <span>Lus</span>
          <strong>{stats.read}</strong>
          <small>Déjà consultés</small>
        </button>

        <button
          type="button"
          className={`message-stat-card ${statusFilter === "Répondu" ? "is-active" : ""}`}
          onClick={() => setStatusFilter("Répondu")}
        >
          <span>Répondus</span>
          <strong>{stats.replied}</strong>
          <small>Suivi effectué</small>
        </button>
      </div>

      <div className="message-toolbar">
        <div className="message-search">
          <span>⌕</span>
          <input
            type="text"
            placeholder="Rechercher par nom, email, sujet ou message..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        <select
          className="message-filter"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as MessageStatus)}
        >
          <option>Tous les statuts</option>
          <option>Non lu</option>
          <option>Lu</option>
          <option>Répondu</option>
        </select>

        <button type="button" className="message-refresh-btn" onClick={loadMessages}>
          Actualiser
        </button>
      </div>

      {loading ? (
        <div className="message-loading">
          <div className="message-spinner" />
          <p>Chargement des messages...</p>
        </div>
      ) : (
        <>
          <div className="message-table-card">
            <div className="message-table-head">
              <div>
                <strong>Boîte de messages</strong>
                <span>{filteredMessages.length} résultat(s)</span>
              </div>
            </div>

            <div className="table-responsive">
              <table className="message-table">
                <thead>
                  <tr>
                    <th>Expéditeur / Destinataire</th>
                    <th>Sujet</th>
                    <th>Message</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredMessages.map((item) => {
                    const status = getStatus(item);
                    const senderName = getUserLabel(item.sender);
                    const senderEmail = getUserEmail(item.sender);
                    const receiverName = getUserLabel(item.receiver);
                    const receiverEmail = getUserEmail(item.receiver);
                    const text = getMessageText(item);

                    return (
                      <tr key={item.id} className={status === "Non lu" ? "is-row-unread" : ""}>
                        <td>
                          <div className="message-users-stack">
                            <div className="message-user">
                              <div className="message-avatar">
                                {getInitial(senderName)}
                              </div>

                              <div>
                                <strong>De : {senderName}</strong>
                                <span>{senderEmail}</span>
                              </div>
                            </div>

                            <div className="message-user message-user--receiver">
                              <div className="message-avatar message-avatar--receiver">
                                {getInitial(receiverName)}
                              </div>

                              <div>
                                <strong>À : {receiverName}</strong>
                                <span>{receiverEmail}</span>
                              </div>
                            </div>
                          </div>
                        </td>

                        <td>
                          <strong className="message-subject">
                            {item.subject || "Sans sujet"}
                          </strong>
                        </td>

                        <td>
                          <span className="message-preview">{text}</span>
                        </td>

                        <td>
                          <span className="message-date">
                            {formatDate(item.created_at)}
                          </span>
                        </td>

                        <td>
                          <span className={`message-status ${getStatusClass(status)}`}>
                            {status}
                          </span>
                        </td>

                        <td>
                          <div className="message-actions">
                            <button type="button" onClick={() => openView(item)}>
                              Voir
                            </button>
                            <button type="button" onClick={() => openReply(item)}>
                              Répondre
                            </button>
                            <button
                              type="button"
                              className="danger"
                              disabled={deletingId === item.id}
                              onClick={() => deleteMessage(item.id)}
                            >
                              {deletingId === item.id ? "..." : "Supprimer"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {!filteredMessages.length && (
                    <tr>
                      <td colSpan={6}>
                        <div className="message-empty">
                          <strong>Aucun message trouvé</strong>
                          <p>Essayez de modifier votre recherche ou votre filtre.</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="message-mobile-list">
            {filteredMessages.map((item) => {
              const status = getStatus(item);
              const senderName = getUserLabel(item.sender);
              const receiverName = getUserLabel(item.receiver);
              const text = getMessageText(item);

              return (
                <div className="message-mobile-card" key={item.id}>
                  <div className="message-mobile-top">
                    <div className="message-user">
                      <div className="message-avatar">
                        {getInitial(senderName)}
                      </div>

                      <div>
                        <strong>{senderName}</strong>
                        <span>À : {receiverName}</span>
                      </div>
                    </div>

                    <span className={`message-status ${getStatusClass(status)}`}>
                      {status}
                    </span>
                  </div>

                  <div className="message-mobile-content">
                    <strong>{item.subject || "Sans sujet"}</strong>
                    <p>{text}</p>
                    <span>{formatDate(item.created_at)}</span>
                  </div>

                  <div className="message-actions">
                    <button type="button" onClick={() => openView(item)}>
                      Voir
                    </button>
                    <button type="button" onClick={() => openReply(item)}>
                      Répondre
                    </button>
                    <button
                      type="button"
                      className="danger"
                      disabled={deletingId === item.id}
                      onClick={() => deleteMessage(item.id)}
                    >
                      Supprimer
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {showModal && (
        <div className="message-modal-overlay" onMouseDown={closeModal}>
          <div className="message-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="message-modal__head">
              <div>
                <span>
                  {selectedMessage && !replyMode
                    ? "Consultation"
                    : replyMode
                    ? "Réponse"
                    : "Composition"}
                </span>
                <h2>
                  {selectedMessage && !replyMode
                    ? "Détail du message"
                    : replyMode
                    ? "Répondre au message"
                    : "Nouveau message"}
                </h2>
              </div>

              <button type="button" onClick={closeModal}>
                ×
              </button>
            </div>

            {selectedMessage && !replyMode ? (
              <div className="message-detail">
                <div className="message-detail-grid">
                  <div>
                    <span>Expéditeur</span>
                    <strong>
                      {getUserLabel(selectedMessage.sender)}
                    </strong>
                    <small>{getUserEmail(selectedMessage.sender)}</small>
                  </div>

                  <div>
                    <span>Destinataire</span>
                    <strong>
                      {getUserLabel(selectedMessage.receiver)}
                    </strong>
                    <small>{getUserEmail(selectedMessage.receiver)}</small>
                  </div>

                  <div>
                    <span>Sujet</span>
                    <strong>{selectedMessage.subject || "Sans sujet"}</strong>
                  </div>

                  <div>
                    <span>Date</span>
                    <strong>{formatDate(selectedMessage.created_at)}</strong>
                  </div>
                </div>

                <div className="message-detail-body">
                  <span>Message</span>
                  <p>{getMessageText(selectedMessage)}</p>
                </div>

                <div className="message-modal__actions">
                  <button type="button" onClick={() => openReply(selectedMessage)}>
                    Répondre
                  </button>
                  <button type="button" className="secondary" onClick={closeModal}>
                    Fermer
                  </button>
                </div>
              </div>
            ) : (
              <form className="message-form" onSubmit={sendMessage}>
                <label>
                  <span>Destinataire</span>
                  <select
                    value={form.receiver_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        receiver_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Choisir un utilisateur</option>
                    {users.map((user) => {
                      const role = getRoleLabel(user);

                      return (
                        <option key={user.id} value={user.id}>
                          {user.name || user.email} — {role}
                        </option>
                      );
                    })}
                  </select>
                </label>

                {selectedReceiver && (
                  <div className="message-recipient-preview">
                    <div className="message-avatar message-avatar--receiver">
                      {getInitial(selectedReceiver.name || selectedReceiver.email)}
                    </div>

                    <div>
                      <strong>
                        À : {selectedReceiver.name || selectedReceiver.email}
                      </strong>
                      <span>
                        {selectedReceiver.email || "Email non renseigné"} — {getRoleLabel(selectedReceiver)}
                      </span>
                    </div>
                  </div>
                )}

                <label>
                  <span>Sujet</span>
                  <input
                    type="text"
                    value={form.subject}
                    placeholder="Ex : Information concernant votre réservation"
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        subject: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <label>
                  <span>Message</span>
                  <textarea
                    rows={7}
                    value={form.message}
                    placeholder="Écrivez votre message ici..."
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        message: event.target.value,
                      }))
                    }
                    required
                  />
                </label>

                <div className="message-modal__actions">
                  <button type="submit" disabled={sending}>
                    {sending ? "Envoi en cours..." : replyMode ? "Envoyer la réponse" : "Envoyer le message"}
                  </button>

                  <button type="button" className="secondary" onClick={closeModal}>
                    Annuler
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}