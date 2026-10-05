/** Stable reading indexes also cover bodies saved by an earlier extractor version. */
export function readingMedia(media:unknown[],html:string|null,base:string):{kind:string;url:string;alt:string|null}[]{
 const items:{kind:string;url:string;alt:string|null}[]=[];
 for(const raw of media)if(raw&&typeof raw==='object'&&!Array.isArray(raw)){const item=raw as Record<string,unknown>;if(typeof item.url==='string')items.push({kind:String(item.kind??'image'),url:item.url,alt:typeof item.alt==='string'?item.alt:null});}
 for(const match of (html??'').matchAll(/<img\b[^>]*\bsrc="([^"]+)"[^>]*>/gi)){try{const url=new URL(match[1]!.replace(/&amp;/g,'&'),base);if(['http:','https:'].includes(url.protocol))items.push({kind:'image',url:url.href,alt:/\balt="([^"]*)"/.exec(match[0])?.[1]??null});}catch{}}
 return [...new Map(items.map(item=>[item.url,item])).values()].slice(0,12);
}
