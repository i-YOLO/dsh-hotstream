interface Publisher {
  id: string;
  kind: string;
  config: Record<string, unknown>;
  participation_mode?: string;
}

function ownershipUrl(raw: string): URL | null {
  try {
    const url = new URL(raw);
    return /^https?:$/.test(url.protocol) && !url.username && !url.password ? url : null;
  } catch { return null; }
}

/** Explicit ownership scopes also work for shared hosts (e.g. one repository or publication). */
export function publisherOwnsUrl(source: Publisher, rawUrl: string): boolean {
  // Identity normalization folds www/http and strips tracking parameters; that is too broad for
  // ownership. Match the configured origin and path boundary without broadening either.
  const url = ownershipUrl(rawUrl);
  if (!url) return false;
  let scopes: string[];
  if (Array.isArray(source.config.publisherUrlPrefixes)) {
    scopes = source.config.publisherUrlPrefixes.filter((v): v is string => typeof v === "string");
  } else if (source.kind === "web_list" && typeof source.config.url === "string") {
    // A site's configured listing owns only its own path, not all links it points to.
    scopes = [source.config.url];
  } else {
    // Feed/API hosts are often distributors or shared platforms. Their address alone is not proof
    // of ownership; a source with a different article path needs an explicit publisher scope.
    return false;
  }
  return scopes.some((raw) => {
    const scope = ownershipUrl(raw);
    if (!scope) return false;
    if (scope.origin !== url.origin || scope.search || scope.hash) return false;
    const prefix = scope.pathname.replace(/\/$/, "");
    return !prefix || url.pathname === prefix || url.pathname.startsWith(`${prefix}/`);
  });
}
