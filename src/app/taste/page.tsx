"use client";

import { useMemo } from "react";
import { Plus, Sparkles, Users } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { computeTaste, CONFIDENT_LOGS } from "@/lib/taste";
import { getDishType } from "@/lib/dishTypes";
import { Page } from "@/components/AppShell";
import { Button, cx, EmptyState, PageHeader, Tag, VERDICT_STYLE, VerdictIcon } from "@/components/ui";

export default function TastePage() {
  const { t, pick } = useT();
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const openLog = useStore((s) => s.openLog);

  const taste = useMemo(() => computeTaste(logs, dishes), [logs, dishes]);

  return (
    <Page>
      <PageHeader icon={<Sparkles size={24} />} title={t("tasteTitle")} sub={t("tasteSub")} />
      <p className="mb-5 flex gap-2 rounded-lg bg-brand-soft px-4 py-2.5 text-sm text-brand"><Users size={16} className="mt-0.5 shrink-0" />{t("twinsNote")}</p>

      {taste.length === 0 ? (
        <EmptyState action={<Button variant="primary" onClick={() => openLog()}><Plus size={16} />{t("logMeal")}</Button>}>{t("emptyTaste")}</EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {taste.map((tt) => {
            const type = getDishType(tt.typeId);
            if (!type) return null;
            const missing = Math.max(0, CONFIDENT_LOGS - tt.logs);
            return (
              <section key={tt.typeId} className="rounded-xl border border-line bg-surface p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="text-lg font-semibold">{pick(type.name)}</h2>
                  <div className="flex items-center gap-2 text-xs font-medium">
                    {tt.love > 0 && <span className={cx("inline-flex items-center gap-0.5", VERDICT_STYLE.love.text)}><VerdictIcon verdict="love" size={12} />{tt.love}</span>}
                    {tt.never > 0 && <span className={cx("inline-flex items-center gap-0.5", VERDICT_STYLE.never.text)}><VerdictIcon verdict="never" size={12} />{tt.never}</span>}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span>{tt.logs} {t("logsCount")}</span>
                  {missing > 0 ? <Tag>{t("needMore", { n: missing })}</Tag> : <Tag tone="accent">{t("reliable")}</Tag>}
                </div>

                <dl className="mt-4 space-y-3.5">
                  {type.descriptors.map((desc) => {
                    const d = tt.descriptors[desc.id];
                    const known = d && d.lean !== "unknown";
                    const idx = !known ? 1 : d.lean === "low" ? 0 : d.lean === "high" ? 2 : 1;
                    const text = !known ? t("leanUnknown") : d.lean === "any" ? t("leanAny") : `${t("leanLow")}: ${pick(desc.scale[idx])}`;
                    return (
                      <div key={desc.id}>
                        <div className="flex items-baseline justify-between gap-2 text-sm">
                          <dt className="font-medium">{pick(desc.label)}</dt>
                          <dd className={cx("text-xs", known && d.lean !== "any" ? "text-ink" : "text-muted")}>{text}</dd>
                        </div>
                        <div className="relative mt-1.5 h-1.5 rounded-full bg-hover" aria-hidden>
                          {known && d.lean !== "any" && (
                            <span className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-brand" style={{ left: `${((d.pref + 1) / 2) * 100}%` }} />
                          )}
                          {known && d.lean === "any" && <span className="absolute inset-0 rounded-full bg-line" />}
                        </div>
                        <div className="mt-1 flex justify-between text-[11px] text-muted" aria-hidden>
                          <span>{pick(desc.scale[0])}</span>
                          <span>{pick(desc.scale[2])}</span>
                        </div>
                      </div>
                    );
                  })}
                </dl>
              </section>
            );
          })}
        </div>
      )}
    </Page>
  );
}
