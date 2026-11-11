import type { Dish, Log } from "./types.ts";
import { dishChipProfile, VERDICT_SCORE } from "./derive.ts";

export type Lean = "low" | "mid" | "high" | "any" | "unknown";

export interface DescriptorTaste {
  /** -1 (prefers low) .. +1 (prefers high). */
  pref: number;
  /** 0 (does not matter to this person) .. 1 (matters a lot). */
  importance: number;
  /** How many loved / never-again logs this is based on. */
  n: number;
  lean: Lean;
}

export interface TypeTaste {
  typeId: string;
  logs: number;
  love: number;
  never: number;
  descriptors: Record<string, DescriptorTaste>;
}

/** Logs needed on one dish type before the profile is treated as reliable. */
export const CONFIDENT_LOGS = 5;

/**
 * Builds the user's taste profile for each dish type.
 *
 * Dishes they love pull the preference toward that dish's chip profile; dishes
 * marked "never again" push it away. If they love dishes at both ends of a
 * chip (sweet and not sweet), that chip matters little to them.
 */
export function computeTaste(logs: Log[], dishes: Dish[]): TypeTaste[] {
  const dishById = new Map(dishes.map((x) => [x.id, x]));
  const profiles = new Map<string, Record<string, number>>();
  const byType = new Map<string, Log[]>();

  for (const log of logs) {
    const typeId = dishById.get(log.dishId)?.typeId;
    if (!typeId) continue;
    if (!byType.has(typeId)) byType.set(typeId, []);
    byType.get(typeId)!.push(log);
    if (!profiles.has(log.dishId)) profiles.set(log.dishId, dishChipProfile(log.dishId, logs));
  }

  const result: TypeTaste[] = [];
  for (const [typeId, typeLogs] of byType) {
    const acc: Record<string, { weighted: number; weight: number; loved: number[] }> = {};
    for (const log of typeLogs) {
      const score = VERDICT_SCORE[log.verdict];
      if (score === 0) continue;
      const profile = profiles.get(log.dishId) ?? {};
      for (const [key, value] of Object.entries(profile)) {
        acc[key] ??= { weighted: 0, weight: 0, loved: [] };
        acc[key].weighted += score * value;
        acc[key].weight += 1;
        if (score > 0) acc[key].loved.push(value);
      }
    }

    const descriptors: Record<string, DescriptorTaste> = {};
    for (const [key, a] of Object.entries(acc)) {
      const pref = a.weight ? a.weighted / a.weight : 0;
      let importance = 1;
      if (a.loved.length >= 2) {
        const mean = a.loved.reduce((s, v) => s + v, 0) / a.loved.length;
        const variance = a.loved.reduce((s, v) => s + (v - mean) ** 2, 0) / a.loved.length;
        importance = Math.max(0, 1 - Math.sqrt(variance));
      }
      const lean: Lean =
        a.weight === 0 ? "unknown" : importance < 0.35 ? "any" : pref < -0.33 ? "low" : pref > 0.33 ? "high" : "mid";
      descriptors[key] = { pref, importance, n: a.weight, lean };
    }

    result.push({
      typeId,
      logs: typeLogs.length,
      love: typeLogs.filter((l) => l.verdict === "love").length,
      never: typeLogs.filter((l) => l.verdict === "never").length,
      descriptors,
    });
  }
  return result.sort((a, b) => b.logs - a.logs);
}
