import * as cheerio from 'cheerio';import type {AnyNode,Element} from 'domhandler';import {z} from 'zod';
import {sanitizeBody,textToHtml} from '../content/sanitize.ts';import {collapseWhitespace} from '../lib/text.ts';import {promptText,promptVersion} from './prompts.ts';
export interface TranslationInput {articleId:string;revision:number;channel:string;language:string|null;body_html:string|null;body_text:string|null;x_post:{text?:string}|null;title:string;selected:boolean;body_mode:string;visibility:string;}
export interface TranslationOutput {articleId:string;revision?:number;status:'translated'|'partial'|'skipped';segments?:number;reason?:string;html?:string;text?:string;complete?:boolean;}
interface Shielded {
  html: string;
  tokens: string[];
  links: Array<Record<string, string>>;
}
export function createTranslationEngine(translateBatch:(articleId:string,revision:number,index:number,parts:string[],system:string,attemptTag?:string)=>Promise<string[]|null>,signal?:AbortSignal){
// Full-text Chinese translations: made by the worker after an item
// is selected, for sources whose full text may be shown on the site; a page read never translates.
// Bodies are translated block by block (paragraphs, headings, list items, captions, table cells) so the
// sanitised structure stays as it is. Inside a block, images and inline code never reach the model
// (placeholders) and links keep only their text and an id; a block whose answer loses or repeats any of
// them is asked once more, then kept in the original. Each batch is a receipt, so a re-run reuses
// answers already paid for. A translation missing any block is stored as incomplete, never as whole.
// The post a selected X post quotes is translated too (once per quoted post, shared by every quote).

const TRANSLATE_PROMPT_VERSION = promptVersion("translate-body", "translate-post");
const BATCH_CHARS = 3500;
/** Longer bodies get their first part translated and are marked incomplete. */
const MAX_CHARS = 60_000;
/** X posts shorter than this carry their meaning in the Chinese title and summary. */
const X_MIN_CHARS = 60;

const BLOCK = new Set(["p", "h2", "h3", "h4", "h5", "li", "blockquote", "figcaption", "td", "th", "dt", "dd", "caption"]);
const CONTAINER = /^(p|h[2-5]|li|blockquote|figcaption|td|th|dt|dd|caption|ul|ol|table|pre|figure|div)$/;

const Output = z.object({ t: z.array(z.string()) });

class TranslationInterruptedError extends Error {}

const SYSTEM_BODY = promptText("translate-body");

const SYSTEM_POST = promptText("translate-post");

interface TranslateResult {
  articleId: string;
  status: "translated" | "partial" | "skipped";
  /** The article revision this result is about: the one read and translated, not a later one. */
  revision?: number;
  segments?: number;
  reason?: string;
}

const isChinese = (language: string | null, sample: string) => language === "zh" || (/[一-鿿]/.test(sample.slice(0, 400)) && language !== "en");

/** Leaf text blocks of a sanitised body, in document order, skipping code. */
function segmentsOf($: cheerio.CheerioAPI): Element[] {
  const out: Element[] = [];
  const visit = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type !== "tag") continue;
      const el = node as Element;
      if (el.name === "pre" || el.name === "code") continue;
      const hasBlockChild = el.children.some((c) => c.type === "tag" && CONTAINER.test((c as Element).name));
      if (BLOCK.has(el.name) && !hasBlockChild) {
        if (/[A-Za-zÀ-ɏЀ-ӿ぀-ヿ]/.test($(el).text())) out.push(el);
        continue;
      }
      visit(el.children);
    }
  };
  visit($.root().children().toArray());
  return out;
}

/** Translates batches, halving a batch once when the answer does not line up with the input. */
async function translateAll(articleId: string, revision: number, parts: string[], system: string, attemptTag?: string): Promise<Array<string | null>> {
  const out: Array<string | null> = new Array(parts.length).fill(null);
  let start = 0;
  let index = 0;
  while (start < parts.length) {
    let end = start;
    let chars = 0;
    while (end < parts.length && (end === start || chars + parts[end]!.length <= BATCH_CHARS)) chars += parts[end++]!.length;
    const batch = parts.slice(start, end);
    let done = await translateBatch(articleId, revision, index++, batch, system, attemptTag);
    if (!done && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      const left = await translateBatch(articleId, revision, index++, batch.slice(0, mid), system, attemptTag);
      const right = await translateBatch(articleId, revision, index++, batch.slice(mid), system, attemptTag);
      done = left && right ? [...left, ...right] : null;
    }
    if (done) done.forEach((t, i) => (out[start + i] = t));
    start = end;
  }
  return out;
}

/** A block as the model sees it: media and inline code as ⟦n⟧, links as <a id="Ln"> with their attributes kept here. */


