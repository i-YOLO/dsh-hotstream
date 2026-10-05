/** Pinned ArticleBody presentation with inert nodes and Host-owned media reads. */
import {createElement,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {renderBodyNodes} from '../../../body-view.ts';
import {richBody,type BodyNode} from '../../../rich-body.ts';
import {useNative} from '../../native/context.tsx';
import {Lightbox} from '../../components/ui/Lightbox.tsx';
import type {OutlineEntry} from '../../components/ui/OutlineSheet.tsx';

export function bodyOutline(nodes:BodyNode[]):OutlineEntry[]{
 const plain=(items:BodyNode[]):string=>items.map(n=>'text'in n?n.text:plain(n.children)).join('');
 return nodes.flatMap(n=>'text'in n?[]:[...n.id?[{id:n.id,text:plain(n.children).trim(),level:Number(n.tag.slice(1))}]:[],...bodyOutline(n.children)]).filter(n=>n.text);
}
function InlineImage({index}:{index:number}){
 const {state,face,text,scroll}=useNative(),item=state.detail;
 const [src,setSrc]=useState<string|null>(null),[busy,setBusy]=useState(false),[error,setError]=useState<string|null>(null),[open,setOpen]=useState(false);
 const control=useRef<AbortController>(),element=useRef<HTMLSpanElement>(null),started=useRef(false);
 const load=useCallback(async()=>{if(!item)return;control.current?.abort();const next=new AbortController();control.current=next;setBusy(true);setError(null);try{const result=await face.loadReadingImage(item.id,item.revision,index,next.signal);if(!next.signal.aborted)setSrc(result.dataUrl);}catch(reason){if(!next.signal.aborted)setError(reason instanceof Error?reason.message:String(reason));}finally{if(!next.signal.aborted)setBusy(false);}},[item?.id,item?.revision,index,face.loadReadingImage]);
 useEffect(()=>()=>control.current?.abort(),[]);
 useEffect(()=>{const el=element.current;if(!el||started.current)return;const begin=()=>{started.current=true;void load();};if(typeof IntersectionObserver==='undefined'){begin();return;}const observer=new IntersectionObserver(entries=>{if(entries.some(entry=>entry.isIntersecting)){observer.disconnect();begin();}},{root:scroll,rootMargin:'600px 0px'});observer.observe(el);return()=>observer.disconnect();},[load,scroll]);
 if(!item)return null;
 const alt=state.uiArticle?.images.find(m=>m.index===index)?.alt??text('来源图片');
 return <span ref={element} className="my-6 block" data-hotstream-body-image={index}>{src?<><button type="button" onClick={()=>setOpen(true)} className="block w-full cursor-zoom-in" aria-label={text('查看大图')}><img src={src} alt={alt} decoding="async" className="block w-full rounded-panel"/></button><Lightbox images={[{src,alt}]} index={open?0:null} onIndex={()=>{}} onClose={()=>setOpen(false)}/></>:error?<><button type="button" onClick={()=>void load()} className="flex w-full min-h-24 items-center justify-center rounded-panel border border-line bg-bg-sunk text-[13px] text-ink-3 hover:text-accent">{text('图片加载失败，点击重试')} · {index+1}</button><details className="mt-2 text-[12px] text-ink-4"><summary>{text('错误详情')}</summary><p>{error}</p></details></>:<span role="status" aria-label={text('正在加载图片')} className="flex w-full min-h-24 items-center justify-center rounded-panel border border-line bg-bg-sunk text-[13px] text-ink-4">{text(busy?'正在加载图片':'图片')} · {index+1}</span>}</span>;
}


export function ArticleBody({html,className='',base='https://hotstream.invalid',nodes:provided}:{html:string;className?:string|undefined;base?:string|undefined;nodes?:BodyNode[]}){const parsed=useMemo(()=>provided??richBody(html,base),[provided,html,base]);return <div className={'prose '+className}>{renderBodyNodes(parsed,index=><InlineImage index={index}/>)}</div>;}
