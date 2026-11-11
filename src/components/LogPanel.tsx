"use client";

import { useState } from "react";
import { ChevronDown, Plus, Trash2 } from "lucide-react";
import { useStore, type LogItemInput } from "@/lib/store";
import { TAGS, useT, type Key } from "@/lib/i18n";
import { descriptorsFor, DISH_TYPES, guessDishType } from "@/lib/dishTypes";
import { latestVerdictByDish, placeById } from "@/lib/derive";
import { PLATFORMS, VERDICTS, type ChipValue, type Platform, type Verdict } from "@/lib/types";
import { Button, cx, SidePanel, VERDICT_STYLE, VerdictIcon } from "./ui";
import { PlacePicker } from "./PlacePicker";

interface Item {
  key: string;
  dishId?: string;
  name: string;
  typeId: string | null;
  typeTouched: boolean;
  verdict: Verdict | null;
  chips: Record<string, ChipValue>;
  tags: string[];
  showChips: boolean;
}

const blank = (): Item => ({ key: crypto.randomUUID(), name: "", typeId: null, typeTouched: false, verdict: null, chips: {}, tags: [], showChips: false });
const today = () => new Date().toLocaleDateString("en-CA");

export function LogPanel() {
  const { t, pick, tagLabel } = useT();
  const places = useStore((s) => s.places);
  const dishes = useStore((s) => s.dishes);
  const logs = useStore((s) => s.logs);
  const initialPlace = useStore((s) => s.logPanel.placeId);
  const closeLog = useStore((s) => s.closeLog);
  const addMeal = useStore((s) => s.addMeal);

  const [placeId, setPlaceId] = useState<string | undefined>(initialPlace);
  const [items, setItems] = useState<Item[]>([blank()]);
  const [platform, setPlatform] = useState<Platform>("dinein");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [error, setError] = useState<Key | null>(null);

  const place = placeById(places, placeId);
  const knownDishes = place ? dishes.filter((d) => d.placeId === place.id && !items.some((i) => i.dishId === d.id)) : [];
  const verdicts = latestVerdictByDish(logs);

  const update = (key: string, patch: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...patch } : i)));

  const choosePlace = (id: string | undefined) => {
    setPlaceId(id);
    setItems([blank()]);
    const first = placeById(places, id)?.listings[0]?.platform;
    if (first && first !== "gmaps") setPlatform(first);
  };

  const addKnown = (dishId: string) => {
    const dish = dishes.find((d) => d.id === dishId);
    if (!dish) return;
    const item: Item = { ...blank(), dishId, name: dish.name, typeId: dish.typeId, typeTouched: true };
    setItems((list) => (list.length === 1 && !list[0].name ? [item] : [...list, item]));
  };

  const save = () => {
    if (!placeId) return setError("needPlace");
    const filled = items.filter((i) => i.name.trim());
    if (filled.length === 0 || filled.some((i) => !i.verdict)) return setError("needDish");
    const payload: LogItemInput[] = filled.map((i) => ({ dishId: i.dishId, name: i.name, typeId: i.typeId, verdict: i.verdict!, chips: i.chips, tags: i.tags }));
    addMeal({ placeId, platform, date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today(), note, items: payload });
    closeLog();
  };

  return (
    <SidePanel
      wide
      title={t("logMeal")}
      onClose={closeLog}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-danger" role="alert">{error ? t(error) : ""}</span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={closeLog}>{t("cancel")}</Button>
            <Button variant="primary" onClick={save}>{t("saveMeal")}</Button>
          </div>
        </div>
      }
    >
      <section className="mb-7">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">1 · {t("stepPlace")}</h3>
        <PlacePicker value={placeId} onChange={choosePlace} />
      </section>

      <section className={cx("mb-7", !place && "pointer-events-none opacity-40")} aria-hidden={!place}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">2 · {t("stepDishes")}</h3>

        {knownDishes.length > 0 && (
          <div className="mb-3">
            <div className="mb-1 text-xs text-muted">{t("knownDishes")}</div>
            <div className="flex flex-wrap gap-1.5">
              {knownDishes.map((d) => {
                const v = verdicts.get(d.id);
                return (
                  <button key={d.id} type="button" onClick={() => addKnown(d.id)} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface px-2.5 py-1 text-sm hover:bg-hover">
                    {v && <span className={VERDICT_STYLE[v].text}><VerdictIcon verdict={v} size={12} /></span>}
                    {d.name}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {items.map((item) => {
            const descriptors = descriptorsFor(item.typeId);
            return (
              <div key={item.key} className="rounded-lg border border-line p-3">
                <div className="flex gap-2">
                  <input
                    className="field"
                    value={item.name}
                    maxLength={120}
                    placeholder={t("dishName")}
                    aria-label={t("dishName")}
                    disabled={Boolean(item.dishId)}
                    onChange={(e) => update(item.key, { name: e.target.value, ...(item.typeTouched ? {} : { typeId: guessDishType(e.target.value) }) })}
                  />
                  <select
                    className="field w-[42%] shrink-0"
                    value={item.typeId ?? ""}
                    aria-label={t("dishType")}
                    disabled={Boolean(item.dishId)}
                    onChange={(e) => update(item.key, { typeId: e.target.value || null, typeTouched: true, chips: {} })}
                  >
                    <option value="">{t("dishType")}: {t("otherType")}</option>
                    {DISH_TYPES.map((dt) => <option key={dt.id} value={dt.id}>{pick(dt.name)}</option>)}
                  </select>
                  {items.length > 1 && (
                    <Button variant="ghost" small aria-label={t("remove")} onClick={() => setItems((l) => l.filter((i) => i.key !== item.key))}><Trash2 size={15} /></Button>
                  )}
                </div>

                <div className="mt-2.5 grid grid-cols-3 gap-2" role="radiogroup" aria-label={t("colVerdict")}>
                  {VERDICTS.map((v) => (
                    <button key={v} type="button" role="radio" aria-checked={item.verdict === v} onClick={() => { update(item.key, { verdict: v }); setError(null); }}
                      className={cx("flex items-center justify-center gap-1.5 rounded-md border px-2 py-2 text-sm font-medium transition-colors",
                        item.verdict === v ? cx(VERDICT_STYLE[v].solid, "border-transparent") : "border-line bg-surface text-muted hover:bg-hover")}>
                      <VerdictIcon verdict={v} size={15} />
                      {t(v)}
                    </button>
                  ))}
                </div>

                <button type="button" aria-expanded={item.showChips} onClick={() => update(item.key, { showChips: !item.showChips })} className="mt-2.5 flex items-center gap-1 text-sm text-muted hover:text-ink">
                  <ChevronDown size={14} className={cx("transition-transform", item.showChips && "rotate-180")} />
                  {t("tasteChips")}
                  {Object.keys(item.chips).length + item.tags.length > 0 && <span className="rounded-full bg-accent-soft px-1.5 text-xs text-accent">{Object.keys(item.chips).length + item.tags.length}</span>}
                </button>

                {item.showChips && (
                  <div className="mt-2 space-y-2.5">
                    <p className="text-xs text-muted">{t("chipsWhy")}</p>
                    {descriptors.map((desc) => (
                      <div key={desc.id} className="flex flex-wrap items-center gap-2">
                        <span className="w-32 shrink-0 text-sm">{pick(desc.label)}</span>
                        <div className="flex flex-1 gap-1" role="radiogroup" aria-label={pick(desc.label)}>
                          {([-1, 0, 1] as ChipValue[]).map((value, idx) => {
                            const on = item.chips[desc.id] === value;
                            return (
                              <button key={value} type="button" role="radio" aria-checked={on}
                                onClick={() => {
                                  const chips = { ...item.chips };
                                  if (on) delete chips[desc.id]; else chips[desc.id] = value;
                                  update(item.key, { chips });
                                }}
                                className={cx("flex-1 rounded border px-1.5 py-1 text-xs", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:bg-hover")}>
                                {pick(desc.scale[idx])}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                    <div>
                      <div className="mb-1 text-sm">{t("tags")}</div>
                      <div className="flex flex-wrap gap-1.5">
                        {TAGS.map((tag) => {
                          const on = item.tags.includes(tag);
                          return (
                            <button key={tag} type="button" aria-pressed={on}
                              onClick={() => update(item.key, { tags: on ? item.tags.filter((x) => x !== tag) : [...item.tags, tag] })}
                              className={cx("rounded-full border px-2.5 py-0.5 text-xs", on ? "border-accent bg-accent-soft font-medium text-accent" : "border-line text-muted hover:bg-hover")}>
                              {tagLabel(tag)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <Button variant="ghost" className="mt-2" onClick={() => setItems((l) => [...l, blank()])}><Plus size={15} />{t("addDish")}</Button>
      </section>

      <section className={cx(!place && "pointer-events-none opacity-40")} aria-hidden={!place}>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">3 · {t("stepDetails")}</h3>
        <div className="mb-3">
          <div className="mb-1 text-sm text-muted">{t("orderedVia")}</div>
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={t("orderedVia")}>
            {PLATFORMS.map((p) => (
              <button key={p} type="button" role="radio" aria-checked={platform === p} onClick={() => setPlatform(p)}
                className={cx("rounded-full border px-3 py-1 text-sm", platform === p ? "border-brand bg-brand-soft font-medium text-brand" : "border-line text-muted hover:bg-hover")}>
                {t(`p_${p}` as Key)}
              </button>
            ))}
          </div>
        </div>
        <label className="mb-3 block text-sm">
          <span className="mb-1 block text-muted">{t("date")}</span>
          <input type="date" className="field max-w-[200px]" value={date} max={today()} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muted">{t("note")}</span>
          <textarea className="field" rows={3} maxLength={1000} value={note} placeholder={t("notePh")} onChange={(e) => setNote(e.target.value)} />
        </label>
      </section>
    </SidePanel>
  );
}
