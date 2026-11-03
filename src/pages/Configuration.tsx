import { useEffect, useMemo, useState } from "react";
import { adminApi, getApiError } from "../api/admin";
import { Icon } from "../components/admin/Icon";
import { LoadingState, Notice, PageHeader, StatusBadge } from "../components/admin/Ui";
import type { SystemSetting } from "../types/admin";

const asBoolean = (value: string) => value === "true" || value === "1";

export default function Configuration() {
  const [settings, setSettings] = useState<SystemSetting[]>([]);
  const [values, setValues] = useState<Record<string, string | boolean>>({});
  const [loading, setLoading] = useState(true);
  const [savingGroup, setSavingGroup] = useState("");
  const [notice, setNotice] = useState<{ tone: "error" | "success" | "info"; text: string } | null>(null);

  const load = async () => {
    setLoading(true);
    setNotice(null);

    try {
      const items = await adminApi.systemSettings();
      setSettings(items);
      setValues(Object.fromEntries(items.map((item) => [
        item.key,
        item.type === "boolean" ? asBoolean(item.value) : item.value,
      ])));
    } catch (error) {
      setNotice({ tone: "error", text: getApiError(error, "Impossible de charger la configuration.") });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    adminApi.systemSettings()
      .then((items) => {
        if (!active) return;
        setSettings(items);
        setValues(Object.fromEntries(items.map((item) => [
          item.key,
          item.type === "boolean" ? asBoolean(item.value) : item.value,
        ])));
      })
      .catch((error) => {
        if (active) setNotice({ tone: "error", text: getApiError(error, "Impossible de charger la configuration.") });
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, []);

  const groups = useMemo(() => {
    const result = new Map<string, SystemSetting[]>();
    settings.forEach((setting) => result.set(setting.group, [...(result.get(setting.group) || []), setting]));
    return [...result.entries()];
  }, [settings]);

  const saveGroup = async (group: string, items: SystemSetting[]) => {
    setSavingGroup(group);
    setNotice(null);

    try {
      const payload = Object.fromEntries(items.map((item) => [item.key, values[item.key] ?? ""]));
      const updated = await adminApi.updateSystemSettings(payload);
      setSettings(updated);
      setValues(Object.fromEntries(updated.map((item) => [
        item.key,
        item.type === "boolean" ? asBoolean(item.value) : item.value,
      ])));
      setNotice({ tone: "success", text: `${group} : configuration enregistrée.` });
    } catch (error) {
      setNotice({ tone: "error", text: getApiError(error, "La configuration n’a pas pu être enregistrée.") });
    } finally {
      setSavingGroup("");
    }
  };

  const reset = async (setting: SystemSetting) => {
    if (!window.confirm(`Réinitialiser « ${setting.label} » vers la valeur du serveur ?`)) return;

    try {
      await adminApi.resetSystemSetting(setting.key);
      await load();
      setNotice({ tone: "success", text: `${setting.label} utilise de nouveau la configuration du serveur.` });
    } catch (error) {
      setNotice({ tone: "error", text: getApiError(error, "Réinitialisation impossible.") });
    }
  };

  const field = (setting: SystemSetting) => {
    if (setting.type === "boolean") {
      return (
        <label className="config-toggle">
          <input
            type="checkbox"
            checked={Boolean(values[setting.key])}
            onChange={(event) => setValues((current) => ({ ...current, [setting.key]: event.target.checked }))}
          />
          <span>{values[setting.key] ? "Activé" : "Désactivé"}</span>
        </label>
      );
    }

    if (setting.type === "select") {
      return (
        <select
          value={String(values[setting.key] ?? "")}
          onChange={(event) => setValues((current) => ({ ...current, [setting.key]: event.target.value }))}
        >
          <option value="">Choisir…</option>
          {setting.options.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      );
    }

    return (
      <input
        type={setting.type}
        min={setting.type === "number" ? 1 : undefined}
        value={String(values[setting.key] ?? "")}
        placeholder={setting.secret && setting.configured ? "Valeur enregistrée — laisser vide pour conserver" : "Non configuré"}
        autoComplete="off"
        onChange={(event) => setValues((current) => ({ ...current, [setting.key]: event.target.value }))}
      />
    );
  };

  return (
    <div>
      <PageHeader
        eyebrow="Infrastructure"
        title="Configuration & clés"
        description="Gérez les intégrations sans exposer les secrets dans le navigateur ni dans le dépôt Git."
        actions={<button className="ops-button ops-button--secondary" type="button" onClick={() => void load()}><Icon name="refresh" size={17}/>Actualiser</button>}
      />

      <Notice tone="info">
        Les secrets sont chiffrés dans PostgreSQL avec APP_KEY et ne sont jamais relus dans l’interface. APP_KEY, la connexion PostgreSQL et les paramètres de démarrage restent volontairement dans l’environnement du serveur.
      </Notice>

      {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
      {loading ? <LoadingState label="Chargement de la configuration…" /> : (
        <div className="config-groups">
          {groups.map(([group, items]) => (
            <section className="ops-panel config-group" key={group}>
              <header className="config-group__header">
                <div><span>Intégration</span><h2>{group}</h2></div>
                <button
                  className="ops-button ops-button--primary"
                  type="button"
                  disabled={savingGroup === group}
                  onClick={() => void saveGroup(group, items)}
                >
                  {savingGroup === group ? <span className="ops-spinner"/> : <Icon name="check" size={17}/>}Enregistrer
                </button>
              </header>
              <div className="config-fields">
                {items.map((setting) => (
                  <div className="config-field" key={setting.key}>
                    <div className="config-field__label">
                      <label htmlFor={`setting-${setting.key}`}>{setting.label}</label>
                      <div>
                        <StatusBadge tone={setting.configured ? "success" : "warning"}>{setting.configured ? "Configuré" : "À configurer"}</StatusBadge>
                        <span className="config-source">{setting.source === "database" ? "Admin" : "Serveur"}</span>
                      </div>
                    </div>
                    <div className="config-field__control" id={`setting-${setting.key}`}>
                      {field(setting)}
                      {setting.source === "database" && (
                        <button className="ops-icon-button" type="button" onClick={() => void reset(setting)} aria-label={`Réinitialiser ${setting.label}`} title="Revenir à la valeur du serveur">
                          <Icon name="refresh" size={17}/>
                        </button>
                      )}
                    </div>
                    <code>{setting.key}</code>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
