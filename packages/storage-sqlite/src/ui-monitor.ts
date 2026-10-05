/** Pure AIHOT cc66cceb monitor presentation rules, with SQLite loading below. No scans or model calls. */
import type {DatabaseSync,SQLInputValue,SQLOutputValue} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {addDays,beijingDate} from 'dsh-hotstream-core/lib/time';
import type {CodexCalendarMark,CodexResetMonitor,CodexResetPageData,CodexResetsSnapshot,UiMonitorRequest,UiMonitorResult,RuntimeState} from 'dsh-hotstream-contracts';
const MONITOR_PAGE_URL='/codex-reset',LIKELY_COMPLETED_AFTER_MS=6*3600_000,OUTAGE_VISIBLE_MS=18*3600_000,OFFSET_MS=8*3600_000;
type CalendarMark=CodexCalendarMark;
const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
const stableJson=(value:unknown):string=>JSON.stringify(value);
export function bjIso(d: Date | string | null | undefined): string | null {
  if (!d) return null;
  const t = new Date(d).getTime();
  if (!Number.isFinite(t)) return null;
  return `${new Date(t + OFFSET_MS).toISOString().slice(0, 23)}+08:00`;
}

interface EventRow {
  id: string;
  type: "direct_reset" | "reset_credit";
  status: "announced" | "confirmed";
  title: string;
  scope: string;
  label: string;
  display_label: string;
  schedule: { precision: string; from: string; through: string; label: string } | null;
  estimate: { from: string; through: string; basis: string; label: string; reason: string } | null;
  presentation: { scopeKnown: boolean; scopeLabel: string | null; kindExplicit: boolean; timeInferred: boolean; audienceZh: string | null; productsZh: string | null; reportedAt: string | null; inProgress?: boolean } | null;
  confirmed_at: Date | null;
  occurred_on: Date | null;
  confirmation_basis: "source_post" | "receipt_review" | null;
  created_at: Date;
  updated_at: Date;
}

interface PostRow {
  id: string;
  published_at: Date;
  text: string;
  translation: string | null;
  url: string;
  context: Array<{ id: string; author: string; relation: "reply" | "quote"; text: string | null; originalText: string; url: string }>;
  activity: { kind: "event_update" | "related"; action: string | null; statusChanged: boolean; eventIds: string[] } | null;
  outage: { kind: string; recoveredAt: string | null; resetEventId: string | null } | null;
}

interface LinkRow {
  event_id: string;
  post_id: string;
  stage: string;
  text: string;
  original_text: string;
}

export type PresentationStatus = "announced" | "in_progress" | "confirmed" | "expired_unconfirmed" | "likely_completed";

export function presentationStatus(e: Pick<EventRow, "status" | "estimate" | "schedule" | "presentation">, now: number): PresentationStatus {
  if (e.status === "confirmed") return "confirmed";
  const window = e.estimate ?? e.schedule;
  const through = window ? Date.parse(window.through) : null;
  if (through !== null && now >= through) return now < through + LIKELY_COMPLETED_AFTER_MS ? "expired_unconfirmed" : "likely_completed";
  return e.presentation?.inProgress ? "in_progress" : "announced";
}

export function eventTitle(type: EventRow["type"], status: EventRow["status"], shown: PresentationStatus, kindExplicit: boolean, basis: EventRow["confirmation_basis"] = null): string {
  const credit = type === "reset_credit";
  if (status === "confirmed") {
    if (credit) return "重置卡已发放";
    if (basis === "receipt_review") return "额度重置已核实到账";
    return kindExplicit ? "Codex 额度重置已完成" : "Tibo 确认重置";
  }
  if (shown === "likely_completed") return credit ? "重置卡应已发放" : "额度应已重置";
  if (shown === "in_progress") return credit ? "重置卡正在发放" : "额度重置进行中";
  return credit ? "Tibo 预告将发放重置卡" : "Tibo 预告将重置额度";
}

