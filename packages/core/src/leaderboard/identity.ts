export function modelSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/([a-z])(\d)/g, "$1-$2")
    .replace(/(\d)([a-z])/g, "$1-$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Upstream-confirmed cloaked / early-testing names (OpenRouter stealth models). A later reveal names
 * the developer but does not prove the tested checkpoint is the released product, so their scores are
 * kept for audit and never represent a public model; the public rules say anonymous test names are
 * excluded. Only names confirmed as such belong here.
 */
const CLOAKED = new Set([
  "ox-alpha", "horizon-alpha", "horizon-beta", "pony-alpha", "hunter-alpha", "healer-alpha", "optimus-alpha", "quasar-alpha",
  "sherlock-dash-alpha", "bert-nebulon-alpha", "sonoma-sky-alpha", "cypher-alpha", "aurora-alpha",
]);

/** Whether any of a row's names (source name, model slug or name) is an anonymous test identity. */
export function cloakedModel(...names: Array<string | null | undefined>): boolean {
  return names.some((n) => {
    if (!n) return false;
    if (/^stealth[/_-]/i.test(n.trim())) return true;
    const s = modelSlug(n).replace(/^(?:openrouter|stealth)-/, "").replace(/(?:-(?:max|free))+$/, "");
    return CLOAKED.has(s);
  });
}
