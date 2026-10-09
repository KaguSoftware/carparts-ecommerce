import type { ButtonHTMLAttributes, ReactNode } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "link";
export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const base =
  "relative inline-flex items-center justify-center gap-2 rounded-sm font-display font-semibold uppercase tracking-[0.06em] " +
  "whitespace-nowrap select-none transition-[background-color,color,border-color,transform,box-shadow] duration-150 ease-out " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50";

// The chamfered primary clips its own outline, so its focus ring is drawn inside the shape.
const primaryFocus =
  "focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_2px_var(--primary-foreground),inset_0_0_0_4px_var(--primary)]";

// Disabled is its own state, not half-opacity orange: a quiet sunken plate with muted text that stays readable (about 4.5:1).
const primaryDisabled =
  "disabled:bg-surface-sunken disabled:text-muted disabled:opacity-100 disabled:shadow-[inset_0_0_0_1px_var(--border-strong)] aria-disabled:bg-surface-sunken aria-disabled:text-muted aria-disabled:opacity-100 aria-disabled:shadow-[inset_0_0_0_1px_var(--border-strong)]";

const variants: Record<ButtonVariant, string> = {
  primary: `chamfer bg-primary text-primary-foreground hover:bg-primary-hover active:bg-primary-active ${primaryDisabled} ${primaryFocus}`,
  secondary: "bg-secondary text-secondary-foreground hover:bg-secondary-hover",
  outline: "border border-border-strong bg-transparent text-foreground hover:border-foreground hover:bg-surface-sunken",
  ghost: "bg-transparent text-foreground hover:bg-surface-sunken",
  danger: "bg-danger-solid text-danger-solid-foreground hover:brightness-110",
  link: "h-auto rounded-none p-0 font-sans font-medium normal-case tracking-normal text-primary-text underline underline-offset-4 hover:no-underline",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-9 px-3.5 text-[0.8125rem]",
  md: "h-11 px-5 text-[0.9375rem]",
  lg: "h-13 px-7 text-base",
  icon: "h-11 w-11 p-0 text-base",
  "icon-sm": "h-9 w-9 p-0 text-sm",
};

export interface ButtonStyleOptions {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  className?: string;
}

/**
 * Class string for button visuals. Use it on `<Link>` / `<a>` so link-buttons match <Button>:
 *   <Link href="/cart" className={buttonStyles({ variant: "outline" })}>View cart</Link>
 */
export function buttonStyles({ variant = "primary", size = "md", fullWidth, className }: ButtonStyleOptions = {}): string {
  return cn(base, variants[variant], variant === "link" ? "" : sizes[size], fullWidth && "w-full", className);
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, ButtonStyleOptions {
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export function Button({
  variant = "primary",
  size = "md",
  fullWidth,
  loading = false,
  leftIcon,
  rightIcon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={buttonStyles({ variant, size, fullWidth, className })}
      {...props}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : leftIcon}
      {children}
      {!loading ? rightIcon : null}
    </button>
  );
}
