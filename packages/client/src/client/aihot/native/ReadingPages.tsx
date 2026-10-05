import {ChronicleBand,ChronicleRail} from '../features/topic/Chronicle.tsx';
import type {TopicMilestone} from '../contracts/site.ts';
import {StoryFollowups} from '../features/item/StoryFollowups.tsx';
/** Native page composition of the pinned AIHOT presentation components. */
import {useMemo,useState} from 'react';
import {Button,Checkbox,Input} from '@deepseek-ai/dsh-client-ui-primitives';
import type {NewsProps} from '../../NewsPanel.tsx';
import {OperationsPanel} from '../../NewsPanel.tsx';
import {useNative} from './context.tsx';
import {Link} from './navigation.tsx';
import {timeline,feedItem,reportView,reportNavigation,heatPoints,hotEntry} from './adapters.ts';
import type {CategoryKey} from '../contracts/taxonomy.ts';
import {CategoryTabs,SearchField,FeedBar,ActiveFilters} from '../features/feed/Filters.tsx';
import {Timeline} from '../features/feed/Timeline.tsx';
import {DayList} from '../features/feed/DayList.tsx';
import {HotTopics} from '../features/feed/HotTopics.tsx';
import {FeedItem} from '../features/feed/FeedItem.tsx';
import {StarButton} from '../features/feed/parts.tsx';
import {ReportLayout} from '../features/report/ReportLayout.tsx';
import {ReportPaper,reportOutline} from '../features/report/ReportPaper.tsx';
import {KindSwitch,ReportArchive} from '../features/report/ReportNav.tsx';
import {ArticleBody} from '../features/item/ArticleBody.tsx';
import {HeatChart} from '../features/story/HeatChart.tsx';
import {Delta} from '../features/hot/Delta.tsx';
import {Sparkline} from '../features/hot/Sparkline.tsx';
import {Faces} from '../features/hot/Faces.tsx';
import {ArticleLayout,RailSection,EmptyState,ReadingLayout} from '../components/ui/Page.tsx';
import {Badge} from '../components/ui/Badge.tsx';
import {Sheet} from '../components/ui/Sheet.tsx';
import {SourceAvatar} from '../components/ui/SourceAvatar.tsx';
import {IconArrowLeft,IconArrowUpRight,IconChevronRight,IconList} from '../components/icons.tsx';
import {beijingDate} from '../contracts/time.ts';
import type {Json} from 'dsh-hotstream-contracts';
import layout from './Layout.module.css';
const object=(v:Json|undefined):Record<string,Json>=>v&&typeof v==='object'&&!Array.isArray(v)?v:{};
const stamp=(n:number)=>new Intl.DateTimeFormat(document.documentElement.lang||'zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(n);
export function FeedPage({props}:{props:NewsProps}){
 const {state,face,text}=useNative();const [candidates,setCandidates]=useState(false);const filters=useMemo(()=>({channel:state.channel,category:state.category as CategoryKey|null,tag:state.tag}),[state.channel,state.category,state.tag]);
 const data=useMemo(()=>timeline(state.uiFeed,filters,state.reading.hot),[state.uiFeed,filters,state.reading.hot]);const bookmarks=state.page==='bookmarks',base=state.topic?'/topics/'+state.topic:bookmarks?'/starred':state.page==='selected'?'/':'/all';
 return <div className="pb-6">{!bookmarks&&!state.topic&&<FeedBar base={state.page==='selected'?'/':'/all'} category={filters.category} channel={filters.channel}/>}<ActiveFilters base={base} category={filters.category} channel={filters.channel} tag={filters.tag}/><div className="hidden lg:block"><div className="flex items-center justify-between gap-4"><h1 className="text-[24px] font-semibold leading-[1.3] text-ink">{bookmarks?text('收藏'):state.topic?text('最新动态'):state.page==='selected'?text('精选'):text('全部动态')}</h1>{state.page==='all'&&!state.topic&&<button className="text-[12px] text-ink-4 hover:text-accent" onClick={()=>setCandidates(true)}>{props.t('candidateInbox')} · {state.candidates.total}</button>}</div><div className="mb-5 mt-4 flex items-center justify-between gap-4"><CategoryTabs base={base} category={filters.category} channel={filters.channel} layoutId="native-feed" className="min-w-0"/><SearchField keep={{category:filters.category}}/></div></div>
 {state.page==='selected'&&data.hot&&data.hot.length>0&&<HotTopics entries={data.hot}/>}
 {state.query&&<p className="mb-5 text-[13px] text-ink-3">{text('搜索')} “{state.query}” · {state.uiFeed.total}</p>}
 {state.uiFeed.cards.length===0?<EmptyState title={text('暂无符合条件的内容')}>{bookmarks?text('收藏的内容会出现在这里'):null}</EmptyState>:state.page==='selected'||state.topic?<Timeline key={state.routeKey} initial={data} filters={filters}/>:<>{state.uiFeed.cards.some(c=>c.item.visibility==='withdrawn')&&<div className="card p-4 mb-4 text-ink-4">{props.t('withdrawnBookmark')}</div>}<DayList items={data.cards.map(c=>c.item)}/></>}
 {state.page!=='selected'&&!state.topic&&state.uiFeed.total>30&&<div className="flex items-center justify-center gap-5 mt-8 text-[13px]"><Button disabled={!state.offset||state.busy} onClick={()=>face.pageOffset(Math.max(0,state.offset-30))}>{props.t('previousPage')}</Button><span>{state.offset+1}–{Math.min(state.offset+30,state.uiFeed.total)} / {state.uiFeed.total}</span><Button disabled={state.offset+30>=state.uiFeed.total||state.busy} onClick={()=>face.pageOffset(state.offset+30)}>{props.t('nextPage')}</Button></div>}
 <Sheet open={candidates} onClose={()=>setCandidates(false)} title={props.t('candidateInbox')}><OperationsPanel state={state} face={props} section="candidates"/></Sheet></div>;
}
export function ReportPage({props}:{props:NewsProps}){const {state,text}=useNative(),[tools,setTools]=useState(false),[archive,setArchive]=useState(false);const data=state.uiReport,view=useMemo(()=>data?reportView(data):null,[data]),index=useMemo(()=>data?reportNavigation(data):[],[data]);const kind=state.page as 'daily'|'weekly'|'monthly';if(!data)return <EmptyState title={text('加载中…')}/>;
 const historical=object(data.report?.content.generator).historical===true;
 return <><div className={layout.reportTools}><div className="flex items-center gap-2 text-ink-4">{historical&&<Badge tone="amber">{text('历史补编')}</Badge>}{data.report?.coverage==='incomplete'&&<span>{text('抓取覆盖不完整')}{object(data.report.content.coverage).dailyIssues!==undefined?' · '+object(data.report.content.coverage).dailyIssues+' / '+object(data.report.content.coverage).expectedDailyIssues:''}</span>}</div><button className="inline-flex items-center gap-1 text-ink-3 hover:text-accent" onClick={()=>setTools(true)}><IconList size={14}/>{text('报告操作')}</button></div><div className={layout.compactReportNav}><KindSwitch kind={kind} phone/><button onClick={()=>setArchive(true)} className="text-[13px] text-accent">往期 · {data.index.total}</button></div><Sheet open={archive} onClose={()=>setArchive(false)} title="往期"><div className="flex flex-col gap-2 p-4">{index.map(e=><Link key={e.key} to={'/'+kind+'/'+e.key} onClick={()=>setArchive(false)} className="rounded-control p-3 hover:bg-bg-sunk text-[13px]"><strong>{e.key}</strong> · {e.title}</Link>)}</div></Sheet><ReportLayout kind={kind} index={index} current={view?.key??null} today={beijingDate(new Date())} outline={view?reportOutline(view):[]}>{view?<ReportPaper report={view} index={index}/>:<EmptyState title={text('暂无有材料支撑的刊期')}/>}</ReportLayout><Sheet open={tools} onClose={()=>setTools(false)} title={text('报告操作')}><OperationsPanel state={state} face={props} section="report-tools"/></Sheet></>;
}
export {ArticlePage} from './ArticlePage.tsx';
export function HotPage(){const {state,text}=useNative();const entries=state.reading.hot.map((h,i)=>hotEntry(h,i+1));return <><div className="mb-6 flex items-center justify-between"><h1 className="text-[24px] font-semibold">{text('热点榜')}</h1><Link to="/events" className="text-[13px] text-ink-3">{text('全部事件')} →</Link></div>{entries.length===0?<EmptyState title={text('当前没有符合展示条件的热点')}/>:<div className="card overflow-hidden">{entries.map(e=><Link to={'/story/'+e.story.publicId} key={e.story.publicId} className="flex items-center gap-4 border-b border-line px-5 py-5 hover:bg-bg-sunk"><span className="mono text-[23px] font-bold text-hot">{e.rank}</span><div className="min-w-0 flex-1"><h2 className="text-[17px] font-semibold text-ink">{e.story.title}</h2><p className="mt-2 text-[12px] text-ink-4">{e.sourceNames.join(' · ')}</p></div><span className="text-[12px] text-ink-3">{e.heat.toFixed(1)}</span><Delta trend={e.trend} pct={e.trendPct}/></Link>)}</div>}</>;}
export function EventPage(){const {state,face,text}=useNative(),[reverse,setReverse]=useState(true),story=state.story;if(!story)return <><h1 className="text-[24px] font-semibold mb-6">{text('全部事件')}</h1>{state.reading.events.filter(s=>s.articles.length>0).map(s=><Link key={s.id} to={'/story/'+s.publicId} className="card card-hover block p-5 mb-3"><h2 className="text-[17px] font-semibold">{s.title}</h2><p className="mt-2 text-[14px] leading-relaxed text-ink-3">{s.digest??s.articles[0]?.summary}</p><p className="mt-3 text-[12px] text-ink-4">{s.articles.length} {text('来源报道')}</p></Link>)}</>;
 const articles=[...story.articles].sort((a,b)=>(reverse?-1:1)*(a.timelineAt-b.timelineAt));return <><button className="mb-5 text-[13px] text-ink-3" onClick={face.goBack}>← {text('返回')}</button><ReadingLayout aside={<div className="card p-5"><h3 className="text-[13px] font-semibold mb-3">{text('来源报道')}</h3><div className="flex flex-wrap gap-2">{[...new Set(articles.map(p=>p.sourceName))].map(name=><Badge key={name}>{name}</Badge>)}</div><div className="mt-6"><HeatChart points={heatPoints(story)}/></div></div>}><h1 className="text-[28px] font-bold leading-[1.35] tracking-tight">{story.title}</h1><p className="mt-5 text-[18px] leading-[1.8] text-ink-2">{story.digest??articles[0]?.summary}</p>{story.digestFallback&&<p className="mt-2 text-[12px] text-ink-4">{text('摘要')}</p>}<div className="mt-8 mb-4 flex justify-between"><h2 className="text-[18px] font-semibold">{text('事件进展')}</h2><button className="text-[12px] text-accent" onClick={()=>setReverse(v=>!v)}>{text(reverse?'最新在前':'最早在前')}</button></div>{articles.map(p=><div key={p.id} className="mb-3"><FeedItem item={feedItem(p)} at={new Date(p.timelineAt).toISOString()} showTags/></div>)}</ReadingLayout></>;
}
export function TopicsPage({props}:{props:NewsProps}){
 const {state,text}=useNative(),[kind,setKind]=useState('all'),topic=state.reading.topics.find(t=>t.id===state.topic),chronicle=state.chronicle;
 const kinds=Object.fromEntries(Object.entries(chronicle?.kinds??{}).map(([key,value])=>[key,{...value,label:text(value.label)}]));
 const milestones:TopicMilestone[]=(chronicle?.months.flatMap(m=>m.events)??[]).map(e=>({date:beijingDate(new Date(e.at)),kind:e.kind,title:e.label,headline:e.title,summary:null,href:e.href,external:false,major:false})).sort((a,b)=>a.date.localeCompare(b.date));
 if(state.topic)return <><Link to="/topics" className="text-[13px] text-ink-3">← {text('主题')}</Link><h1 className="mt-5 text-[28px] font-bold">{topic?.name??state.topic}</h1><p className="mt-3 text-[15px] text-ink-3">{topic?.definition}</p><div className="my-7">{milestones.length?topic?.kind==='company'?<ChronicleBand milestones={milestones} kinds={kinds}/>:<ChronicleRail months={chronicle!.months} kinds={kinds}/>:<p className="text-[13px] text-ink-4">{props.t('emptyChronicle')}</p>}</div><FeedPage props={props}/></>;
 return <><h1 className="text-[24px] font-semibold mb-5">{text('主题')}</h1><div className="flex gap-2 mb-6">{['all','company','field','genre'].map(k=><button key={k} aria-pressed={kind===k} className={'rounded-full px-4 py-2 text-[13px] '+(kind===k?'bg-accent-soft text-accent':'text-ink-3 bg-bg-sunk')} onClick={()=>setKind(k)}>{text(({all:'全部',company:'公司',field:'方向',genre:'内容形态'} as Record<string,string>)[k]!)}</button>)}</div><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{state.reading.topics.filter(t=>kind==='all'||(t.kind==='form'?'genre':t.kind)===kind).map(t=><Link key={t.id} to={'/topics/'+t.id} className="card card-hover p-5"><div className="flex items-center gap-3"><SourceAvatar name={t.name} size={34}/><h2 className="text-[17px] font-semibold">{t.name}</h2></div><p className="mt-3 text-[14px] leading-[1.75] text-ink-3">{t.definition}</p><span className="mt-4 inline-flex text-[12px] text-accent">{text('查看动态')} →</span></Link>)}</div></>;
}
