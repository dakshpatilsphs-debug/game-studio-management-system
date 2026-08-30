import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "../utils/cn";

export function Card({
  children,
  className,
  interactive,
}: {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-hairline bg-panel shadow-lg shadow-black/30",
        interactive && "transition-colors hover:border-muted/40",
        className
      )}
    >
      {children}
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  icon,
  action,
}: {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-hairline bg-panel2 text-free">
            {icon}
          </div>
        )}
        <div>
          <h2 className="font-display text-base font-semibold tracking-tight text-ink">{title}</h2>
          {subtitle && <p className="text-sm text-muted">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

type BtnVariant = "primary" | "ghost" | "danger" | "outline";

export function Button({
  children,
  onClick,
  variant = "primary",
  className,
  type = "button",
  disabled,
  size = "md",
  loading,
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: BtnVariant;
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
  size?: "sm" | "md";
  loading?: boolean;
}) {
  const variants: Record<BtnVariant, string> = {
    primary: "bg-free text-canvas hover:brightness-110 shadow-lg shadow-free/20",
    danger: "bg-danger text-white hover:brightness-110 shadow-lg shadow-danger/20",
    outline: "border border-hairline bg-panel2 text-ink hover:border-muted/50",
    ghost: "text-muted hover:bg-panel2 hover:text-ink",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-sm",
        variants[variant],
        className
      )}
    >
      {loading && <span className="h-4 w-4 animate-spin rounded-full border-2 border-current/40 border-t-current" />}
      {children}
    </button>
  );
}

const statusStyles: Record<string, { dot: string; text: string; bg: string; ring: string }> = {
  available: { dot: "bg-free", text: "text-free", bg: "bg-free/10", ring: "ring-free/30" },
  free: { dot: "bg-free", text: "text-free", bg: "bg-free/10", ring: "ring-free/30" },
  rented: { dot: "bg-occupied", text: "text-occupied", bg: "bg-occupied/10", ring: "ring-occupied/30" },
  occupied: { dot: "bg-occupied", text: "text-occupied", bg: "bg-occupied/10", ring: "ring-occupied/30" },
  active: { dot: "bg-occupied", text: "text-occupied", bg: "bg-occupied/10", ring: "ring-occupied/30" },
  maintenance: { dot: "bg-warn", text: "text-warn", bg: "bg-warn/10", ring: "ring-warn/30" },
  completed: { dot: "bg-muted", text: "text-muted", bg: "bg-white/5", ring: "ring-white/10" },
};

export function StatusBadge({
  status,
  label,
  className,
}: {
  status: string;
  label?: string;
  className?: string;
}) {
  const s = statusStyles[status] || statusStyles.completed;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        s.bg,
        s.text,
        s.ring,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {label || status}
    </span>
  );
}

export function Badge({
  children,
  className,
  tone = "muted",
  color,
}: {
  children: ReactNode;
  className?: string;
  tone?: "muted" | "free" | "warn" | "danger";
  color?: string; // status-based color (available/rented/maintenance/active/completed…)
}) {
  if (color) {
    const s = statusStyles[color] || statusStyles.completed;
    return (
      <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", s.bg, s.text, s.ring, className)}>
        {children}
      </span>
    );
  }
  const tones = {
    muted: "bg-white/5 text-muted ring-white/10",
    free: "bg-free/10 text-free ring-free/30",
    warn: "bg-warn/10 text-warn ring-warn/30",
    danger: "bg-danger/10 text-danger ring-danger/30",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset", tones[tone], className)}>
      {children}
    </span>
  );
}

export function Input({
  label,
  className,
  mono,
  ...props
}: { label?: string; mono?: boolean } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>}
      <input
        className={cn(
          "w-full rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 outline-none transition focus:border-free/50 focus:ring-2 focus:ring-free/20",
          mono && "mono",
          className
        )}
        {...props}
      />
    </label>
  );
}

export function Select({
  label,
  className,
  children,
  ...props
}: { label?: string } & React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>}
      <select
        className={cn(
          "w-full rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm text-ink outline-none transition focus:border-free/50 focus:ring-2 focus:ring-free/20 [&>option]:bg-panel2 [&>option]:text-ink",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: { label?: string } & React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="block">
      {label && <span className="mb-1.5 block text-sm font-medium text-muted">{label}</span>}
      <textarea
        className={cn(
          "w-full rounded-xl border border-hairline bg-panel2 px-3.5 py-2.5 text-sm text-ink placeholder-muted/60 outline-none transition focus:border-free/50 focus:ring-2 focus:ring-free/20",
          className
        )}
        {...props}
      />
    </label>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  wide,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) {
      window.addEventListener("keydown", onKey);
      const prev = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        window.removeEventListener("keydown", onKey);
        document.body.style.overflow = prev;
      };
    }
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "sheet-in relative my-4 flex max-h-[92dvh] w-full flex-col overflow-hidden rounded-2xl border border-hairline bg-panel shadow-2xl",
          wide ? "max-w-3xl" : "max-w-lg"
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-4 sm:px-6">
          <h3 className="font-display text-lg font-semibold text-ink">{title}</h3>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted transition hover:bg-panel2 hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 py-5 sm:px-6 sm:py-6">{children}</div>
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-hairline px-6 py-14 text-center">
      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-panel2 text-muted">
        {icon}
      </div>
      <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
      {body && <p className="mt-1 max-w-sm text-sm text-muted">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon,
  accent = "free",
  hint,
  delta,
}: {
  label: string;
  value: string;
  icon: ReactNode;
  accent?: string;
  hint?: string;
  delta?: string;
}) {
  const accents: Record<string, string> = {
    free: "text-free bg-free/10 ring-free/20",
    emerald: "text-free bg-free/10 ring-free/20",
    cyan: "text-free bg-free/10 ring-free/20",
    occupied: "text-occupied bg-occupied/10 ring-occupied/20",
    violet: "text-occupied bg-occupied/10 ring-occupied/20",
    warn: "text-warn bg-warn/10 ring-warn/20",
    amber: "text-warn bg-warn/10 ring-warn/20",
    danger: "text-danger bg-danger/10 ring-danger/20",
    rose: "text-danger bg-danger/10 ring-danger/20",
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-muted">{label}</p>
          <p className="mono mt-2 text-2xl font-bold tracking-tight text-ink">{value}</p>
          {(hint || delta) && <p className="mt-1 text-xs text-muted">{hint || delta}</p>}
        </div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg ring-1 ring-inset", accents[accent])}>
          {icon}
        </div>
      </div>
    </Card>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-lg", className)} />;
}
