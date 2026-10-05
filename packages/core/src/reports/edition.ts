import {CATEGORIES} from "../industry/taxonomy.ts";
export const SECTION_OF: Record<string, string> = Object.fromEntries(CATEGORIES.map((c) => [c.key, c.section]));
export const SECTION_ORDER: readonly string[] = [...new Set(CATEGORIES.map((c) => c.section))];
/** An item without a category goes into the section of the industry category, else into the last one. */
const DEFAULT_SECTION = SECTION_OF.industry ?? SECTION_ORDER.at(-1)!;
export const sectionOf = (category: string | null) => SECTION_OF[category ?? ""] ?? DEFAULT_SECTION;

/** A daily's size: the entries readers get in full, and the one-line flashes after them. */
export const MAIN_ENTRIES = 12;
export const FLASH_ENTRIES = 10;
/** No source fills a daily: at most this many main entries lead with the same source. */
const PER_SOURCE = 2;
/** A follow-up of a covered event takes a full entry when this many sources carry its new facts. */
const FOLLOW_UP_SOURCES = 4;
/** The pack's `commentary` categories (how-tos, opinions): a follow-up of theirs is a flash, whoever wrote it. */
const COMMENTARY = new Set<string>(CATEGORIES.filter((c) => "commentary" in c).map((c) => c.key));
/** Earlier issues a daily remembers. */
const MEMORY_DAYS = 7;

export interface ReportEntry {
  itemId: string;
  factId: string | null;
  storyPublicId: string | null;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  sourceId: string;
  firstParty: boolean;
  role: string;
  score: number | null;
  publishedAt: string;
}

export interface Candidate extends ReportEntry {
  category: string | null;
  factKey: string;
}

/** Another development of an entry's event, or a report of the launch it was merged with. */
export type RelatedReport = Pick<ReportEntry, "itemId" | "factId" | "storyPublicId" | "title" | "sourceName" | "sourceUrl" | "sourceId">;

/** One event of a daily as stored. */
export interface DailyEntry extends ReportEntry {
  /** Sources that reported the event by the cutoff, this one included. */
  sources: number;
  related?: RelatedReport[];
  /** The latest earlier issue that covered this event. */
  followUp?: string;
  /** Carried for its official post and independent coverage, though none of its reports was selected. */
  fillIn?: true;
}

/** An entry while its issue is edited: what ranking and the editors need besides what is stored. */
export interface EditionEntry {
  entry: DailyEntry;
  category: string | null;
  tags: string[];
  storyId: string | null;
  /** For an entry without an event of its own (a roundup): the events it mentions. */
  mentions: Set<string>;
  sourceIds: Set<string>;
  /** Representative priority: 0 for T1, 1–2 for verified official accounts and people. */
  authority: number;
  importance: number;
  /** The earlier issue's entry for this event, when there was one. */
  previous: { key: string; title: string } | null;
}

function asRelated(e:ReportEntry):RelatedReport {const {itemId,factId,storyPublicId,title,sourceName,sourceUrl,sourceId}=e;return {itemId,factId,storyPublicId,title,sourceName,sourceUrl,sourceId};}
export function arrangeDaily(entries: EditionEntry[]): { main: EditionEntry[]; flashes: EditionEntry[]; stats: Record<string, number> } {
  const byStory = new Map(entries.filter((e) => e.storyId !== null).map((e) => [e.storyId!, e]));
  const under = new Map<EditionEntry, EditionEntry[]>();
  for (const e of entries) {
    const named = [...e.mentions].map((id) => byStory.get(id)).filter((h): h is EditionEntry => !!h);
    if (named.length === 0) continue;
    const host = named.reduce((a, b) => (b.importance > a.importance ? b : a));
    under.set(host, [...(under.get(host) ?? []), e]);
  }
  const folded = new Set([...under.values()].flat());
  const live = entries.filter((e) => !folded.has(e)).map((e): EditionEntry => {
    const roundups = under.get(e);
    if (!roundups) return e;
    const sourceIds = new Set([...e.sourceIds, ...roundups.flatMap((r) => [...r.sourceIds])]);
    const related = [...(e.entry.related ?? []), ...roundups.flatMap((r) => [asRelated(r.entry), ...(r.entry.related ?? [])])];
    return { ...e, sourceIds, entry: { ...e.entry, sources: sourceIds.size, related } };
  });
  const earned = (e: EditionEntry) => !e.previous || (e.authority < 3 && !COMMENTARY.has(e.category ?? "")) || e.entry.sources >= FOLLOW_UP_SOURCES;
  // A day of nothing but follow-ups still has entries in full.
  const full = live.some(earned) ? earned : () => true;
  const main: EditionEntry[] = [];
  const rest: EditionEntry[] = [];
  const perSource = new Map<string, number>();
  for (const e of live) {
    const n = perSource.get(e.entry.sourceId) ?? 0;
    if (main.length < MAIN_ENTRIES && n < PER_SOURCE && full(e)) {
      main.push(e);
      perSource.set(e.entry.sourceId, n + 1);
    } else rest.push(e);
  }
  const flashes = rest.slice(0, FLASH_ENTRIES);
  return { main, flashes, stats: { roundupsFolded: folded.size, followUpsAsFlashes: live.filter((e) => !full(e)).length, left: rest.length - flashes.length } };
}