function eventJson(e: EventRow, links: LinkRow[], posts: Map<string, PostRow>, now: number) {
  const status = presentationStatus(e, now);
  const p = e.presentation;
  const presentation = p
    ? {
        ...(p.reportedAt ? { reportedAt: bjIso(p.reportedAt) } : {}),
        status,
        scopeKnown: p.scopeKnown,
        scopeLabel: p.scopeLabel,
        kindExplicit: p.kindExplicit,
        timeInferred: p.timeInferred,
        audienceZh: p.audienceZh,
        productsZh: p.productsZh,
      }
    : null;
  const eventPosts = links
    .map((l) => ({ l, post: posts.get(l.post_id) }))
    .filter((x): x is { l: LinkRow; post: PostRow } => !!x.post)
    .sort((a, b) => b.post.published_at.getTime() - a.post.published_at.getTime() || (a.l.post_id < b.l.post_id ? 1 : -1))
    .map(({ l, post }) => ({
      id: post.id,
      publishedAt: bjIso(post.published_at),
      stage: l.stage,
      text: l.text,
      originalText: l.original_text,
      fullText: post.translation,
      fullOriginalText: post.text,
      context: contextJson(post.context),
      url: post.url,
    }));
  const schedule = e.schedule && { precision: e.schedule.precision, from: bjIso(e.schedule.from), through: bjIso(e.schedule.through), label: e.schedule.label };
  const estimate = e.estimate && { from: bjIso(e.estimate.from), through: bjIso(e.estimate.through), basis: e.estimate.basis, label: e.estimate.label, reason: e.estimate.reason };
  return {
    id: e.id,
    type: e.type,
    label: e.label,
    displayLabel: e.display_label,
    presentation,
    estimate: e.status === "confirmed" ? null : estimate,
    status: e.status,
    title: eventTitle(e.type, e.status, status, p?.kindExplicit ?? true, e.confirmation_basis),
    scope: e.scope,
    createdAt: bjIso(e.created_at),
    updatedAt: bjIso(e.updated_at),
    confirmedAt: bjIso(e.confirmed_at),
    occurredOn: e.occurred_on ? e.occurred_on.toISOString().slice(0, 10) : null,
    confirmationBasis: e.confirmation_basis,
    schedule,
    posts: eventPosts,
    url: MONITOR_PAGE_URL,
  };
}

function contextJson(context: PostRow["context"]) {
  return context.map((c) => ({ id: c.id, author: c.author, relation: c.relation, text: c.text, originalText: c.originalText, url: c.url }));
}

function monitorJson(state: Map<string, any>, counts: { pending: number; review: number }, now: number) {
  const w = state.get("watermarks") as { lastAttemptAt?: string; lastCollectedAt?: string; lastVerifiedAt?: string } | undefined;
  if (!w) return null;
  const verified = w.lastVerifiedAt ? Date.parse(w.lastVerifiedAt) : NaN;
  // Held windows: stretches of posts a long gap left unread, which later scans read (collectPosts).
  const held = state.get("cursor")?.backlog?.length ?? 0;
  const age = now - verified;
  // Unresolved work outranks a fresh check: a held window or a post waiting for a person needs
  // attention, a post not yet processed means the picture is delayed.
  const status: CodexResetMonitor["status"] = !Number.isFinite(verified) ? "unknown"
    : held > 0 || Number(counts.review) > 0 || age > 3 * 3600_000 ? "attention"
      : Number(counts.pending) > 0 || age > 40 * 60_000 ? "delayed" : "healthy";
  return {
    status,
    lastAttemptAt: bjIso(w.lastAttemptAt),
    lastCollectedAt: bjIso(w.lastCollectedAt),
    lastVerifiedAt: bjIso(w.lastVerifiedAt),
    heldWindowCount: held,
    pendingCount: Number(counts.pending),
    reviewCount: Number(counts.review),
  };
}

function versionHash(events: Array<[string, string | null, PresentationStatus | undefined]>, outage: string | null, monitor: CodexResetMonitor | null): string {
  const health = monitor && [monitor.status, monitor.pendingCount, monitor.reviewCount, monitor.heldWindowCount];
  return sha256(stableJson({ events, outage, health })).slice(0, 16);
}

