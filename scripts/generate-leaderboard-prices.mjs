/** Merge every dated, vendored official-price file; later observations win. */
import {readFile,readdir,writeFile} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {fileURLToPath} from 'node:url';

export function mergePriceSeeds(files){
 const prices=Object.create(null),priceDates=Object.create(null);
 for(const {name,data} of [...files].sort((a,b)=>a.name.localeCompare(b.name))){
  const match=/^lb-official-prices-(\d{4}-\d{2}-\d{2})\.json$/.exec(name);
  if(!match||new Date(match[1]+'T00:00:00Z').toISOString().slice(0,10)!==match[1])throw new Error('Invalid price file date: '+name);
  for(const [slug,price] of Object.entries(data.prices??{})){
   if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||!Array.isArray(price)||price.length<5||price.length>6||!['USD','CNY'].includes(price[0])||price.slice(1,4).some(value=>value!==null&&(!Number.isFinite(value)||value<0)))throw new Error('Invalid price entry: '+slug);
   const url=new URL(price[4]);if(url.protocol!=='https:'||url.username||url.password||price[5]!==undefined&&typeof price[5]!=='string')throw new Error('Invalid price source: '+slug);
   prices[slug]=price;priceDates[slug]=match[1];
  }
 }
 return {prices,priceDates};
}

export async function generateLeaderboardPrices(root){
 const directory=join(root,'industry/ai/price-seeds');
 const names=(await readdir(directory)).filter(name=>/^lb-official-prices-\d{4}-\d{2}-\d{2}\.json$/.test(name));
 if(!names.length)throw new Error('No dated official-price files');
 const merged=mergePriceSeeds(await Promise.all(names.map(async name=>({name,data:JSON.parse(await readFile(join(directory,name),'utf8'))}))));
 const json=JSON.stringify({_note:'Generated from all dated AIHOT official-price files at cc66cceb. Later files replace earlier entries; prices are per million tokens at the vendor tier documented in each source file.',...merged},null,2)+'\n';
 const destination=join(root,'industry/ai/leaderboard-prices.json');if(await readFile(destination,'utf8')!==json)await writeFile(destination,json);
 const host=join(root,'packages/host/src/leaderboard/seeds.ts'),source=await readFile(host,'utf8');
 const replacement='export const priceSeed:{prices:Json;priceDates:Record<string,string>}='+JSON.stringify(merged)+';';
 if(!/^export const priceSeed:[^\n]+$/m.test(source))throw new Error('Missing generated price export');
 const updated=source.replace(/^export const priceSeed:[^\n]+$/m,replacement);if(updated!==source)await writeFile(host,updated);
 return {files:names.length,prices:Object.keys(merged.prices).length};
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))console.log(await generateLeaderboardPrices(resolve(import.meta.dirname,'..')));
