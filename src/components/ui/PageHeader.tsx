import type { ReactNode } from "react";

export function PageHeader({ title, description, actions, eyebrow, leading }: { title: string; description?: string; actions?: ReactNode; eyebrow?: ReactNode; leading?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="flex items-center gap-4">
        {leading}
        <div>
        {eyebrow && <div className="mb-1.5 text-sm text-muted">{eyebrow}</div>}
        <h1 className="display-wide text-[30px] font-bold text-ink-900 sm:text-[36px]">{title}</h1>
        {description && <p className="mt-1.5 max-w-2xl text-[15px] text-muted">{description}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
