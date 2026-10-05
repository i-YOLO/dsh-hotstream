/** Cache lives only in the current module activation; no web storage namespace is used. */
export function sessionCache<T>(_key:string,_ttl:number){const values=new Map<string,T>();return {peek:(key:string)=>values.get(key),read:(key:string)=>values.get(key),set:(key:string,value:T)=>{values.set(key,value);},delete:(key:string)=>values.delete(key),clear:()=>values.clear()};}
