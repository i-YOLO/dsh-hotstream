import {describe,it,expect} from 'vitest';
import {leaderboardRecords} from '../../packages/client/lib/types/client/leaderboard-records.js';
describe('leaderboard row boundary',()=>{
 it('rejects foreign, unnamed, unranked and duplicate rows without discarding zero scores or valid prices',()=>{
  const price={currency:'CNY',input:0,output:1};
  const records=[...Array.from({length:8},(_,n)=>({id:'monitor-'+n,title:'Monitor event'})),{slug:'',name:'',rank:0},{slug:'undefined',name:'Broken',rank:1},{slug:'no-name',rank:2},{slug:'bad-rank',name:'Bad',rank:0},{slug:'fraction',name:'Bad',rank:1.5},{slug:'model-a',name:'Model A',rank:1,score:0,price},{slug:'model-a',name:'Duplicate',rank:2},{modelId:'model-b',name:'Model B',rank:2,score:null}];
  expect(leaderboardRecords(records)).toEqual([{slug:'model-a',name:'Model A',rank:1,score:0,price},{modelId:'model-b',slug:'model-b',name:'Model B',rank:2,score:null}]);
  expect(records).toHaveLength(16);
 });
});
