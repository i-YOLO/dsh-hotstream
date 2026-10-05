/** AIHOT sheet content hosted by DSH's public modal/focus layer. */
import type {ReactNode,CSSProperties} from 'react';
import {Modal} from '@deepseek-ai/dsh-client-ui-primitives';
import {useNative} from '../../native/context.tsx';
import {sourceClasses} from '../../native/style.ts';
export function Sheet({open,onClose,title,children,label,centered=false}:{open:boolean;onClose:()=>void;title?:ReactNode;children:ReactNode;label?:string|undefined;centered?:boolean|undefined}){const {scheme,text}=useNative();return <Modal open={open} onClose={onClose} title={typeof title==='string'?text(title):label?text(label):text('详情')} closeLabel={text('关闭')}><div className={sourceClasses.root} data-hotstream-root="portal" data-theme={scheme} style={{height:'auto','--hs-height':'80vh',maxHeight:'70vh',overflow:'auto'} as CSSProperties}>{typeof title!=='string'&&title}{children}</div></Modal>;}
