import type { ChipValue, Dish, Log, Place, Verdict } from "./types.ts";

export const VERDICT_SCORE: Record<Verdict, number> = { love: 1, ok: 0, never: -1 };

/** Newest first. */
export function sortLogs(logs: Log[]): Log[] {
  return [...logs].sort((a, b) => (a.date === b.date ? b.createdAt.localeCompare(a.createdAt) : b.date.localeCompare(a.date)));
}

/** The most recent verdict the user gave each dish. */
export function latestVerdictByDish(logs: Log[]): Map<string, Verdict> {
  const out = new Map<string, Verdict>();
  for (const log of sortLogs(logs)) if (!out.has(log.dishId)) out.set(log.dishId, log.verdict);
  return out;
}

export interface PlaceSummary {
  love: number;
  ok: number;
  never: number;
  lastDate: string | null;
  /** love: something here is loved. never: only bad experiences. ok: in between. null: not tried. */
  status: Verdict | null;
}

export function summarizePlace(placeId: string, dishes: Dish[], logs: Log[]): PlaceSummary {
  const placeLogs = logs.filter((l) => l.placeId === placeId);
  const latest = latestVerdictByDish(placeLogs);
  const s: PlaceSummary = { love: 0, ok: 0, never: 0, lastDate: null, status: null };
  for (const dish of dishes) {
    if (dish.placeId !== placeId) continue;
    const v = latest.get(dish.id);
    if (v) s[v] += 1;
  }
  for (const l of placeLogs) if (!s.lastDate || l.date > s.lastDate) s.lastDate = l.date;
  if (s.love > 0) s.status = "love";
  else if (s.never > 0 && s.ok === 0) s.status = "never";
  else if (s.ok > 0 || s.never > 0) s.status = "ok";
  return s;
}

/** A dish's taste picture: the average of every chip given to it. */
export function dishChipProfile(dishId: string, logs: Log[]): Record<string, number> {
  const sums: Record<string, { total: number; n: number }> = {};
  for (const log of logs) {
    if (log.dishId !== dishId) continue;
    for (const [key, value] of Object.entries(log.chips)) {
      sums[key] ??= { total: 0, n: 0 };
      sums[key].total += value as ChipValue;
      sums[key].n += 1;
    }
  }
  return Object.fromEntries(Object.entries(sums).map(([k, v]) => [k, v.total / v.n]));
}

export function placeById(places: Place[], id: string | null | undefined): Place | undefined {
  return id ? places.find((p) => p.id === id) : undefined;
}
