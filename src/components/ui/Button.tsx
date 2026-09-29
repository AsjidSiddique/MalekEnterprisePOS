import Link from "next/link";
import { Loader2 } from "lucide-react";
import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger" | "onDark" | "soft";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-field font-semibold transition duration-150 disabled:cursor-not-allowed disabled:opacity-55 select-none whitespace-nowrap active:translate-y-px";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-accent text-accent-ink shadow-btn hover:brightness-105 active:shadow-none",
  dark: "bg-ink-900 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.14),0_10px_20px_-12px_rgb(12_26_61/0.9)] hover:bg-ink-800",
  secondary: "border border-line bg-surface text-ink-900 shadow-sm hover:border-ink-300 hover:bg-paper",
  soft: "bg-ink-100 text-ink-800 hover:bg-ink-200/80",
  ghost: "text-ink-700 hover:bg-ink-100/80",
  danger: "bg-bad text-white shadow-sm hover:brightness-110",
  onDark: "border border-white/25 bg-white/5 text-white backdrop-blur-sm hover:bg-white/12",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[13px]",
  md: "h-10 px-4 text-sm",
  lg: "h-12 rounded-[10px] px-6 text-base",
};

export const buttonClasses = (variant: ButtonVariant = "primary", size: ButtonSize = "md", className?: string) =>
  cn(base, variants[variant], sizes[size], className);

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant, size, loading, disabled, className, children, type = "button", ...rest }, ref,
) {
  return (
    <button ref={ref} type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={buttonClasses(variant, size, className)} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});

interface ButtonLinkProps extends AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export function ButtonLink({ href, variant, size, className, children, ...rest }: ButtonLinkProps) {
  const external = /^https?:\/\//.test(href);
  const cls = buttonClasses(variant, size, className);
  return external ? (
    <a href={href} className={cls} {...rest}>{children}</a>
  ) : (
    <Link href={href} className={cls} {...rest}>{children}</Link>
  );
}
