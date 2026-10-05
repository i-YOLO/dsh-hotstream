/** List restoration belongs to the plugin scroll container, never the host window. */
import {useLayoutEffect,useRef} from 'react';
import {useNative} from '../native/context.tsx';
export interface ListSnapshot<T>{data:T;anchor:{key:string;top:number}|null;scrollY:number;}
const snapshots=new Map<string,ListSnapshot<unknown>>();
export const isReload=()=>false;
export function clearSnapshots(){snapshots.clear();}
export function saveSnapshot<T>(key:string,data:T,scroll:HTMLElement|null){snapshots.set(key,{data,scrollY:scroll?.scrollTop??0,anchor:null});if(snapshots.size>60)snapshots.delete(snapshots.keys().next().value!);}
export function readSnapshot<T>(key:string):ListSnapshot<T>|null{return snapshots.get(key) as ListSnapshot<T>??null;}
export function restoreAnchor(_anchor:ListSnapshot<unknown>['anchor'],scrollY:number,scroll:HTMLElement|null){scroll?.scrollTo({top:scrollY});}
export function useSaveOnLeave(key:string,data:()=>unknown){const current=useRef(data);current.current=data;const {scroll}=useNative();useLayoutEffect(()=>()=>saveSnapshot(key,current.current(),scroll),[key,scroll]);}
