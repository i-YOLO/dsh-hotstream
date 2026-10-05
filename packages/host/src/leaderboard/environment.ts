/** Fetchers execute only under one runtime-owned environment, never through ambient networking. */
import {AsyncLocalStorage} from 'node:async_hooks';
import type {GuardedFetchOptions,GuardedResponse} from '../network.ts';
interface Environment {fetch(url:string,options?:GuardedFetchOptions):Promise<GuardedResponse>;credentials:Record<string,string>;}
const environments=new AsyncLocalStorage<Environment>();
export function inLeaderboardEnvironment<T>(environment:Environment,work:()=>Promise<T>):Promise<T>{return environments.run(environment,work);}
export function guardedFetch(url:string,options?:GuardedFetchOptions):Promise<GuardedResponse>{const environment=environments.getStore();if(!environment)throw new Error('Leaderboard fetch outside its owned runtime');return environment.fetch(url,options);}
export function credential(_scope:string,key:string):string|null{return environments.getStore()?.credentials[key]??null;}
export async function fetch(url:string,options:{headers:Record<string,string>;signal:AbortSignal}):Promise<{ok:boolean;status:number;json():Promise<unknown>}>{const result=await guardedFetch(url,{headers:options.headers,signal:options.signal,redirectPolicy:'same-origin'});return {ok:result.status>=200&&result.status<300,status:result.status,json:async()=>JSON.parse(result.text())};}
