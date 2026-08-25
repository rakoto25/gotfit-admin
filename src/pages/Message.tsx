import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../api/axios";
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
import type { AdminUser } from "../types/admin";

type MessageUser = Pick<AdminUser, "id" | "name" | "email">;
type MessageItem = {
  id: number;
  conversation_id?: number | null;
  sender_id?: number | null;
  receiver_id?: number | null;
  subject?: string;
  message?: string;
  body?: string;
  content?: string;
  is_read?: boolean;
  read_at?: string | null;
  replied_at?: string | null;
  is_admin_broadcast?: boolean;
  broadcast_target_role?: string | null;
  created_at?: string;
  sender?: MessageUser | null;
  receiver?: MessageUser | null;
};

type Filter = "all" | "unread" | "replied" | "broadcast";
type Target = "individual" | "coaches";

type ApiRecord = Record<string, unknown>;
const asRecord = (value: unknown): ApiRecord =>
  typeof value === "object" && value !== null ? value as ApiRecord : {};

const extractMessages = (payload: unknown): MessageItem[] => {
  const root = asRecord(payload);
  const nested = asRecord(root.data);
  const list = root.messages || nested.messages || root.data;
  return Array.isArray(list) ? list as MessageItem[] : [];
};

const messageText = (item: MessageItem) => item.message || item.body || item.content || "";

