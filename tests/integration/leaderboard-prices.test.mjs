import {describe,it,expect} from 'vitest';
import {readFile} from 'node:fs/promises';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {mergePriceSeeds} from '../../scripts/generate-leaderboard-prices.mjs';
import {HotstreamDatabase} from '../../packages/storage-sqlite/lib/types/database.js';
import {defaultSettings} from '../../packages/contracts/lib/types/runtime.js';
import {directorySeed,priceSeed} from '../../packages/host/lib/types/leaderboard/seeds.js';
import {FX_URL,refreshPriceFx,previousPriceFx} from '../../packages/host/lib/types/leaderboard/pricing.js';
import {leaderboardPrice,priceCell} from '../../packages/client/lib/types/client/leaderboard-prices.js';
const now=Date.parse('2026-10-05T00:00:00Z');
const quote={asOf:'2026-10-02',rate:6.7046,sourceName:'欧洲央行',sourceUrl:FX_URL};
const source={id:'fixture',name:'Price fixture',kind:'external',config:{},tags:[],tier:'T1',ownerEntityId:null,signalGroupId:null,participationMode:'isolated',firstParty:false,intervalMinutes:60,siteFulltext:false,enabled:false,revision:1,cursor:{},health:'unknown',lastOkAt:null,nextDueAt:null,lastError:null};
async function fixture(fn){const db=new DatabaseSync(':memory:'),database=new HotstreamDatabase(db),settings=defaultSettings({provider:'mock',model:'mock'});settings.autoCollectEnabled=false;settings.features.leaderboard=true;const state=database.execute('initialize',{commandId:randomUUID(),settings,sources:[source],now});const store={execute:async(operation,input)=>database.execute(operation,input),close:async()=>{}};try{await fn({db,database,store,state});}finally{db.close();}}
const seed=(state,prices,priceDates,models=[])=>({epoch:state.epoch,models,aliases:{},calibrations:[],prices,priceDates,now});
const network=(body,status=200)=>({fetch:async(url,options)=>{expect(url).toBe(FX_URL);expect(options.headers).toEqual({accept:'application/json'});return {status,text:()=>JSON.stringify(body)};}});

