import { useCallback, useEffect, useState } from "react";
import { adminApi, getApiError } from "../api/admin";
import { Icon } from "../components/admin/Icon";
import { EmptyState, LoadingState, Notice, PageHeader, StatusBadge } from "../components/admin/Ui";
import type { LegalDocument } from "../types/admin";

const publicUrl = (document: LegalDocument) =>
  `${String(import.meta.env.VITE_WEBAPP_URL || "https://gotfit.tech").replace(/\/$/, "")}/cgv/${document.slug}`;

const dateInputValue = (value?: string | null) => value ? value.slice(0, 10) : "";

export default function Legal() {
  const [documents, setDocuments] = useState<LegalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadDocuments = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      setDocuments(await adminApi.legalDocuments());
    } catch (caught) {
      setError(getApiError(caught, "Impossible de charger les CGV."));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void Promise.resolve().then(loadDocuments);
  }, [loadDocuments]);

  function updateField<K extends keyof LegalDocument>(id: number, key: K, value: LegalDocument[K]) {
    setDocuments((items) => items.map((item) => item.id === id ? { ...item, [key]: value } : item));
  }

  async function save(document: LegalDocument) {
    if (savingId !== null) return;

    try {
      setSavingId(document.id);
      setError("");
      setSuccess("");
      const updated = await adminApi.updateLegalDocument(document.id, {
        audience: document.audience,
        title: document.title.trim(),
        content: document.content.trim(),
        version: document.version.trim(),
        effective_at: document.effective_at || null,
        is_published: document.is_published,
      });
      setDocuments((items) => items.map((item) => item.id === updated.id ? updated : item));
      setSuccess(`${updated.title} a été enregistrée.`);
    } catch (caught) {
      setError(getApiError(caught, "Impossible d’enregistrer les CGV."));
    } finally {
      setSavingId(null);
    }
  }

  return (
    <div className="ops-page">
      <PageHeader
        eyebrow="Juridique"
        title="Conditions générales de vente"
        description="Modifiez, versionnez et publiez les textes affichés aux clients et aux intervenants."
        actions={<button type="button" className="ops-button ops-button--secondary" onClick={() => void loadDocuments()} disabled={loading}><Icon name="refresh" size={16}/> Actualiser</button>}
      />

      {error && <Notice tone="error">{error}</Notice>}
      {success && <Notice tone="success">{success}</Notice>}

      {loading ? <LoadingState label="Chargement des CGV…"/> : documents.length === 0 ? (
        <EmptyState icon="document" title="Aucune CGV" description="Exécutez les migrations de l’API pour initialiser les documents juridiques."/>
      ) : (
        <div style={{ display: "grid", gap: 20, marginTop: 20 }}>
          {documents.map((document) => (
            <section className="ops-panel" key={document.id}>
              <header className="ops-panel__header">
                <div>
                  <span className="ops-eyebrow">{document.audience === "client" ? "Clients" : "Intervenants"}</span>
                  <h2>{document.title}</h2>
                </div>
                <StatusBadge tone={document.is_published ? "success" : "warning"}>{document.is_published ? "Publiées" : "Masquées"}</StatusBadge>
              </header>

              <div className="ops-panel__body"><div className="ops-form-grid">
                <label className="ops-field ops-detail--wide"><span>Titre public</span><input value={document.title} onChange={(event) => updateField(document.id, "title", event.target.value)}/></label>
                <label className="ops-field"><span>Version</span><input value={document.version} onChange={(event) => updateField(document.id, "version", event.target.value)}/></label>
                <label className="ops-field"><span>Date d’effet</span><input type="date" value={dateInputValue(document.effective_at)} onChange={(event) => updateField(document.id, "effective_at", event.target.value || null)}/></label>
                <label className="ops-field ops-detail--wide"><span>Contenu (Markdown)</span><textarea rows={22} value={document.content} onChange={(event) => updateField(document.id, "content", event.target.value)}/></label>
                <label className="ops-field"><span>Publication</span><select value={document.is_published ? "published" : "hidden"} onChange={(event) => updateField(document.id, "is_published", event.target.value === "published")}><option value="published">Publié sur la webapp</option><option value="hidden">Masqué</option></select></label>
              </div>

              <div className="ops-page-actions" style={{ marginTop: 18 }}>
                <a className="ops-button ops-button--secondary" href={publicUrl(document)} target="_blank" rel="noreferrer"><Icon name="eye" size={16}/> Prévisualiser</a>
                <button type="button" className="ops-button ops-button--primary" onClick={() => void save(document)} disabled={savingId !== null || !document.title.trim() || document.content.trim().length < 100 || !document.version.trim()}><Icon name="check" size={16}/> {savingId === document.id ? "Enregistrement…" : "Enregistrer"}</button>
              </div>
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
