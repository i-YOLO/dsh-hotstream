import {useEffect,useState} from 'react';
import {Input,Button} from '@deepseek-ai/dsh-client-ui-primitives';
import {Sheet} from '../../components/ui/Sheet.tsx';
import {useNative} from '../../native/context.tsx';
export function openSearch(_query?:string,_filters?:unknown){document.querySelector('[data-hotstream-root="main"]')?.dispatchEvent(new Event('hotstream-search'));}
export function SearchOverlay(){const {root,face,text}=useNative(),[open,setOpen]=useState(false),[query,setQuery]=useState('');useEffect(()=>{if(!root)return;const show=()=>setOpen(true);root.addEventListener('hotstream-search',show);return()=>root.removeEventListener('hotstream-search',show);},[root]);return <Sheet open={open} onClose={()=>setOpen(false)} title={text('搜索')}><form onSubmit={e=>{e.preventDefault();face.navigateUrl('/all?q='+encodeURIComponent(query));setOpen(false);}}><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder={text('搜索标题、摘要和许可正文')}/><Button type="submit">{text('搜索')}</Button></form></Sheet>;}
