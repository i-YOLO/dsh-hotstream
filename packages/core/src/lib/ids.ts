import {createHash,randomUUID} from "node:crypto";
export const sha256=(text:string)=>createHash("sha256").update(text).digest("hex");
export const newArticleId=()=>randomUUID();
export function stableJson(value:unknown):string {if(Array.isArray(value))return `[${value.map(stableJson).join(",")}]`;if(value!==null&&typeof value==="object")return `{${Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>JSON.stringify(k)+":"+stableJson(v)).join(",")}}`;return JSON.stringify(value)??"null";}
