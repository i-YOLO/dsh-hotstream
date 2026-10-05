import type {Json} from 'dsh-hotstream-contracts';
import type {LbPrice} from './aihot/contracts/leaderboard.ts';
import {listPrice,noOfficialApi,yuan} from './aihot/features/leaderboard/format.ts';

const number=(value:Json|undefined):number|null=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
export function leaderboardPrice(value:Json|undefined,fx:number|null):LbPrice|null {
 if(!value||typeof value!=='object'||Array.isArray(value)||!['USD','CNY'].includes(String(value.currency)))return null;
 const currency=value.currency as 'USD'|'CNY',input=number(value.input),output=number(value.output),cached=number(value.cached);
 const convert=(amount:number|null)=>amount===null?null:amount===0?0:currency==='CNY'?amount:fx!==null&&Number.isFinite(fx)&&fx>0?amount*fx:null;
 return {currency,input,output,cached,inputCny:convert(input),outputCny:convert(output),cachedCny:convert(cached),officialUrl:typeof value.sourceUrl==='string'?value.sourceUrl:null,note:typeof value.note==='string'?value.note:null,verifiedOn:typeof value.seedDate==='string'?value.seedDate:null};
}

export function priceCell(price:LbPrice|null,field:'cached'|'input'|'output'):{kind:'value'|'missing'|'unverified'|'no-api'|'unconverted';label:string;title:string|undefined}{
 if(!price)return {kind:'unverified',label:'待核验',title:undefined};
 if(noOfficialApi(price))return {kind:'no-api',label:'无官方价',title:price.note??undefined};
 const converted=price[`${field}Cny`],raw=price[field];
 if(converted!==null)return {kind:'value',label:yuan(converted),title:price.verifiedOn?`价格核验日期：${price.verifiedOn}`:undefined};
 if(raw!==null&&price.currency==='USD')return {kind:'unconverted',label:'待换算',title:`美元原价 ${listPrice(raw,'USD')} / 百万 Token；人民币汇率暂不可用`};
 return {kind:'missing',label:'—',title:field==='cached'?'该型号未提供缓存命中价格':undefined};
}
