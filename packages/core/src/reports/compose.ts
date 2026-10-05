import {z} from "zod";
import {PLAIN_TERMS,ENTITIES} from "../industry/taxonomy.ts";
import {promptText} from "../editorial/prompts.ts";
import type {Candidate} from "./edition.ts";
import {beijingDate,addDays,isoWeekLabel} from "../lib/time.ts";
const INTRO_EVENTS=3;
const BRIEF = {
  weekly: { kindName: "周报", span: "一周", sentences: "三句话", chars: "160" },
  monthly: { kindName: "月报", span: "个月", sentences: "三到四句话", chars: "240" },
} as const;

export const PeriodSchema = z.object({
  overview: z.string().max(1500).catch(""),
  sections: z.record(z.string(), z.string().max(600)).catch({}),
});

/**
 * The writer's brief for a week or month: its events as chosen, ordered and grouped by rule. It writes
 * the overview and the introductions of the sections large enough for one, and decides nothing about
 * what the issue carries.
 */
export function periodPrompt(kind: "weekly" | "monthly", startDate: string, endDateInclusive: string, groups: Array<{ label: string; items: Candidate[] }>) {
  const list = groups.map((g) => [`【${g.label}】`, ...g.items.map((e) => `- ${e.title}｜${e.summary.slice(0, 140)}`)].join("\n")).join("\n");
  const introduced = groups.filter((g) => g.items.length >= INTRO_EVENTS).map((g) => g.label);
  return {
    system: promptText("report-period", {
      ...BRIEF[kind],
      sections: introduced.length ? promptText("report-period-sections", { columns: introduced.map((l) => `「${l}」`).join("") }) : "",
      sectionsExample: introduced.length ? `{"${introduced[0]}": "..."}` : "{}",
    }),
    user: `本期：${startDate} 至 ${endDateInclusive}\n${list}`,
  };
}

const COMPANY_NAMES = Object.values(ENTITIES).map((e) => [e.name, ...e.aliases, ...(e.otherNames ?? [])].map((n) => n.toLowerCase()));
/** Words a writer may use that name nothing in particular: the pack's plain terms and the site's name. */
const PLAIN = new Set([...PLAIN_TERMS, "dsh 热点"]);

/**
 * Whether written text names only what the listed items name: every capitalised or numbered Latin token
 * (Acme, Nova-2.5, X1), every figure of three or more digits or with a decimal point or percent (845,
 * 129.3, 40%) and every company of the vocabulary appears in the items' own words; a company may be named
 * in either language (谷歌 for Google).
 */
export function grounded(text: string, corpus: string): boolean {
  const known = corpus.toLowerCase();
  const companies = COMPANY_NAMES.filter((names) => names.some((n) => known.includes(n)));
  const named = (word: string) => PLAIN.has(word) || known.includes(word) || companies.some((names) => names.includes(word));
  const words = (text.match(/[A-Za-z][A-Za-z0-9.+-]*/g) ?? []).map((w) => w.replace(/[.+-]+$/, "")).filter((w) => /[A-Z0-9]/.test(w));
  const figures = (text.match(/\d+(?:\.\d+)?%?/g) ?? []).filter((f) => f.length >= 3 || /[.%]/.test(f));
  const lower = text.toLowerCase();
  const mentioned = COMPANY_NAMES.filter((names) => names.some((n) => /\p{Script=Han}/u.test(n) && lower.includes(n)));
  return words.every((w) => named(w.toLowerCase())) && figures.every((f) => known.includes(f)) && mentioned.every((names) => companies.includes(names));
}

/** The leading whole sentences of a text that fit in `max` characters; null when not even the first does. */
export function fitted(text: string, max: number): string | null {
  let out = "";
  for (const sentence of text.trim().match(/[^。！？]+(?:[。！？]+[」”’）]*|$)/g) ?? []) {
    if ([...out + sentence].length > max) break;
    out += sentence;
  }
  return out.trim() || null;
}

const bjParts = (now: Date) => {
  const iso = new Date(now.getTime() + 8 * 3600000).toISOString();
  return { hour: Number(iso.slice(11, 13)), minute: Number(iso.slice(14, 16)) };
};

/** The newest daily due by `now`: today's from 08:00 Beijing time, yesterday's before. */
export function dueDaily(now = new Date()): string {
  const today = beijingDate(now);
  return bjParts(now).hour >= 8 ? today : addDays(today, -1);
}

/** The newest weekly due by `now`: the last complete ISO week from Monday 10:00, the one before until then. */
export function dueWeekly(now = new Date()): string {
  const today = beijingDate(now);
  const dow = (new Date(`${today}T00:00:00Z`).getUTCDay() + 6) % 7;
  const due = dow > 0 || bjParts(now).hour >= 10;
  return isoWeekLabel(addDays(today, -dow - (due ? 7 : 14)));
}

/** The newest monthly due by `now`: the last complete month from the 1st 10:30, the one before until then. */
export function dueMonthly(now = new Date()): string {
  const [y, m, d] = beijingDate(now).split("-").map(Number) as [number, number, number];
  const { hour, minute } = bjParts(now);
  const due = d > 1 || hour > 10 || (hour === 10 && minute >= 30);
  const back = due ? 1 : 2;
  const month = (y * 12 + (m - 1) - back);
  return `${Math.floor(month / 12)}-${String((month % 12) + 1).padStart(2, "0")}`;
}
