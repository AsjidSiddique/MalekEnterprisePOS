import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

interface FieldProps {
  label: string;
  error?: string;
  hint?: string;
  children: (a11y: { id: string; "aria-invalid": boolean; "aria-describedby": string | undefined; className: string }) => ReactNode;
  className?: string;
}

/** Label + control + error/hint wiring in one place so every form is accessible by default. */
export function Field({ label, error, hint, children, className }: FieldProps) {
  const id = useId();
  const describedBy = error ? `${id}-err` : hint ? `${id}-hint` : undefined;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-sm font-medium text-ink-800">{label}</label>
      {children({ id, "aria-invalid": Boolean(error), "aria-describedby": describedBy, className: cn("field", error && "field-invalid") })}
      {error ? (
        <p id={`${id}-err`} role="alert" className="text-xs font-medium text-[#A22B3B]">{error}</p>
      ) : hint ? (
        <p id={`${id}-hint`} className="text-xs text-muted">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({ label, error, hint, className, ...input }: { label: string; error?: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(p) => <input {...p} {...input} />}
    </Field>
  );
}

export function TextAreaField({ label, error, hint, className, ...input }: { label: string; error?: string; hint?: string } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(p) => <textarea rows={3} {...p} {...input} />}
    </Field>
  );
}

export function SelectField({ label, error, hint, className, options, placeholder, ...input }:
  { label: string; error?: string; hint?: string; options: { value: string; label: string }[]; placeholder?: string } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <Field label={label} error={error} hint={hint} className={className}>
      {(p) => (
        <select {...p} {...input}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      )}
    </Field>
  );
}

export const CheckboxField = forwardRef<HTMLInputElement, { label: string; description?: string } & Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function CheckboxField({ label, description, className, ...input }, ref) {
    const id = useId();
    return (
      <div className={cn("flex items-start gap-3", className)}>
        <input ref={ref} id={id} type="checkbox" className="mt-0.5 h-4 w-4 rounded border-line accent-[rgb(16,33,74)]" {...input} />
        <label htmlFor={id} className="text-sm">
          <span className="font-medium text-ink-800">{label}</span>
          {description && <span className="block text-xs text-muted">{description}</span>}
        </label>
      </div>
    );
  },
);
