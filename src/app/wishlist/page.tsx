"use client";

import { useState } from "react";
import { MapPin, Plus, Star } from "lucide-react";
import { useStore } from "@/lib/store";
import { useT } from "@/lib/i18n";
import { Page } from "@/components/AppShell";
import { Button, EmptyState, PageHeader, SidePanel } from "@/components/ui";
import { PlacePicker } from "@/components/PlacePicker";

export default function WishlistPage() {
  const { t } = useT();
  const places = useStore((s) => s.places);
  const setWishlist = useStore((s) => s.setWishlist);
  const setPeek = useStore((s) => s.setPeek);
  const openLog = useStore((s) => s.openLog);
  const [adding, setAdding] = useState(false);

  const wished = places.filter((p) => p.wishlist);

  return (
    <Page>
      <PageHeader icon={<Star size={24} />} title={t("wishTitle")} sub={t("wishSub")}
        actions={<Button variant="primary" onClick={() => setAdding(true)}><Plus size={16} />{t("addWish")}</Button>} />
      {wished.length === 0 ? (
        <EmptyState action={<Button onClick={() => setAdding(true)}><Plus size={16} />{t("addWish")}</Button>}>{t("emptyWish")}</EmptyState>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
          {wished.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setPeek(p.id)}>
                <div className="truncate font-medium">{p.name}</div>
                <div className="flex items-center gap-1 text-xs text-muted"><MapPin size={12} />{p.area || "—"}</div>
                {p.wishNote && <p className="mt-1 text-sm text-muted">{p.wishNote}</p>}
              </button>
              <Button small variant="primary" onClick={() => openLog(p.id)}>{t("tried")}</Button>
              <Button small variant="ghost" onClick={() => setWishlist(p.id, false)}>{t("remove")}</Button>
            </li>
          ))}
        </ul>
      )}
      {adding && (
        <SidePanel title={t("addWish")} onClose={() => setAdding(false)}>
          <PlacePicker forWishlist onChange={(id) => id && setAdding(false)} />
        </SidePanel>
      )}
    </Page>
  );
}
