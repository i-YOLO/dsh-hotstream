import type { GuardedFetchOptions,GuardedResponse } from '../network.ts';
export interface CollectorIo {
 fetch(url:string,options?:GuardedFetchOptions):Promise<GuardedResponse>;
 credential(scope:string,key:string):string|null;
 jina(url:string,options:{purpose:string;subject:string;cacheToleranceSeconds?:number|undefined;format?:string|undefined;perRead?:boolean|undefined}):Promise<{markdown:string;raw?:string}>;
}