function monitorPage(snap:CodexResetsSnapshot,now:number):CodexResetPageData {

  const today = snap.today;
  const marks: CalendarMark[] = snap.events.map((e) => {
    const status = e.presentation?.status ?? (e.status === "confirmed" ? "confirmed" : "announced");
    const state: CalendarMark["state"] = status === "confirmed" ? "confirmed" : status === "likely_completed" ? "likely" : "pending";
    const unclear = e.presentation ? !e.presentation.kindExplicit : false;
    const label = state === "pending" ? "待生效" : e.type === "reset_credit" ? "发重置卡" : unclear ? "重置确认" : "额度重置";
    const day = e.occurredOn ?? (e.confirmedAt ? e.confirmedAt.slice(0, 10) : (e.estimate ?? e.schedule)?.from?.slice(0, 10) ?? e.createdAt!.slice(0, 10));
    return { date: day, eventId: e.id, type: e.type, state, label };
  });
  const since = addDays(today, -90);
  const landed = marks.filter((m) => m.state !== "pending");
  const inWindow = landed.filter((m) => m.date > since && m.date <= today);
  const resetDays = [...new Set(landed.filter((m) => m.type === "direct_reset" && m.state === "confirmed" && m.date <= today).map((m) => m.date))].sort();
  // The interval is between rounds, not between calendar days: each reset at the moment it landed
  // (confirmation, verified day at noon, or the estimate's start when only likely), two resets on one
  // day are two rounds, and the median keeps one decimal.
  const landedAt = (e: (typeof snap.events)[number]) => {
    const st = e.presentation?.status ?? (e.status === "confirmed" ? "confirmed" : "announced");
    if (st === "confirmed") return Date.parse(e.occurredOn ? `${e.occurredOn}T12:00:00+08:00` : (e.confirmedAt ?? e.createdAt!));
    const from = (e.estimate ?? e.schedule)?.from;
    return st === "likely_completed" && from ? Date.parse(from) : null;
  };
  const sinceMs = now - 90 * 86400_000;
  const rounds = snap.events.filter((e) => e.type === "direct_reset").map(landedAt).filter((t): t is number => t !== null && t <= now && t >= sinceMs).sort((a, b) => a - b);
  const intervals = rounds.slice(1).map((t, i) => (t - rounds[i]!) / 86400_000).sort((a, b) => a - b);
  const mid = Math.floor(intervals.length / 2);
  const median = intervals.length ? Math.round((intervals.length % 2 ? intervals[mid]! : (intervals[mid - 1]! + intervals[mid]!) / 2) * 10) / 10 : null;
  const pending = snap.events.find((e) => e.presentation && ["announced", "in_progress", "expired_unconfirmed"].includes(e.presentation.status));
  // Tibo's current X avatar, from his latest collected post.

  const lastLanded = snap.events.filter((e) => landedAt(e) !== null)
    .sort((a, b) => landedAt(b)! - landedAt(a)!)[0];
  return {
    ...snap,
    current: pending ?? null,
    lastLanded: lastLanded ?? null,
    authorAvatar: null,
    stats: {
      resets90: inWindow.filter((m) => m.type === "direct_reset").length,
      credits90: inWindow.filter((m) => m.type === "reset_credit").length,
      medianIntervalDays: median,
      lastResetDate: resetDays.at(-1) ?? null,
    },
    calendar: marks,
    confirmMinutes: snap.events
      .filter((e) => e.type === "direct_reset" && e.confirmedAt && e.confirmationBasis === "source_post")
      .map((e) => Number(e.confirmedAt!.slice(11, 13)) * 60 + Number(e.confirmedAt!.slice(14, 16))),
    version: versionHash(snap.events.map((e) => [e.id, e.updatedAt, e.presentation?.status]), snap.outage ? `${snap.outage.postId}${snap.outage.recoveredAt ? `:${new Date(snap.outage.recoveredAt).toISOString()}` : ""}` : null, snap.monitor),
  };
}

