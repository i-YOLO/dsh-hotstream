// Retained AIHOT pure digest schema and input builder; persistence lives in the plugin worker.
import {z} from "zod";
import {beijingDate,beijingTime} from "../lib/time.ts";
import {promptText,promptVersion} from "../editorial/prompts.ts";
export const DIGEST_PROMPT_VERSION = promptVersion("story-digest");

export const DIGEST_SYSTEM = promptText("story-digest");

export const DigestSchema = z.object({
  title: z.string().max(120).catch(""),
  digest: z.string().min(10).max(2000),
});

export interface DigestReport {
  id: string;
  title: string;
  summary: string | null;
  source_name: string;
  first_party: boolean;
  at: Date;
  fact_id: string;
  fact_subject: string | null;
  fact_action: string | null;
  fact_object: string | null;
  fact_conditions: string | null;
  evidence: string | null;
  structured_fact: unknown;
}

/** Conditions stay next to their object and source quote; no ownership is inferred from subjects tags. */
export function digestFactEvidence(report: DigestReport) {
  const fact = report.structured_fact && typeof report.structured_fact === "object" ? report.structured_fact as Record<string, unknown> : {};
  const conditions = Array.isArray(fact.conditions) ? fact.conditions.flatMap((condition) => {
    if (!condition || typeof condition !== "object") return [];
    const value = condition as Record<string, unknown>;
    return typeof value.text === "string" && typeof value.quote === "string" ? [{ text: value.text, quote: value.quote }] : [];
  }) : [];
  return { subject: report.fact_subject, action: report.fact_action, object: report.fact_object,
    conditions: report.fact_conditions, evidence: report.evidence, extractedConditions: conditions,
    extractedEvidence: typeof fact.evidence === "string" ? fact.evidence : null };
}

/** Production and the real-sample evaluation use this same input builder. */
export function buildStoryDigestInput(story: { title: string; digest: string | null }, reports: DigestReport[], opts: { corrected: boolean; knownArticleIds?: string[] }) {
  const known = new Set(opts.knownArticleIds ?? []);
  const lines = reports.slice(-40).map((r) => `${opts.corrected || known.has(r.id) ? "" : "【新】"}报道 ${r.id}｜事实 ${r.fact_id}｜${beijingDate(r.at)} ${beijingTime(r.at)}｜${r.source_name}${r.first_party ? "（一手）" : ""}｜${r.title}｜${r.summary ?? ""}\n事实条件与来源证据：${JSON.stringify(digestFactEvidence(r))}`);
  return opts.corrected
    ? `事件当前标题：${story.title}\n\n报道内容或事实证据经过更正。请只依据下面这些报道的当前内容重写综述，不要沿用以前版本的说法。\n报道（按时间）：\n${lines.join("\n")}`
    : `事件当前标题：${story.title}\n${story.digest ? `上一版综述：${story.digest}\n` : ""}\n报道（按时间，标【新】的是上一版之后的新报道）：\n${lines.join("\n")}`;
}
