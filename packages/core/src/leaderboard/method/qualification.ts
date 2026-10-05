import {ANCHORS,type Policy,type RegistryEntry,type SignalRow} from "./consensus.ts";
export function qualifyModels(
  units: string[],
  registry: Record<string, RegistryEntry>,
  unitRows: Map<string, Map<string, SignalRow>>,
  policy: Policy,
  released: Map<string, Date | null>,
  cutoff: Date,
): string[] {
  const active = units.filter((u) => registry[u] && registry[u]!.weight > 0);
  const has = (slug: string, u: string) => unitRows.get(u)?.has(slug) ?? false;
  const candidates = new Set<string>();
  for (const u of active) for (const slug of unitRows.get(u)?.keys() ?? []) candidates.add(slug);
  const out: string[] = [];
  for (const slug of candidates) {
    const rel = released.get(slug);
    if (rel && rel < cutoff) continue;
    const us = active.filter((u) => has(slug, u));
    if (new Set(us.map(u => registry[u]!.sourceKey)).size < policy.sources) continue;
    if (new Set(us.map((u) => registry[u]!.family)).size < policy.families) continue;
    if (new Set(us.map((u) => registry[u]!.operator)).size < policy.operators) continue;
    if (new Set(us.map((u) => registry[u]!.budget)).size < policy.categories) continue;
    const anchors = ANCHORS.filter((a) => a !== slug && us.some((u) => has(a, u))).length;
    if (anchors < policy.directAnchors) continue;
    out.push(slug);
  }
  return out.sort();
}
