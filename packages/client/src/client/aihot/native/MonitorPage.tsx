/** Source codex-reset Hero and Stats; data comes only from native saved-state reads. */
import {useState} from 'react';
import type {NewsProps} from '../../NewsPanel.tsx';
import {OperationsPanel} from '../../NewsPanel.tsx';
import {HealthBanner} from '../../admin/Integrations.tsx';
import {useNative} from './context.tsx';
import {Link} from './navigation.tsx';
import type {CodexResetEvent,CodexResetSitePage} from '../contracts/monitor.ts';
import {PostCard} from '../features/monitor/PostCard.tsx';
import {ResetCalendar} from '../features/monitor/ResetCalendar.tsx';
import {bjDate,bjTime,dayWord,durationText,stamp,typeName,windowText} from '../features/monitor/format.ts';
import {monthDay} from '../lib/format.ts';
import {useEntrance} from '../lib/hydration.ts';
import {IconChevronDown,IconChevronRight} from '../components/icons.tsx';
import {Sheet} from '../components/ui/Sheet.tsx';
import {EmptyState} from '../components/ui/Page.tsx';
function scopeText(e: CodexResetEvent) {
  const who = e.presentation?.audienceZh ?? e.presentation?.scopeLabel ?? "Tibo 未说明适用范围";
  return e.presentation?.productsZh ? `${who} · ${e.presentation.productsZh}` : who;
}

function Hero({ d, now }: { d: CodexResetSitePage; now: number }) {
  const e = d.current;
  const entrance = useEntrance();
  const shell = "cr-wash grid items-center gap-5 rounded-sheet border border-line-strong p-4 sm:p-6 lg:grid-cols-2 lg:gap-8 lg:p-8";
  if (!e) {
    const last = d.lastLanded;
    const lastDate = last?.occurredOn ? `${monthDay(last.occurredOn)}到账`
      : last?.confirmedAt ? `${monthDay(bjDate(last.confirmedAt))}确认` : "到账日期未确定";
    return (
      <section className={shell} style={{ "--tone": last ? "var(--ok-ink)" : "var(--ink-4)" } as React.CSSProperties}>
        <div className="min-w-0">
          <p className={`inline-flex items-center gap-2 text-[13px] font-medium ${last ? "text-ok-ink" : "text-ink-4"}`}>
            <span className="cr-dot" aria-hidden="true" />
            当前没有等待生效的重置
          </p>
          <h2 className="mt-3 text-[20px] font-[650] leading-[1.25] text-ink sm:text-[24px]">
            {last?.status === "confirmed"
              ? `上一次${last.type === "reset_credit" ? "重置卡发放" : "额度重置"}：${lastDate}`
              : last?.title ?? "暂无重置记录"}
          </h2>
          <p className="mt-2 text-[13px] leading-[1.75] text-ink-4">
            {last?.confirmedAt && !last.occurredOn && "确认帖日期不代表精确到账时间。"}
            {last?.confirmationBasis === "receipt_review"
              ? "已通过账户核验。尚未收录 Tibo 对本轮的完成确认，实际到账时间以账户显示为准。"
              : "不预测尚未宣布的下一次重置。Tibo 一旦宣布，这里会显示预计生效时间与原帖。"}
          </p>
          {d.outage && (
            <p className="mt-4 border-t border-line pt-4 text-[13px] leading-[1.75] text-ink-3">
              线索：{dayWord(bjDate(d.outage.publishedAt!), d.today)} {bjTime(d.outage.publishedAt!)} Tibo 确认 Codex 故障
              {d.outage.recoveredAt ? `，${bjTime(d.outage.recoveredAt)} 恢复` : ""}。故障不等于重置。
            </p>
          )}
        </div>
        {last?.posts[0] && (
          <div className="min-w-0">
            <PostCard
              avatar={d.authorAvatar}
              stage={`${last.posts[0].stage}原帖`}
              post={{ id: last.posts[0].id, publishedAt: last.posts[0].publishedAt, translation: last.posts[0].fullText ?? last.posts[0].text, original: last.posts[0].fullOriginalText ?? last.posts[0].originalText, context: last.posts[0].context, url: last.posts[0].url }}
            />
          </div>
        )}
      </section>
    );
  }
  const status = e.presentation?.status ?? "announced";
  const window = e.estimate ?? e.schedule;
  const through = window?.through ? Date.parse(window.through) : null;
  const from = window?.from ? Date.parse(window.from) : null;
  const credit = e.type === "reset_credit";
  const headline = status === "in_progress" ? (credit ? "重置卡正在发放" : "额度重置正在进行") : credit ? "等待重置卡到账" : "等待额度重置生效";
  let timing: string | null = null;
  if (status === "expired_unconfirmed" && through) timing = `已比预计晚 ${durationText(now - through)}，仍在等待确认`;
  else if (status === "announced" && from && now < from) timing = `距预计时段还有 ${durationText(from - now)}`;
  else if (status === "announced" && through && now < through) timing = "正处在预计时间段内";
  else if (status === "in_progress" && e.presentation?.reportedAt) timing = `Tibo ${stamp(e.presentation.reportedAt)} 表示正在进行`;
  const outage = d.outage && d.outage.resetEventId === e.id ? d.outage : null;
  const post = e.posts[0];
  return (
    <section
      className={`${shell} ${entrance ? "animate-fade-up" : ""}`}
      style={{ "--tone": status === "expired_unconfirmed" ? "var(--hot)" : "var(--amber-ink)" } as React.CSSProperties}
    >
      <div className="min-w-0">
        <p className={`inline-flex items-center gap-2 text-[13px] font-medium ${status === "expired_unconfirmed" ? "text-hot" : "text-amber-ink"}`}>
          <span className="cr-dot cr-dot-live" aria-hidden="true" />
          {typeName(e.type)} · Tibo 已宣布
        </p>
        <h2 className="mt-3 text-[20px] font-[650] leading-[1.25] text-ink sm:text-[24px]">{headline}</h2>
        {window?.from && (
          <p className="num mt-4 text-[24px] font-[650] leading-[1.3] tracking-[-0.01em] text-amber-ink lg:text-[clamp(24px,2.6vw,32px)]">
            预计 {windowText(window.from, window.through, d.today).replace("–", " – ")}
          </p>
        )}
        {(timing || e.estimate?.reason) && (
          <p className="mt-2 text-[13px] leading-[1.75] text-ink-4">
            {timing}
            {timing && e.estimate?.reason ? " · " : ""}
            {e.estimate?.reason}
          </p>
        )}
        <ul className="mt-4 grid gap-2 border-t border-line pt-4 text-[13px] leading-[1.75] text-ink-3">
          <li>适用范围：{scopeText(e)}</li>
          {outage?.publishedAt && (
            <li>
              起因：{dayWord(bjDate(outage.publishedAt), d.today)} {bjTime(outage.publishedAt)} Tibo 确认 Codex 故障{outage.recoveredAt ? `，${bjTime(outage.recoveredAt)} 恢复` : ""}
            </li>
          )}
        </ul>
        <p className="mt-4 text-[13px] leading-[1.75] text-ink-3">
          {credit ? "重置卡到账后由你自己决定何时使用。卡片余额以 Codex 内显示为准。" : "剩余额度可以放心用，生效后会恢复满额。以你 Codex 里显示的用量为准。"}
        </p>
      </div>
      {post && (
        <div className="min-w-0">
          <PostCard
            avatar={d.authorAvatar}
            stage={`${post.stage}原帖`}
            post={{ id: post.id, publishedAt: post.publishedAt, translation: post.fullText ?? post.text, original: post.fullOriginalText ?? post.originalText, context: post.context, url: post.url }}
          />
        </div>
      )}
    </section>
  );
}