describe('complete official prices and frozen conversion',()=>{
 it('merges every dated file, including the previously omitted base prices, with later observations winning',async()=>{
  const files=await Promise.all(['2026-09-26','2026-09-30'].map(async date=>({name:`lb-official-prices-${date}.json`,data:JSON.parse(await readFile(new URL(`../../industry/ai/price-seeds/lb-official-prices-${date}.json`,import.meta.url),'utf8'))})));
  const merged=mergePriceSeeds(files.reverse());expect(Object.keys(merged.prices)).toHaveLength(87);expect(merged.prices['claude-opus-5-5'].slice(0,4)).toEqual(['USD',4,20,.2]);expect(merged.priceDates['claude-opus-5-5']).toBe('2026-09-26');expect(merged.priceDates['gpt-6-1-sol']).toBe('2026-09-30');
  const corrected=mergePriceSeeds([...files,{name:'lb-official-prices-2026-10-01.json',data:{prices:{'claude-opus-5-5':['USD',5,25,.3,'https://example.com/fixture']}}}]);expect(corrected.prices['claude-opus-5-5'][1]).toBe(5);expect(corrected.priceDates['claude-opus-5-5']).toBe('2026-10-01');
 });
 it('backfills an existing model library, preserves its rankings and remains idempotent',()=>fixture(async({db,database,state})=>{
  const old=JSON.parse(await readFile(new URL('../../industry/ai/price-seeds/lb-official-prices-2026-09-30.json',import.meta.url),'utf8'));
  database.execute('lbSeed',seed(state,old.prices,undefined,directorySeed.models));
  database.execute('lbRun',{epoch:state.epoch,version:'fixture',boards:[{board:'overall',entries:[{slug:'claude-opus-5-5',rank:1,score:80}]}],snapshotIds:[],evidence:{},now});
  expect(database.execute('optionalData',{module:'leaderboard',board:'overall',limit:100,offset:0}).records[0].price).toBeNull();
  const before=db.prepare('SELECT * FROM lb_rankings').all(),modelCount=db.prepare('SELECT count(*) n FROM lb_models').get().n;
  database.execute('lbSeed',seed(state,priceSeed.prices,priceSeed.priceDates));const first=db.prepare('SELECT * FROM lb_prices ORDER BY model_id').all();database.execute('lbSeed',seed(state,priceSeed.prices,priceSeed.priceDates));
  expect(db.prepare('SELECT * FROM lb_prices ORDER BY model_id').all()).toEqual(first);expect(first).toHaveLength(87);expect(db.prepare('SELECT * FROM lb_rankings').all()).toEqual(before);expect(db.prepare('SELECT count(*) n FROM lb_models').get().n).toBe(modelCount);
  const data=database.execute('optionalData',{module:'leaderboard',board:'overall',limit:100,offset:0});expect(data.records[0].price).toMatchObject({currency:'USD',input:4,output:20,cached:.2,seedDate:'2026-09-26'});
 }));
 it('matches prices by canonical slug, updates older seeds and preserves manual/newer quotes',()=>fixture(async({db,database,state})=>{
  const models=[['manual','Manual','Fixture','fixture',null,null],['seeded','Seeded','Fixture','fixture',null,null]];
  const row=['USD',1,2,.1,'https://example.com/fixture'];database.execute('lbSeed',seed(state,{manual:row,seeded:row},{manual:'2026-09-30',seeded:'2026-09-30'},models));
  db.prepare("UPDATE lb_prices SET input_price=99,metadata=? WHERE model_id='manual'").run(JSON.stringify({basis:'manual',seedDate:'2026-10-01'}));
  db.prepare('INSERT INTO lb_models VALUES(?,?,?,?,?,?,?)').run('independent-id','canonical-slug','Canonical','Fixture','fixture',null,'{}');
  database.execute('lbSeed',seed(state,{manual:row,seeded:['USD',.5,1,.05,row[4]],'canonical-slug':row},{manual:'2026-10-02',seeded:'2026-09-26','canonical-slug':'2026-10-02'}));
  expect(db.prepare("SELECT input_price FROM lb_prices WHERE model_id='manual'").get().input_price).toBe(99);expect(db.prepare("SELECT input_price FROM lb_prices WHERE model_id='seeded'").get().input_price).toBe(1);expect(db.prepare("SELECT input_price FROM lb_prices WHERE model_id='independent-id'").get().input_price).toBe(1);
  database.execute('lbSeed',seed(state,{seeded:['USD',2,4,.2,row[4]]},{seeded:'2026-10-02'}));expect(db.prepare("SELECT input_price FROM lb_prices WHERE model_id='seeded'").get().input_price).toBe(2);
 }));
 it('allows an enabled leaderboard to refresh while news processing stays paused',()=>fixture(async({database,state})=>{
  database.execute('configure',{revision:state.revision,settings:{...state.settings,processing:{enabled:false}},now});
  for(const kind of ['leaderboard','writing','monitor'])database.execute('enqueue',{kind,subject:'fixture',key:'price-admission:'+kind,epoch:state.epoch,inputRevision:0,configRevision:state.revision+1,payload:{},priority:1,maxAttempts:1,dueAt:now});
  expect(database.execute('claim',{kinds:['leaderboard'],owner:'fixture',now,leaseMs:60000})?.kind).toBe('leaderboard');
  expect(database.execute('claim',{kinds:['writing','monitor'],owner:'fixture',now,leaseMs:60000})).toBeNull();
  expect(database.execute('receipts',{limit:10,offset:0})).toEqual([]);
 }));
 it('stores an attributed FX observation and freezes it into each published run',()=>fixture(async({db,database,store,state})=>{
  const fx=await refreshPriceFx(store,network({amount:1,base:'USD',date:quote.asOf,rates:{CNY:quote.rate}}),new AbortController().signal,null,now);expect(fx).toEqual(quote);
  database.execute('lbSeed',seed(state,{'fixture-model':['USD',4,20,.2,'https://example.com/fixture']},{'fixture-model':'2026-09-26'},[['fixture-model','Fixture','Fixture','fixture',null,null]]));
  const run={epoch:state.epoch,version:'fixture',boards:[{board:'overall',entries:[{slug:'fixture-model',rank:1,score:80}]}],snapshotIds:[],evidence:{fx},now};database.execute('lbRun',run);database.execute('lbRun',{...run,now:now+1,evidence:{fx:{...quote,rate:7}}});
  expect(db.prepare('SELECT summary FROM lb_runs ORDER BY generated_at').all().map(row=>JSON.parse(row.summary).fx.rate)).toEqual([6.7046,7]);
  const read=database.execute('optionalData',{module:'leaderboard',board:'overall',limit:100,offset:0});expect(read.state.summary.fx.rate).toBe(7);expect(leaderboardPrice(read.records[0].price,7).inputCny).toBe(28);
 }));
 for(const [name,body,status] of [['HTTP failure',{},503],['invalid number',{base:'USD',date:quote.asOf,rates:{CNY:0}},200],['wrong base',{base:'EUR',date:quote.asOf,rates:{CNY:7}},200],['future date',{base:'USD',date:'2026-10-06',rates:{CNY:7}},200],['older date',{base:'USD',date:'2026-09-30',rates:{CNY:7}},200]])it(`retains prior FX on ${name}`,()=>fixture(async({store,database})=>{expect(await refreshPriceFx(store,network(body,status),new AbortController().signal,quote,now)).toEqual(quote);const source=database.execute('optionalData',{module:'leaderboard',limit:10,offset:0}).sources.find(row=>row.source==='exchange-rate');expect(source).toMatchObject({status:'failed',usingPrevious:true,fx:quote});}));
 it('does not invent a rate when the first request fails and does not write after cancellation',()=>fixture(async({store,database})=>{
  expect(await refreshPriceFx(store,network({},503),new AbortController().signal,null,now)).toBeNull();const before=database.execute('optionalData',{module:'leaderboard',limit:10,offset:0}).sources;const control=new AbortController();control.abort();await expect(refreshPriceFx(store,network({},503),control.signal,quote,now)).rejects.toThrow();expect(database.execute('optionalData',{module:'leaderboard',limit:10,offset:0}).sources).toEqual(before);
 }));
 it('converts input/output/cache, preserves free prices, and distinguishes missing/unchecked/unconverted',()=>{
  const raw={currency:'USD',input:4,output:20,cached:.2,sourceUrl:'https://example.com/fixture',seedDate:'2026-09-26'};const price=leaderboardPrice(raw,quote.rate);expect(price.inputCny).toBeCloseTo(26.8184);expect(priceCell(price,'cached').label).toBe('¥1.34');expect(priceCell(price,'output').label).toBe('¥134.09');
  expect(priceCell(null,'input').kind).toBe('unverified');expect(priceCell(leaderboardPrice({...raw,input:0,output:0,cached:0},null),'input')).toMatchObject({kind:'value',label:'免费'});expect(priceCell(leaderboardPrice(raw,null),'input')).toMatchObject({kind:'unconverted',label:'待换算'});expect(priceCell(leaderboardPrice({...raw,currency:'CNY',input:0,output:0,cached:0},null),'input')).toMatchObject({kind:'value',label:'免费'});expect(priceCell(leaderboardPrice({...raw,cached:null},quote.rate),'cached').kind).toBe('missing');expect(priceCell(leaderboardPrice({...raw,input:null,output:null,cached:null,note:'No paid API'},quote.rate),'input').kind).toBe('no-api');
  expect(previousPriceFx({summary:{fx:quote}},[{source:'exchange-rate',fx:{...quote,asOf:'2026-10-03'}}]).asOf).toBe('2026-10-03');
 });
});
