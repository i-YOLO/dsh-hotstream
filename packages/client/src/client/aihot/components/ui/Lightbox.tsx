/** Native focus and Escape handling over already-permitted image references. */
import {Button,Modal} from '@deepseek-ai/dsh-client-ui-primitives';
import {useEffect,useState} from 'react';
import {useNative} from '../../native/context.tsx';
import css from './Lightbox.module.css';
export interface LightboxImage {src:string;alt:string|null;srcSet?:string|undefined;width?:number|undefined;height?:number|undefined;}
export function Lightbox({images,index,onIndex,onClose}:{images:LightboxImage[];index:number|null;onIndex:(i:number)=>void;onClose:()=>void}) {
 const {text}=useNative(); const item=index===null?null:images[index];const [zoom,setZoom]=useState(false);useEffect(()=>setZoom(false),[index,item?.src]);
 return <Modal className={css.viewer!} contentClassName={css.content!} open={!!item} onClose={onClose} title={item?.alt??text('来源图片')} closeLabel={text('关闭')} onKeyDownCapture={event=>{
  if(index===null)return;
  if(event.key==='ArrowRight'){onIndex((index+1)%images.length);event.stopPropagation();}
  if(event.key==='ArrowLeft'){onIndex((index-1+images.length)%images.length);event.stopPropagation();}
 }}>
  {item&&<><div className={css.tools}><Button variant="ghost" onClick={()=>setZoom(!zoom)}>{text(zoom?'适应窗口':'原始大小')}</Button></div><div className={css.imageArea}><img src={item.src} alt={item.alt??''} style={{display:'block',margin:'0 auto',maxWidth:zoom?'none':'100%',maxHeight:zoom?'none':'calc(100vh - 180px)',objectFit:'contain'}}/></div></>}
  {index!==null&&images.length>1&&<div style={{display:'flex',gap:12,justifyContent:'center'}}>
   <Button onClick={()=>onIndex((index-1+images.length)%images.length)}>{text('上一张')}</Button>
   <span>{index+1} / {images.length}</span>
   <Button onClick={()=>onIndex((index+1)%images.length)}>{text('下一张')}</Button>
  </div>}
 </Modal>;
}