function shield(inner: string): Shielded {
  const $ = cheerio.load(inner, null, false);
  const tokens: string[] = [];
  for (const node of $("picture, video, img, code").toArray()) {
    if ($(node).parents("picture, video, code").length) continue;
    tokens.push($.html(node));
    $(node).replaceWith(`⟦${tokens.length - 1}⟧`);
  }
  const links: Shielded["links"] = [];
  $("a").each((i, a) => {
    links.push({ ...(a as Element).attribs });
    (a as Element).attribs = { id: `L${i}` };
  });
  return { html: $.html(), tokens, links };
}

/** The translated block with its media, code and links put back; null when the answer lost or repeated any. */
function unshield(translated: string, s: Shielded): string | null {
  const counts = new Map<number, number>();
  for (const m of translated.matchAll(/⟦(\d+)⟧/g)) counts.set(Number(m[1]), (counts.get(Number(m[1])) ?? 0) + 1);
  if (counts.size !== s.tokens.length || s.tokens.some((_t, i) => counts.get(i) !== 1)) return null;
  const $ = cheerio.load(translated, null, false);
  const seen = new Set<number>();
  let intact = true;
  $("a").each((_i, a) => {
    const n = /^L(\d+)$/.exec((a as Element).attribs.id ?? "")?.[1];
    const attribs = n === undefined ? undefined : s.links[Number(n)];
    if (!attribs || seen.has(Number(n))) intact = false;
    else {
      seen.add(Number(n));
      (a as Element).attribs = attribs;
    }
  });
  if (!intact || seen.size !== s.links.length) return null;
  return $.html().replace(/⟦(\d+)⟧/g, (_m, n: string) => s.tokens[Number(n)]!);
}

async function translateArticle(row:TranslationInput):Promise<TranslationOutput> {
  const articleId=row.articleId;
  const result = (r: Omit<TranslationOutput,"articleId"|"revision">): TranslationOutput => ({ articleId, revision: row.revision, ...r });
  if (!row.selected || row.visibility !== "public" || row.body_mode !== "full") return result({ status: "skipped", reason: "not a selected full-text item" });

  if (row.channel === "x") {
    const text = String(row.x_post?.text ?? row.body_text ?? "").trim();
    const meaningful = collapseWhitespace(text.replace(/https?:\/\/\S+/g, ""));
    if (isChinese(row.language, text)) return result({ status: "skipped", reason: "already Chinese" });
    if (meaningful.length < X_MIN_CHARS) return result({ status: "skipped", reason: "short post" });
    const [t] = await translateAll(articleId, row.revision, [text], SYSTEM_POST);
    if (!t) return result({ status: "skipped", reason: "translation did not line up" });
    return result({status:"translated",segments:1,html:textToHtml(t),text:t,complete:true});
  }

  if (!row.body_html || isChinese(row.language, row.body_text ?? "")) return result({ status: "skipped", reason: "no foreign-language body" });
  const $ = cheerio.load(row.body_html, null, false);
  const blocks = segmentsOf($);
  if (!blocks.length) return result({ status: "skipped", reason: "no translatable text" });
  // Beyond the cap, only the leading blocks are translated; the rest keep the original text.
  let budget = MAX_CHARS;
  const chosen: Element[] = [];
  for (const el of blocks) {
    const html = $(el).html() ?? "";
    if (html.length > budget) break;
    budget -= html.length;
    chosen.push(el);
  }
  const shielded = chosen.map((el) => shield($(el).html() ?? ""));
  const restore = (answers: Array<string | null>) => answers.map((t, i) => (t === null ? null : unshield(t, shielded[i]!)));
  const translations = restore(await translateAll(articleId, row.revision, shielded.map((b) => b.html), SYSTEM_BODY));
  // Blocks whose answer dropped a link or an image are asked once more, on their own receipt.
  const missing = translations.flatMap((t, i) => (t === null ? [i] : []));
  if (missing.length) {
    const again = await translateAll(articleId, row.revision, missing.map((i) => shielded[i]!.html), SYSTEM_BODY, "retry");
    missing.forEach((i, k) => (translations[i] = again[k] ? unshield(again[k]!, shielded[i]!) : null));
  }
  let done = 0;
  chosen.forEach((el, i) => {
    const t = translations[i];
    if (t) {
      $(el).html(t);
      done += 1;
    }
  });
  if (!done) return result({ status: "skipped", reason: "no batch translated" });
  const complete = done === blocks.length;
  const html = sanitizeBody($.html());
  return result({status:complete?"translated":"partial",segments:done,html,text:cheerio.load(html,null,false).root().text().trim(),complete});
}


return {translateArticle,shield,unshield};
}