const formatDate = (value?: string) => {
  if (!value) return "Date inconnue";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("fr-FR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

const roleLabel = (user: AdminUser) => {
  const role = String(user.roles?.[0]?.slug || user.roles?.[0]?.name || "utilisateur").toLowerCase();
  if (role.includes("intervenant") || role.includes("coach")) return "Coach";
  if (role.includes("admin")) return "Administrateur";
  if (role.includes("structure")) return "Structure";
  return "Client";
};

const badge = (item: MessageItem) => {
  if (item.is_admin_broadcast) return { label: "Diffusion coachs", tone: "dark" as const };
  if (item.replied_at) return { label: "Répondu", tone: "success" as const };
  if (!item.is_read) return { label: "Non lu", tone: "warning" as const };
  return { label: "Lu", tone: "info" as const };
};

const initials = (value?: string) => (value || "GF").trim().slice(0, 2);

export default function Message() {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [selected, setSelected] = useState<MessageItem | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [replyTo, setReplyTo] = useState<MessageItem | null>(null);
  const [target, setTarget] = useState<Target>("individual");
  const [onlyApproved, setOnlyApproved] = useState(true);
  const [receiverId, setReceiverId] = useState("");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [messageResponse, userData] = await Promise.all([
        api.get("/admin/messages"),
        adminApi.users(),
      ]);
      setMessages(extractMessages(messageResponse.data));
      setUsers(userData);
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger la messagerie administrative."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const counts = useMemo(
    () => ({
      total: messages.length,
      unread: messages.filter((item) => !item.is_read && !item.is_admin_broadcast).length,
      replied: messages.filter((item) => item.replied_at).length,
      broadcasts: messages.filter((item) => item.is_admin_broadcast).length,
    }),
    [messages]
  );

  const filtered = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return messages.filter((item) => {
      const haystack = [
        item.id,
        item.subject,
        messageText(item),
        item.sender?.name,
        item.sender?.email,
        item.receiver?.name,
        item.receiver?.email,
      ].join(" ").toLowerCase();
      const matches =
        filter === "all" ||
        (filter === "unread" && !item.is_read && !item.is_admin_broadcast) ||
        (filter === "replied" && Boolean(item.replied_at)) ||
        (filter === "broadcast" && Boolean(item.is_admin_broadcast));
      return (!keyword || haystack.includes(keyword)) && matches;
    });
  }, [filter, messages, search]);

  const coachCount = users.filter((user) => {
    const role = roleLabel(user);
    return role === "Coach" && (!onlyApproved || String(user.account_status) === "approved");
  }).length;

  const resetCompose = () => {
    setComposeOpen(false);
    setReplyTo(null);
    setTarget("individual");
    setOnlyApproved(true);
    setReceiverId("");
    setSubject("");
    setContent("");
  };

  const openNew = () => {
    setError("");
    setReplyTo(null);
    setTarget("individual");
    setReceiverId("");
    setSubject("");
    setContent("");
    setComposeOpen(true);
  };

  const openReply = (item: MessageItem) => {
    setSelected(null);
    setReplyTo(item);
    setTarget("individual");
    setReceiverId(String(item.sender?.id || item.sender_id || item.receiver?.id || item.receiver_id || ""));
    setSubject(item.subject?.startsWith("Re:") ? item.subject : `Re: ${item.subject || "Message"}`);
    setContent("");
    setComposeOpen(true);
  };

  const openMessage = async (item: MessageItem) => {
    setSelected(item);
    if (item.is_read) return;
    try {
      await api.put(`/admin/messages/${item.id}/read`);
      setMessages((items) => items.map((message) => message.id === item.id ? { ...message, is_read: true, read_at: new Date().toISOString() } : message));
      setSelected((current) => current?.id === item.id ? { ...current, is_read: true } : current);
    } catch (caught) {
      setError(getApiError(caught, "Le message n’a pas pu être marqué comme lu."));
    }
  };

  const send = async () => {
    if (!subject.trim() || !content.trim() || (target === "individual" && !receiverId)) {
      setError("Renseignez le destinataire, le sujet et le message.");
      return;
    }
    setSending(true);
    setError("");
    setSuccess("");
    try {
      if (replyTo) {
        await api.post(`/admin/messages/${replyTo.id}/reply`, {
          receiver_id: Number(receiverId),
          subject: subject.trim(),
          message: content.trim(),
        });
      } else if (target === "coaches") {
        await api.post("/admin/messages/broadcast-coaches", {
          subject: subject.trim(),
          message: content.trim(),
          only_approved: onlyApproved,
        });
      } else {
        await api.post("/admin/messages", {
          receiver_id: Number(receiverId),
          subject: subject.trim(),
          message: content.trim(),
        });
      }
      resetCompose();
      setSuccess(target === "coaches" ? `Diffusion envoyée à ${coachCount} coach(s).` : replyTo ? "Réponse envoyée." : "Message envoyé.");
      const response = await api.get("/admin/messages");
      setMessages(extractMessages(response.data));
    } catch (caught) {
      setError(getApiError(caught, "Le message n’a pas pu être envoyé."));
    } finally {
      setSending(false);
    }
  };

  const remove = async (item: MessageItem) => {
    if (!window.confirm("Supprimer définitivement ce message ?")) return;
    setDeletingId(item.id);
    setError("");
    try {
      await api.delete(`/admin/messages/${item.id}`);
      setMessages((items) => items.filter((message) => message.id !== item.id));
      setSelected(null);
      setSuccess("Message supprimé.");
    } catch (caught) {
      setError(getApiError(caught, "Le message n’a pas pu être supprimé."));
    } finally {
      setDeletingId(null);
    }
  };

  const receiver = users.find((user) => String(user.id) === receiverId);

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Centre de communication"
        title="Messagerie"
        description="Traitez les demandes individuelles et diffusez des communications opérationnelles aux coachs approuvés."
        actions={<><button type="button" className="ops-button ops-button--secondary" onClick={loadData}><Icon name="refresh" size={16}/> Actualiser</button><button type="button" className="ops-button ops-button--primary" onClick={openNew}><Icon name="message" size={16}/> Nouveau message</button></>}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      <section className="ops-metrics">
        <MetricCard label="Messages" value={counts.total} detail="Historique complet" icon="message"/>
        <MetricCard label="Non lus" value={counts.unread} detail="À traiter" icon="alert" tone={counts.unread ? "red" : "neutral"}/>
        <MetricCard label="Réponses" value={counts.replied} detail="Demandes suivies" icon="check" tone="green"/>
        <MetricCard label="Diffusions" value={counts.broadcasts} detail="Envois groupés coachs" icon="announcement" tone="blue"/>
      </section>

      <section className="ops-toolbar">
        <label className="ops-search"><Icon name="search" size={18}/><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nom, e-mail, sujet ou contenu…"/></label>
        <select className="ops-select" value={filter} onChange={(event) => setFilter(event.target.value as Filter)}><option value="all">Tous les messages</option><option value="unread">Non lus</option><option value="replied">Répondus</option><option value="broadcast">Diffusions coachs</option></select>
      </section>

      <section className="ops-panel">
        <header className="ops-panel__header"><div><h2>Boîte de traitement</h2><p>{filtered.length} message(s) affiché(s)</p></div></header>
        {loading ? <LoadingState label="Chargement de la messagerie…"/> : filtered.length ? (
          <div className="ops-table-wrap">
            <table className="ops-table">
              <thead><tr><th>Interlocuteur</th><th>Sujet & aperçu</th><th>Destinataire</th><th>Date</th><th>Suivi</th><th>Actions</th></tr></thead>
              <tbody>
                {filtered.map((item) => {
                  const status = badge(item);
                  return (
                    <tr key={item.id}>
                      <td><div className="ops-identity"><span className="ops-identity__avatar">{initials(item.sender?.name || item.sender?.email)}</span><div><strong>{item.sender?.name || "Administration GotFit"}</strong><span>{item.sender?.email || `Conversation #${item.conversation_id || "—"}`}</span></div></div></td>
                      <td><div className="ops-stack"><strong>{item.subject || "Sans sujet"}</strong><span>{messageText(item) || "Message vide"}</span></div></td>
                      <td><div className="ops-stack"><strong>{item.is_admin_broadcast ? "Tous les coachs" : item.receiver?.name || "Utilisateur"}</strong><span>{item.is_admin_broadcast ? "Diffusion groupée" : item.receiver?.email}</span></div></td>
                      <td>{formatDate(item.created_at)}</td>
                      <td><StatusBadge tone={status.tone}>{status.label}</StatusBadge></td>
                      <td><div className="ops-row-actions"><button type="button" className="ops-row-action" onClick={() => openMessage(item)}><Icon name="eye" size={13}/> Ouvrir</button>{!item.is_admin_broadcast && <button type="button" className="ops-row-action primary" onClick={() => openReply(item)}><Icon name="message" size={13}/> Répondre</button>}</div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <EmptyState icon="message" title="Aucun message" description="Aucun échange ne correspond aux critères sélectionnés."/>}
      </section>

      {selected && (
        <Modal
          eyebrow={`Message MSG-${String(selected.id).padStart(5, "0")}`}
          title={selected.subject || "Sans sujet"}
          onClose={() => setSelected(null)}
          footer={<><button type="button" className="ops-button ops-button--danger" disabled={deletingId === selected.id} onClick={() => remove(selected)}><Icon name="trash" size={14}/> Supprimer</button>{!selected.is_admin_broadcast && <button type="button" className="ops-button ops-button--primary" onClick={() => openReply(selected)}>Répondre</button>}</>}
        >
          <div className="ops-detail-grid">
            <div className="ops-detail"><span>Expéditeur</span><strong>{selected.sender?.name || "Administration GotFit"}<br/>{selected.sender?.email}</strong></div>
            <div className="ops-detail"><span>Destinataire</span><strong>{selected.is_admin_broadcast ? "Tous les coachs" : selected.receiver?.name || "Utilisateur"}<br/>{selected.receiver?.email}</strong></div>
            <div className="ops-detail"><span>Date</span><strong>{formatDate(selected.created_at)}</strong></div>
            <div className="ops-detail"><span>Conversation</span><strong>#{selected.conversation_id || "—"}</strong></div>
            <div className="ops-detail ops-detail--wide"><span>Contenu du message</span><strong style={{ whiteSpace: "pre-wrap" }}>{messageText(selected) || "Message vide"}</strong></div>
          </div>
        </Modal>
      )}

      {composeOpen && (
        <Modal
          eyebrow={replyTo ? "Réponse individuelle" : "Communication administrative"}
          title={replyTo ? "Répondre au message" : "Composer un message"}
          onClose={resetCompose}
          footer={<><button type="button" className="ops-button ops-button--secondary" onClick={resetCompose}>Annuler</button><button type="button" className="ops-button ops-button--primary" disabled={sending} onClick={send}>{sending ? "Envoi…" : target === "coaches" ? `Diffuser à ${coachCount} coach(s)` : "Envoyer le message"}</button></>}
        >
          <div className="ops-form-grid">
            {!replyTo && <label className="ops-field"><span>Mode d’envoi</span><select value={target} onChange={(event) => setTarget(event.target.value as Target)}><option value="individual">Un utilisateur</option><option value="coaches">Tous les coachs</option></select></label>}
            {target === "individual" ? <label className="ops-field"><span>Destinataire</span><select value={receiverId} onChange={(event) => setReceiverId(event.target.value)} disabled={Boolean(replyTo)}><option value="">Choisir un utilisateur</option>{users.map((user) => <option key={user.id} value={user.id}>{user.name || user.email} — {roleLabel(user)}</option>)}</select></label> : <label className="ops-field"><span>Population</span><select value={onlyApproved ? "approved" : "all"} onChange={(event) => setOnlyApproved(event.target.value === "approved")}><option value="approved">Coachs approuvés uniquement</option><option value="all">Tous les coachs</option></select></label>}
            {target === "individual" && receiver && <div className="ops-detail ops-detail--wide"><span>Destinataire sélectionné</span><strong>{receiver.name || receiver.email} · {roleLabel(receiver)} · {receiver.email}</strong></div>}
            {target === "coaches" && <div className="ops-detail ops-detail--wide"><span>Diffusion groupée</span><strong>{coachCount} coach(s) recevront une copie individuelle de cette communication.</strong></div>}
            <label className="ops-field ops-detail--wide"><span>Sujet</span><input value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={255} placeholder="Objet de la communication"/></label>
            <label className="ops-field ops-detail--wide"><span>Message</span><textarea value={content} onChange={(event) => setContent(event.target.value)} maxLength={5000} placeholder="Rédigez le message administratif…"/></label>
          </div>
        </Modal>
      )}
    </div>
  );
}