function Stats({ stats,complete }: { stats: CodexResetSitePage["stats"];complete:boolean }) {
  const items = [
    { label: "近 90 天额度重置", value: complete ? `${stats.resets90} 次` : '—' },
    { label: "近 90 天发重置卡", value: complete ? `${stats.credits90} 次` : '—' },
    { label: "重置间隔中位数", value: !complete || stats.medianIntervalDays === null ? "—" : `${stats.medianIntervalDays} 天` },
    { label: "上次额度重置", value: stats.lastResetDate ? monthDay(stats.lastResetDate) : "—" },
  ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-card border border-line bg-line sm:grid-cols-4">
      {items.map((i) => (
        <div key={i.label} className="bg-surface px-4 py-3">
          <dt className="text-[12px] text-ink-4">{i.label}</dt>
          <dd className="num mt-1 text-[18px] font-semibold text-ink">{i.value}</dd>
        </div>
      ))}
    </dl>
  );
}
export function MonitorPage({props}:{props:NewsProps}){
 const {state,text}=useNative(),[manage,setManage]=useState(false),saved=state.uiMonitor,health=state.moduleHealth?.monitor;
 if(!saved)return <EmptyState title={text('加载中…')}/>;
 const data:CodexResetSitePage={...saved,schemaVersion:1,timezone:'Asia/Shanghai',checkedAt:saved.monitor?.lastVerifiedAt??null,count:saved.calendar.length,authorAvatar:null,confirmMinutes:[]};
 return <div className="mx-auto max-w-[var(--page-max-reading)]"><header className="mb-6 flex items-start justify-between gap-4"><div><h1 className="text-[28px] font-bold tracking-tight">{text('Tibo重置监控')}</h1><p className="mt-2 text-[13px] text-ink-3">{props.t('monitorInfo')}</p></div><button className="text-[13px] text-accent" onClick={()=>setManage(true)}>{text('筛选与管理')}</button></header><HealthBanner health={health} face={props} title={text('监控连接状态')} actions={<Link to='/settings' className='text-[13px] text-accent'>{text('配置凭据与单次测试')} →</Link>}/>{!saved.enabled&&<div className="well rounded-panel p-5 mb-6"><h2 className="text-[15px] font-semibold">{text('模块已关闭')}</h2><p className="mt-2 text-[13px] text-ink-3">{text('只读历史快照')}</p><Link to="/settings" className="mt-3 inline-block text-accent">{text('设置')} →</Link></div>}{health?.lastSuccessAt||saved.current||saved.lastLanded?<Hero d={data} now={saved.now}/>:<EmptyState title={text(health?.latestTest?.state==='succeeded'?'单次测试已完成':'尚未完成监控采集')}/>}<Stats stats={saved.stats} complete={health?.coverageComplete===true}/>{!health?.coverageComplete&&<p className='mt-3 text-[12px] text-ink-4'>{text('尚未覆盖完整 90 天，统计保持未知；已采集的原帖和识别结果可在单次测试中查看。')}</p>}{saved.monitor&&<p className="mt-4 text-[12px] text-ink-4">{text('最近核对')} · {stamp(saved.monitor.lastVerifiedAt)} · {text('待人工确认')} {saved.monitor.reviewCount}</p>}<ResetCalendar key={saved.selectedDate} selectedDate={saved.selectedDate} version={saved.version} marks={saved.calendar} events={saved.events} today={saved.today} historyFrom={saved.historyFrom} now={saved.now} avatar={null}/><Sheet open={manage} onClose={()=>setManage(false)} title={text('筛选与管理')}><OperationsPanel state={state} face={props} section="optional"/></Sheet></div>;
}
