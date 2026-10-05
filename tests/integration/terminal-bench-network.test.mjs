import {describe,it,expect} from 'vitest';
import {leaderboardTransport} from '../../packages/host/lib/types/leaderboard/network.js';
import {inLeaderboardEnvironment} from '../../packages/host/lib/types/leaderboard/environment.js';
import {terminalBench} from '../../packages/host/lib/types/leaderboard/fetch/sources/terminal-bench.js';

const api='https://api.github.com/repos/harbor-framework/terminal-bench/';
const raw='https://raw.githubusercontent.com/harbor-framework/terminal-bench/';
const sha='a'.repeat(40),date='2026-09-03T02:43:32Z';
const direct={fetch:async()=>{throw new Error('Direct raw download would time out');}};
const arena={fetch:async()=>{throw new Error('Terminal Bench must not use the Arena route');}};
const response=value=>({status:200,text:()=>typeof value==='string'?value:JSON.stringify(value)});
const submission={source_filter:{agent:'fixture-agent',agent_version:'1.0',model_name:'fixture/model-a',reasoning_effort:'high'},metadata:{agent_display:{label:'Fixture Agent',url:'https://example.invalid/agent'},model_display:{label:'Fixture Model',url:'https://example.invalid/model'},model_org:{label:'Fixture Org',url:'https://example.invalid/org'},date:'2026-08-01',reasoning_effort:'high'},metrics:{accuracy:60,accuracy_ci95_half_width:4,n_trials:3}};

describe('Terminal Bench public transport',()=>{
 it('reads the pinned official version, dataset metadata and all submissions through the public route',async()=>{
  const seen=[];const publicReads={fetch:async(url)=>{
   seen.push(url);
   if(url.startsWith(api+'commits?'))return response([{sha,commit:{committer:{date}}}]);
   if(url===api+`contents/leaderboard/submissions?ref=${sha}`)return response([{name:'one.json',type:'file'},{name:'two.json',type:'file'},{name:'README.md',type:'file'}]);
   if(url===raw+sha+'/leaderboard/leaderboard.yaml')return response('name: 4-0-0\n');
   if(url===raw+sha+'/leaderboard/src/leaderboard/core/hub.py')return response('DATASET_REF = "sha256:fixture"\n');
   if(url===raw+sha+'/leaderboard/src/leaderboard/ci/static_analysis.py')return response('EXPECTED_TASK_COUNT = 80\n');
   if(url===raw+sha+'/leaderboard/submissions/one.json')return response(submission);
   if(url===raw+sha+'/leaderboard/submissions/two.json')return response({...submission,metrics:{...submission.metrics,accuracy:70}});
   throw new Error('Unexpected request '+url);
  }};
  const [result]=await inLeaderboardEnvironment({credentials:{},fetch:(url,options)=>leaderboardTransport(url,options,direct,arena,publicReads).fetch(url,options)},()=>terminalBench.fetch());
  expect(seen).toHaveLength(8);expect(result.rows).toHaveLength(2);
  expect(result.metadata).toMatchObject({dataRevision:sha,dataCommit:sha,benchmarkVersion:'4.0.0',datasetRef:'sha256:fixture',representativeMode:'CONFIGURATION_ONLY',metricCount:0});
  expect(result.publishedAt).toBe(date);
  expect(result.rows.map(row=>({key:row.configurationKey,score:row.rawScore,tasks:row.sampleSize,mode:row.configuration.kind,ineligible:!!row.configuration.ineligible}))).toEqual([
   {key:'tb4:one.json',score:0.6,tasks:80,mode:'SCAFFOLDED',ineligible:true},
   {key:'tb4:two.json',score:0.7,tasks:80,mode:'SCAFFOLDED',ineligible:true},
  ]);
 });
 it('keeps credentials, writes, lookalike hosts and unrelated repositories off the public route',()=>{
  const publicReads={};
  for(const [url,options] of [
   [api+'commits',{headers:{authorization:'Bearer fixture-only'}}],
   [raw+sha+'/leaderboard/leaderboard.yaml',{headers:{cookie:'fixture-only'}}],
   [api+'commits?access_token=fixture-only',{}],
   [api+'commits',{method:'POST',body:'fixture'}],
   ['https://api.github.com/repos/other/terminal-bench/commits',{}],
   ['https://api.github.com/repos/harbor-framework/terminal-bench-other/commits',{}],
   ['https://raw.githubusercontent.com.evil.invalid/harbor-framework/terminal-bench/file',{}],
   [raw.replace('https:','http:')+sha+'/file',{}],
   [api.replace('api.github.com','api.github.com:444')+'commits',{}],
  ])expect(leaderboardTransport(url,options,direct,arena,publicReads)).toBe(direct);
  expect(leaderboardTransport('https://huggingface.co/datasets/arena/data',{},direct,arena,publicReads)).toBe(arena);
  expect(leaderboardTransport(api+'commits',{},direct,null,direct)).toBe(direct);
 });
});
