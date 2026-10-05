import {useNative,routeLocation} from '../../native/context.tsx';
import type {TabKey} from './nav.ts';
export interface Screen{tab?:TabKey|undefined;home?:TabKey|undefined;name?:string|undefined;toolbar?:boolean|undefined;}
export function useScreen():Screen{const {state}=useNative();const p=routeLocation(state).pathname;return {tab:p.startsWith('/hot')?'hot':/^\/(daily|weekly|monthly)/.test(p)?'daily':p.startsWith('/leaderboard')?'leaderboard':p.startsWith('/settings')?'me':'featured',toolbar:p.startsWith('/items/')};}
export function isPhone():boolean{return (document.querySelector<HTMLElement>('[data-hotstream-root="main"]')?.clientWidth??1280)<961;}
const tabs=new Map<string,TabKey>();
export function noteScreen(_name:string|undefined,key:string,tab:TabKey|undefined){if(tab)tabs.set(key,tab);if(tabs.size>60)tabs.delete(tabs.keys().next().value!);}
export const rememberedTab=(key:string)=>tabs.get(key);
