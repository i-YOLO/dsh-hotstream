/** AIHOT routes/item.tsx reading layout; native query, media, locale and discussion boundaries. */
import {useEffect,useMemo,useRef,useState} from 'react';
import {Button} from '@deepseek-ai/dsh-client-ui-primitives';
import type {NewsProps} from '../../NewsPanel.tsx';
import {richBody} from '../../rich-body.ts';
import {useNative} from './context.tsx';
import {Link} from './navigation.tsx';
import {feedItem} from './adapters.ts';
import {ArticleBody,bodyOutline} from '../features/item/ArticleBody.tsx';
import {StoryFollowups} from '../features/item/StoryFollowups.tsx';
import {StarButton} from '../features/feed/parts.tsx';
import {SelectedBadge} from '../components/ui/Badge.tsx';
import {ScoreLabel} from '../components/ui/Score.tsx';
import {ArticleLayout,RailSection,EmptyState} from '../components/ui/Page.tsx';
import {OutlineSheet,scrollToAnchor} from '../components/ui/OutlineSheet.tsx';
import {IconArrowLeft,IconExternal,IconList} from '../components/icons.tsx';

function ReadingProgress(){
 const {scroll}=useNative(),ref=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!scroll)return;let frame=0;const update=()=>{frame=0;const max=scroll.scrollHeight-scroll.clientHeight;if(ref.current)ref.current.style.transform=`scaleX(${max>0?Math.min(1,Math.max(0,scroll.scrollTop/max)):0})`;};const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};const observer=new ResizeObserver(schedule);observer.observe(scroll);scroll.addEventListener('scroll',schedule,{passive:true});update();return()=>{cancelAnimationFrame(frame);observer.disconnect();scroll.removeEventListener('scroll',schedule);};},[scroll]);
 return <div ref={ref} aria-hidden="true" className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left scale-x-0 bg-accent transition-transform duration-150 ease-out"/>;
}
export function ArticlePage({props}:{props:NewsProps}){
 const {state,face,text,root,scroll}=useNative(),item=state.detail;
 const [language,setLanguage]=useState<'zh'|'original'>('zh'),[outlineOpen,setOutlineOpen]=useState(false);
 const translated=language==='zh'&&!!(item?.translatedHtml||item?.translatedBody),html=(translated?item?.translatedHtml:item?.bodyHtml)??'',body=(translated?item?.translatedBody:item?.body)??'';
 const nodes=useMemo(()=>richBody(html,item?.url??'https://hotstream.invalid',{images:new Map((state.uiArticle?.images??[]).map(m=>[m.url,m.index])),headingPrefix:'hs-article-'+item?.id+'-'+language}),[html,item?.id,item?.url,language,state.uiArticle?.images]);
 const outline=useMemo(()=>bodyOutline(nodes),[nodes]);
 useEffect(()=>{if(item&&item.readAt===null)face.markRead(item.id);},[item?.id,item?.readAt,face.markRead]);
 if(!item)return <EmptyState title={text(state.busy?'加载中…':'暂无符合条件的内容')}/>;
 const summary=feedItem(item),hasBody=!!(body||html),hasTranslation=!!(item.translatedHtml||item.translatedBody),summaryOnly=item.visibility==='summary-only';
 const published=new Date(item.publishedAt??item.discoveredAt).toISOString(),stamp=new Intl.DateTimeFormat(root?.lang||'zh-CN',{timeZone:'Asia/Shanghai',dateStyle:'medium',timeStyle:'short'}).format(new Date(published));
 const tags=item.tags.filter(t=>!t.startsWith('entity:'));
 const back=<button type="button" onClick={face.goBack} className="-ml-1.5 inline-flex h-8 items-center gap-1.5 rounded-full px-1.5 text-[13px] text-ink-3 transition-colors hover:text-ink"><IconArrowLeft size={16}/>{text('返回')}</button>;
 const facts=<RailSection title={text('来源')}><div className="text-[14px] font-semibold leading-snug text-ink">{item.sourceName}</div><div className="mt-1 text-[12.5px] leading-relaxed text-ink-3">{new URL(item.url).hostname.replace(/^www\./,'')}</div><div className="mt-3 text-[12px] text-ink-4">{text('发布时间')}</div><time dateTime={published} className="mono mt-0.5 block text-[12.5px] text-ink-2">{stamp}</time></RailSection>;
 const outlineNav=outline.length>=3&&<RailSection title={text('本文目录')}><nav aria-label={text('本文目录')}><ol className="-ml-px space-y-0.5 border-l border-line">{outline.map(o=><li key={o.id}><a href={'#'+o.id} onClick={e=>{e.preventDefault();scrollToAnchor(o.id,root,scroll);}} className={'-ml-px block border-l border-transparent py-1 text-[12.5px] leading-snug text-ink-3 transition-colors hover:border-accent hover:text-ink '+(o.level>2?'pl-5':'pl-3')}>{o.text}</a></li>)}</ol></nav></RailSection>;
 const actions=<div className="flex items-center gap-1"><a href={item.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 flex-1 items-center justify-center gap-1.5 rounded-full border border-line-strong bg-surface px-3.5 text-[12.5px] font-medium text-ink-2 transition-colors hover:border-ink-4 hover:text-ink">{text('打开原文')}<IconExternal size={13}/></a><StarButton item={summary} size={32}/></div>;
 const bodyStatus=state.uiArticle?.bodyState==='source-disabled'?'此信源的全文展示已关闭，当前仅显示摘要。':summaryOnly?'这篇内容仅提供摘要与原文入口。':'正文尚未就绪，完整内容请阅读原文。';
 return <div className="mx-auto max-w-[var(--page-max-reading)] pb-8">{hasBody&&<ReadingProgress/>}<div className="mb-4 lg:hidden">{back}</div><ArticleLayout left={<>{back}{facts}{outlineNav}</>} right={<>{actions}<RailSection title={text('推荐理由')}><div className="mb-3 flex items-center gap-2">{item.selected&&<SelectedBadge/>}<ScoreLabel score={item.score}/></div><p className="text-[13.5px] leading-[1.8] text-ink-2">{item.reason}</p></RailSection>{tags.length>0&&<RailSection title={text('标签')}><div className="flex flex-wrap gap-1.5">{tags.slice(0,8).map(tag=><Link key={tag} to={'/all?tag='+encodeURIComponent(tag)} className="chip">#{tag}</Link>)}</div></RailSection>}<RailSection title={text('更多')}><Button onClick={()=>props.prepareDiscussion(item)} disabled={state.busy}>{text('和 AI 讨论')}</Button>{item.storyId&&<div className="mt-4"><Link to={'/story/'+item.storyId} className="text-accent">{text('相关事件')}</Link><StoryFollowups story={{publicId:item.storyId,title:text('相关事件')}} currentId={item.id}/></div>}</RailSection><div className="space-y-8 2xl:hidden">{outlineNav}</div></>}>
 <div className="sticky top-0 z-20 -mx-2 hidden bg-bg/95 px-2 py-1.5 backdrop-blur lg:block 2xl:hidden">{back}</div>
 <article className="pb-6 pt-3 lg:pt-2 2xl:pt-1"><div className="mb-3 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[13px] text-ink-3 2xl:hidden"><span className="font-semibold text-ink-2">{item.sourceName}</span><span>·</span><time dateTime={published} className="mono">{stamp}</time></div>
 <h1 data-page-title="" className="text-[26px] font-bold leading-[1.38] tracking-[-0.01em] text-ink lg:text-[32px] lg:leading-[1.34] xl:text-[36px] xl:leading-[1.3]">{item.title}</h1>{item.originalTitle!==item.title&&<p className="mt-2.5 text-[14px] leading-relaxed text-ink-4">{item.originalTitle}</p>}
 <section className="mt-7 xl:mt-8"><div className="mb-2 text-[12px] font-semibold text-accent">{text(summaryOnly?'摘要':'AI 导读')}</div><p className="text-[18px] leading-[1.7] text-ink xl:text-[20px] xl:leading-[1.7]">{item.summary}</p></section>
 {hasBody?<section className="mt-9 border-t border-line pt-4 xl:mt-10"><div className="mb-6 flex items-center justify-between gap-3"><span className="text-[12px] text-ink-4">{text(translated?'正文 · AI 翻译':'正文 · 原文')}</span>{hasTranslation&&<div role="group" aria-label={text('正文语言')} className="inline-flex rounded-full border border-line bg-bg-sunk p-0.5">{(['zh','original'] as const).map(lang=><button key={lang} onClick={()=>setLanguage(lang)} aria-pressed={language===lang} className={'rounded-full px-3 py-1 text-[12px] '+(language===lang?'bg-surface text-ink shadow-sm':'text-ink-3')}>{text(lang==='zh'?'中文':'原文')}</button>)}</div>}</div>{translated&&item.translationComplete===false&&<p className="mb-4 text-[13px] text-amber-ink">{text('译文尚未完成')}</p>}{html?<ArticleBody key={item.id+':'+item.revision} html={html} base={item.url} nodes={nodes}/>:<p className="prose whitespace-pre-wrap">{body}</p>}</section>:<p className="mt-7 rounded-control bg-bg-sunk px-4 py-3 text-[13.5px] leading-relaxed text-ink-3">{text(bodyStatus)} <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-accent">{text('阅读原文')}</a></p>}
 <div className="mt-8 flex flex-wrap gap-4 lg:hidden">{actions}<Button onClick={()=>props.prepareDiscussion(item)}>{text('和 AI 讨论')}</Button>{outline.length>=3&&<button className="inline-flex items-center gap-1 text-[13px] text-accent" onClick={()=>setOutlineOpen(true)}><IconList size={16}/>{text('本文目录')}</button>}</div></article>
 </ArticleLayout><OutlineSheet open={outlineOpen} onClose={()=>setOutlineOpen(false)} outline={outline} title={text('本文目录')}/></div>;
}
