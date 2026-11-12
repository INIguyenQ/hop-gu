"use client";

import { useEffect } from "react";
import { Ban, Heart, Meh, X } from "lucide-react";
import type { Verdict } from "@/lib/types";
import type { PlaceSummary } from "@/lib/derive";
import { useT } from "@/lib/i18n";

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

export const VERDICT_STYLE: Record<Verdict, { text: string; soft: string; solid: string; cssVar: string }> = {
  love: { text: "text-brand", soft: "bg-brand-soft text-brand", solid: "bg-brand text-on-brand", cssVar: "var(--brand)" },
  ok: { text: "text-okay", soft: "bg-okay-soft text-okay", solid: "bg-okay-soft text-okay ring-1 ring-okay", cssVar: "var(--okay)" },
  never: { text: "text-danger", soft: "bg-danger-soft text-danger", solid: "bg-danger text-white", cssVar: "var(--danger)" },
};

export function VerdictIcon({ verdict, size = 14 }: { verdict: Verdict; size?: number }) {
  const Icon = verdict === "love" ? Heart : verdict === "ok" ? Meh : Ban;
  return <Icon size={size} aria-hidden fill={verdict === "love" ? "currentColor" : "none"} />;
}

export function VerdictBadge({ verdict }: { verdict: Verdict }) {
  const { t } = useT();
  return (
    <span className={cx("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium whitespace-nowrap", VERDICT_STYLE[verdict].soft)}>
      <VerdictIcon verdict={verdict} size={12} />
      {t(verdict)}
    </span>
  );
}

/** "2 loved · 1 never again" counts for a place. */
export function PlaceCounts({ summary }: { summary: PlaceSummary }) {
  const { t } = useT();
  if (!summary.status) return <span className="text-xs text-muted">{t("notTried")}</span>;
  return (
    <span className="inline-flex items-center gap-2 text-xs font-medium">
      {(["love", "ok", "never"] as Verdict[]).map((v) =>
        summary[v] > 0 ? (
          <span key={v} className={cx("inline-flex items-center gap-0.5", VERDICT_STYLE[v].text)} title={t(v)}>
            <VerdictIcon verdict={v} size={12} />
            {summary[v]}
            <span className="sr-only">{t(v)}</span>
          </span>
        ) : null,
      )}
    </span>
  );
}

export function Tag({ children, tone = "plain" }: { children: React.ReactNode; tone?: "plain" | "accent" }) {
  return (
    <span className={cx("inline-flex items-center rounded px-1.5 py-0.5 text-xs whitespace-nowrap", tone === "accent" ? "bg-accent-soft text-accent" : "bg-hover text-muted")}>
      {children}
    </span>
  );
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "ghost" | "outline" | "danger"; small?: boolean };

export function Button({ variant = "outline", small, className, type = "button", ...rest }: BtnProps) {
  return (
    <button
      type={type}
      {...rest}
      className={cx(
        "inline-flex items-center justify-center gap-1.5 rounded-md font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed",
        small ? "px-2 py-1 text-xs" : "px-3 py-1.5 text-sm",
        variant === "primary" && "bg-brand text-on-brand hover:bg-brand-strong",
        variant === "outline" && "border border-line bg-surface hover:bg-hover",
        variant === "ghost" && "text-muted hover:bg-hover hover:text-ink",
        variant === "danger" && "border border-danger text-danger hover:bg-danger-soft",
        className,
      )}
    />
  );
}

export function PageHeader({ icon, title, sub, actions }: { icon: React.ReactNode; title: string; sub?: string; actions?: React.ReactNode }) {
  return (
    <header className="mb-6">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
        {actions}
      </div>
      {sub && <p className="mt-2 max-w-2xl text-muted">{sub}</p>}
    </header>
  );
}

/** Notion-style side panel that slides in from the right. */
export function SidePanel({ title, onClose, children, footer, wide }: { title: string; onClose: () => void; children: React.ReactNode; footer?: React.ReactNode; wide?: boolean }) {
  const { t } = useT();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-40 flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" aria-label={t("close")} className="absolute inset-0 bg-black/25" onClick={onClose} />
      <div className={cx("anim-slide relative flex h-full w-full flex-col border-l border-line bg-surface shadow-pop", wide ? "max-w-[560px]" : "max-w-[460px]")}>
        <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
          <h2 className="text-sm font-semibold text-muted">{title}</h2>
          <Button variant="ghost" small onClick={onClose} aria-label={t("close")}>
            <X size={16} />
          </Button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="border-t border-line px-5 py-3">{footer}</div>}
      </div>
    </div>
  );
}

export function EmptyState({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line px-6 py-12 text-center text-muted">
      <p>{children}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
