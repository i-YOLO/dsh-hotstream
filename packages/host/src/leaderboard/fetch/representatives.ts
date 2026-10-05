import {modelSlug,cloakedModel} from "dsh-hotstream-core/leaderboard/identity";
import {REASONS} from "./configuration.ts";
import {competitionRanks} from "./rank.ts";
import type {ParsedRow} from "./types.ts";
export function storedConfigurationKey(r: ParsedRow): string {
  return r.configurationKey ?? `${r.configuration.key}@${r.keyName ?? r.sourceModelName}`;
}

export interface ResolvedRow extends ParsedRow {
  modelId: string;
  selected: boolean;
  selectionReason: string;
}

/**
 * Representative row per (model, metric): eligible rows only, highest priority, then first-party; among
 * equal configurations, the row the source names in slug form, then the one named like the model itself,
 * then the shorter name.
 */
export function selectRepresentatives(rows: Array<ParsedRow & { modelId: string }>, modelSlugs: Map<string, string> = new Map()): ResolvedRow[] {
  const groups = new Map<string, Array<ParsedRow & { modelId: string }>>();
  for (const r of rows) {
    const k = `${r.modelId}\u0000${r.metricKey}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r);
  }
  const out: ResolvedRow[] = [];
  for (const group of groups.values()) {
    const cloaked = (r: ParsedRow & { modelId: string }) => cloakedModel(r.sourceModelName, modelSlugs.get(r.modelId));
    const eligible = group.filter((r) => !r.configuration.ineligible && !cloaked(r));
    const slugShaped = (r: ParsedRow) => Number(/^[a-z0-9-]+$/.test(r.sourceModelName));
    const selfNamed = (r: ParsedRow & { modelId: string }) => Number(modelSlug(r.sourceModelName) === modelSlugs.get(r.modelId));
    const best = [...eligible].sort(
      (a, b) =>
        b.configuration.rank - a.configuration.rank ||
        Number(b.configuration.kind === "FIRST_PARTY") - Number(a.configuration.kind === "FIRST_PARTY") ||
        slugShaped(b) - slugShaped(a) ||
        selfNamed(b) - selfNamed(a) ||
        a.sourceModelName.length - b.sourceModelName.length ||
        (a.sourceModelName < b.sourceModelName ? -1 : a.sourceModelName > b.sourceModelName ? 1 : 0),
    )[0];
    for (const r of group) {
      const selected = r === best;
      const scaffolded = r.configuration.kind === "SCAFFOLDED";
      const selectionReason = r.configuration.ineligible
        ? r.configuration.ineligible
        : cloaked(r)
          ? REASONS.cloaked
        : selected
          ? scaffolded ? REASONS.scaffoldedSelected : r.configuration.kind === "FIRST_PARTY" ? REASONS.firstParty : REASONS.sourceDefault
          : scaffolded ? REASONS.scaffoldedLower : REASONS.lowerPriority;
      out.push({ ...r, selected, selectionReason });
    }
  }
  return out;
}

/**
 * The rank the source's own table shows, for sources that do not state one: every row of the metric
 * (all configurations) in competition order. All fetched metrics are higher-is-better.
 */
function withSourceRanks(rows: ParsedRow[]): ParsedRow[] {
  const byMetric = new Map<string, ParsedRow[]>();
  for (const r of rows) (byMetric.get(r.metricKey) ?? byMetric.set(r.metricKey, []).get(r.metricKey)!).push(r);
  const ranked = new Map<ParsedRow, number>();
  for (const group of byMetric.values()) {
    if (group.some((r) => r.sourceRank != null)) continue;
    const ranks = competitionRanks(group.map((r) => r.rawScore));
    group.forEach((r, i) => ranked.set(r, ranks[i]!));
  }
  return rows.map((r) => (ranked.has(r) ? { ...r, sourceRank: ranked.get(r)! } : r));
}

/** A source occasionally lists the same run twice (same name and settings); the first, higher-placed row stands. */
function firstPerConfiguration(rows: ParsedRow[]): ParsedRow[] {
  const seen = new Set<string>();
  return rows.filter((r) => {
    const k = `${storedConfigurationKey(r)}\u0000${r.metricKey}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
