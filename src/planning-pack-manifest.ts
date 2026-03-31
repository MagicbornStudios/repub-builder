/** Written to EPUB zip at build time; read at runtime for planning cockpit injection. */

export const PORTFOLIO_PLANNING_PACK_MANIFEST_FILENAME = 'portfolio-planning-pack.json';

/** Path inside the EPUB zip (forward slashes). */
export const PORTFOLIO_PLANNING_PACK_MANIFEST_ZIP_PATH = `META-INF/${PORTFOLIO_PLANNING_PACK_MANIFEST_FILENAME}`;

export type PlanningPackManifestSourceKind = 'md' | 'mdx' | 'raw';

export type PlanningPackManifestEntryV1 = {
  /** Zip-internal path, e.g. `OEBPS/plan-foo.xhtml`. */
  href: string;
  /** Virtual repo-style path for cockpit tree, e.g. `docs/books/planning/state.mdx`. */
  virtualPath: string;
  title: string;
  sourceKind: PlanningPackManifestSourceKind;
};

export type PortfolioPlanningPackManifestV1 = {
  planningPackManifestVersion: 1;
  entries: PlanningPackManifestEntryV1[];
};

export function isPortfolioPlanningPackManifestV1(v: unknown): v is PortfolioPlanningPackManifestV1 {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return o.planningPackManifestVersion === 1 && Array.isArray(o.entries);
}

export function parsePortfolioPlanningPackManifest(jsonText: string): PortfolioPlanningPackManifestV1 | null {
  try {
    const parsed: unknown = JSON.parse(jsonText);
    if (!isPortfolioPlanningPackManifestV1(parsed)) return null;
    for (const e of parsed.entries) {
      if (
        !e ||
        typeof e !== 'object' ||
        typeof (e as PlanningPackManifestEntryV1).href !== 'string' ||
        typeof (e as PlanningPackManifestEntryV1).virtualPath !== 'string' ||
        typeof (e as PlanningPackManifestEntryV1).title !== 'string' ||
        !isSourceKind((e as PlanningPackManifestEntryV1).sourceKind)
      ) {
        return null;
      }
    }
    return parsed;
  } catch {
    return null;
  }
}

function isSourceKind(v: unknown): v is PlanningPackManifestSourceKind {
  return v === 'md' || v === 'mdx' || v === 'raw';
}
