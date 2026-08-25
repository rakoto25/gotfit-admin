import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function PageHeader({ eyebrow, title, description, actions }: { eyebrow: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <header className="ops-page-header">
      <div>
        <span className="ops-eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="ops-page-actions">{actions}</div>}
    </header>
  );
}

export function MetricCard({ label, value, detail, icon, tone = "neutral" }: { label: string; value: ReactNode; detail?: string; icon: IconName; tone?: "neutral" | "orange" | "green" | "blue" | "red" }) {
  return (
    <article className={`ops-metric ops-metric--${tone}`}>
      <div className="ops-metric__icon"><Icon name={icon} size={22} /></div>
      <span>{label}</span>
      <strong>{value}</strong>
      {detail && <small>{detail}</small>}
    </article>
  );
}

export function StatusBadge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "success" | "warning" | "danger" | "info" | "dark" }) {
  return <span className={`ops-status ops-status--${tone}`}>{children}</span>;
}

export function Notice({ tone, children }: { tone: "error" | "success" | "info"; children: ReactNode }) {
  return <div className={`ops-notice ops-notice--${tone}`}>{children}</div>;
}

export function LoadingState({ label = "Chargement des données…" }: { label?: string }) {
  return <div className="ops-state"><span className="ops-spinner"/><strong>{label}</strong></div>;
}

export function EmptyState({ icon = "search", title, description }: { icon?: IconName; title: string; description: string }) {
  return <div className="ops-empty"><span><Icon name={icon} size={28}/></span><strong>{title}</strong><p>{description}</p></div>;
}

export function Modal({ title, eyebrow, onClose, children, footer }: { title: string; eyebrow?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="ops-modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <section className="ops-modal" role="dialog" aria-modal="true" aria-label={title}>
        <header className="ops-modal__header">
          <div>{eyebrow && <span>{eyebrow}</span>}<h2>{title}</h2></div>
          <button type="button" className="ops-icon-button" onClick={onClose} aria-label="Fermer"><Icon name="close"/></button>
        </header>
        <div className="ops-modal__body">{children}</div>
        {footer && <footer className="ops-modal__footer">{footer}</footer>}
      </section>
    </div>
  );
}