/** One synchronous Worker read gives the calendar and selected-day posts one committed view. */
export function readUiMonitor(db:DatabaseSync,state:RuntimeState,request:UiMonitorRequest,now=Date.now()):UiMonitorResult {
 type Row=Record<string,SQLOutputValue>;
 const rows=(sql:string,...args:SQLInputValue[])=>db.prepare(sql).all(...args);
 const decode=(value:unknown):Record<string,any>=>value?JSON.parse(String(value)):{};
 const events:EventRow[]=rows('SELECT * FROM monitor_events WHERE withdrawn=0 ORDER BY updated_at DESC,id').map(r=>{const d=decode(r.document),presentation=d.presentation??null;return {id:String(r.id),type:r.type as EventRow['type'],status:r.status as EventRow['status'],title:String(r.title),scope:String(r.scope),label:String(d.label??d.schedule?.label??''),display_label:String(d.displayLabel??d.schedule?.label??''),schedule:d.schedule??null,estimate:d.estimate??null,presentation:presentation?{scopeKnown:!!presentation.scopeKnown,scopeLabel:presentation.scopeLabel??null,kindExplicit:presentation.kindExplicit!==false,timeInferred:!!presentation.timeInferred,audienceZh:presentation.audienceZh??null,productsZh:presentation.productsZh??null,reportedAt:presentation.reportedAt??null,inProgress:!!presentation.inProgress}:null,confirmed_at:r.confirmed_at===null?null:new Date(Number(r.confirmed_at)),occurred_on:d.occurredOn?new Date(d.occurredOn):null,confirmation_basis:d.confirmationBasis??(Number(d.manualVersion)>0&&r.status==='confirmed'?'receipt_review':r.status==='confirmed'?'source_post':null),created_at:new Date(Number(r.created_at)),updated_at:new Date(Number(r.updated_at))};});
 const stateMap=new Map(rows('SELECT key,value FROM monitor_state').map(r=>[String(r.key),decode(r.value)]));
 const counts=rows("SELECT sum(processed_at IS NULL) pending,sum(json_extract(recognition,'$.needsReview')=1 AND coalesce(json_extract(recognition,'$.reviewed'),0)!=1 AND NOT EXISTS(SELECT 1 FROM monitor_reviews r WHERE r.post_id=monitor_posts.id)) review FROM monitor_posts")[0]!;
 const monitor=monitorJson(stateMap,{pending:Number(counts.pending??0),review:Number(counts.review??0)},now);
 const outageRow=rows('SELECT * FROM monitor_posts WHERE outage IS NOT NULL AND published_at>=? ORDER BY published_at DESC,id LIMIT 1',now-OUTAGE_VISIBLE_MS)[0];
 const out=outageRow?decode(outageRow.outage):null;
 const outage=outageRow&&out?{postId:String(outageRow.id),publishedAt:bjIso(new Date(Number(outageRow.published_at))),text:outageRow.translation===null?null:String(outageRow.translation),originalText:String(outageRow.text),recoveredAt:bjIso(out.recoveredAt),resetEventId:out.resetEventId??null,url:String(outageRow.url)}:null;
 const snap:CodexResetsSnapshot={schemaVersion:1,timezone:'Asia/Shanghai',today:beijingDate(now),checkedAt:monitor?.lastVerifiedAt??null,historyFrom:bjIso(stateMap.get('history')?.from??'2026-06-12T00:00:00+08:00'),count:events.length,events:events.map(e=>eventJson(e,[],new Map(),now)),activities:[],monitor,outage};
 const page=monitorPage(snap,now),date=request.date??page.today;
 const selectedIds=page.calendar.filter(m=>m.date===date).map(m=>m.eventId),wanted=[...new Set([...selectedIds,...page.current?[page.current.id]:[],...page.lastLanded?[page.lastLanded.id]:[]])];
 const posts=new Map<string,PostRow>(),links:LinkRow[]=[];
 if(wanted.length){const linked=rows(`SELECT ep.event_id,ep.stage,ep.document link_document,p.* FROM monitor_event_posts ep JOIN monitor_posts p ON p.id=ep.post_id WHERE ep.event_id IN(${wanted.map(()=>'?').join(',')}) ORDER BY p.published_at DESC,p.id`,...wanted);for(const r of linked){const link=decode(r.link_document);links.push({event_id:String(r.event_id),post_id:String(r.id),stage:String(r.stage),text:String(link.text??r.translation??r.text),original_text:String(link.originalText??r.text)});const raw=JSON.parse(String(r.context??'[]')) as Record<string,unknown>[];posts.set(String(r.id),{id:String(r.id),published_at:new Date(Number(r.published_at)),text:String(r.text),translation:r.translation===null?null:String(r.translation),url:String(r.url),context:raw.map(c=>({id:String(c.id),author:String(c.author??c.handle??''),relation:c.relation==='quote'?'quote':'reply',text:typeof c.originalText==='string'&&typeof c.text==='string'?c.text:typeof c.textZh==='string'?c.textZh:null,originalText:String(c.originalText??c.text??''),url:String(c.url??'')})),activity:null,outage:null});}}
 const material=new Map(events.filter(e=>wanted.includes(e.id)).map(e=>[e.id,eventJson(e,links.filter(l=>l.event_id===e.id),posts,now)]));
 return {enabled:!!state.settings?.features.codexResetMonitor,now,today:page.today,selectedDate:date,historyFrom:page.historyFrom,version:page.version,calendar:page.calendar,events:selectedIds.flatMap(id=>material.get(id)?[material.get(id)!]:[]),current:page.current?material.get(page.current.id)??page.current:null,lastLanded:page.lastLanded?material.get(page.lastLanded.id)??page.lastLanded:null,monitor:page.monitor,outage:page.outage,stats:page.stats};
}
