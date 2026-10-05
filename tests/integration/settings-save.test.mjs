import {describe,it,expect} from 'vitest';
import {NewsViewController} from '../../packages/client/lib/types/client/news-controller.js';
import {defaultSettings} from '../../packages/contracts/lib/types/runtime.js';
const ok=value=>Promise.resolve({ok:true,value}),tick=()=>new Promise(resolve=>setTimeout(resolve,5));
function fixture(){
  const state={initialized:true,deleting:false,dataRevision:1,moduleGenerations:{leaderboard:0,monitor:0},epoch:0,revision:2,schemaVersion:14,sourceCount:1,settings:{...defaultSettings({provider:'fixture',model:'fixture'}),autoCollectEnabled:false},counts:{articles:0}};
  const module={enabled:false,status:'disabled',lastAttemptAt:null,lastSuccessAt:null,error:null,records:0,snapshots:0,sources:[],latestTest:null,coverageComplete:false};
  let saves=0,reads=0,values={path:'/settings',page:'settings'};
  const remote={
    runtime:()=>{reads++;return ok({state:structuredClone(state),defaultRoute:null,error:null,running:true});},
    configure:request=>{saves++;if(request.revision!==state.revision)return Promise.resolve({ok:false,error:{message:'Settings revision conflict'}});state.settings=structuredClone(request.settings);state.revision++;return ok(structuredClone(state));},
    preferences:()=>ok({revision:1,values}),models:()=>ok({providers:[]}),sources:()=>ok({items:[]}),admin:()=>ok({jobs:[],receipts:[]}),credentials:()=>ok({items:[]}),diagnostics:()=>ok({resources:{}}),moduleHealth:()=>ok({leaderboard:module,monitor:module}),
    savePreferences:request=>{values=request.values;return ok({revision:2,values});},uiFeed:()=>ok({cards:[],total:0,dayCounts:[],nextCursor:null,epoch:0,dataRevision:1}),reading:()=>ok({hot:[],reports:[],topics:[],events:[]}),browse:()=>ok({items:[],total:0}),candidates:()=>ok({items:[],total:0}),modelAuthorization:()=>ok({active:false}),
  };
  const view=new NewsViewController({remote:{hotstream:remote},layout:{beginNavigation:()=>new AbortController().signal}},()=>{}),face=view.face();
  face.registerFormGuard({title:'Settings',isDirty:()=>view.state.getSnapshot().settingsDraft?.dirty===true,save:face.saveSettings,discard:face.resetSettingsDraft});
  return {state,remote,view,face,saves:()=>saves,reads:()=>reads};
}
describe('settings draft and verified explicit save',()=>{
  it('keeps a switch local until save, verifies it through a read, and preserves it across navigation',async()=>{
    const f=fixture();try{await f.view.load();f.face.editSettings({autoCollectEnabled:true});expect(f.state.settings.autoCollectEnabled).toBe(false);expect(f.view.state.getSnapshot().settingsDraft.dirty).toBe(true);const reads=f.reads();expect(await f.face.saveSettings()).toBe(true);expect(f.reads()).toBeGreaterThan(reads);expect(f.saves()).toBe(1);expect(f.view.state.getSnapshot().settingsDraft).toMatchObject({dirty:false,status:'saved',value:{autoCollectEnabled:true}});f.face.navigateUrl('/all');await tick();f.face.navigateUrl('/settings');await tick();expect(f.view.state.getSnapshot().settingsDraft.value.autoCollectEnabled).toBe(true);}finally{f.view.dispose();}
  });
  it('retains an edited draft when background settings change, and reports a revision conflict',async()=>{
    const f=fixture();try{await f.view.load();f.face.editSettings({autoCollectEnabled:true});f.state.settings.retention.cacheDays=20;f.state.revision++;await f.view.load();expect(f.view.state.getSnapshot().settingsDraft).toMatchObject({dirty:true,conflict:true,value:{autoCollectEnabled:true}});expect(await f.face.saveSettings()).toBe(false);expect(f.view.state.getSnapshot().settingsDraft).toMatchObject({dirty:true,status:'error',error:'Settings revision conflict'});expect(f.state.settings.autoCollectEnabled).toBe(false);}finally{f.view.dispose();}
  });
  it('supports keep editing, discard, and save-and-leave without dropping back history',async()=>{
    const f=fixture();try{await f.view.load();f.face.editSettings({autoCollectEnabled:true});f.face.navigateUrl('/all');expect(f.view.state.getSnapshot().path).toBe('/settings');expect(f.view.state.getSnapshot().formNavigation).not.toBeNull();f.face.resolveFormNavigation('cancel');await tick();expect(f.view.state.getSnapshot().path).toBe('/settings');expect(f.saves()).toBe(0);f.face.navigateUrl('/all');f.face.resolveFormNavigation('save');await tick();expect(f.view.state.getSnapshot().path).toBe('/all');expect(f.saves()).toBe(1);f.face.goBack();await tick();expect(f.view.state.getSnapshot().path).toBe('/settings');f.face.editSettings({autoCollectEnabled:false});f.face.goBack();f.face.resolveFormNavigation('cancel');await tick();expect(f.view.state.getSnapshot().path).toBe('/settings');f.face.navigateUrl('/all');f.face.resolveFormNavigation('discard');await tick();expect(f.view.state.getSnapshot().path).toBe('/all');expect(f.state.settings.autoCollectEnabled).toBe(true);}finally{f.view.dispose();}
  });
  it('never marks a save successful when readback differs, and keeps the user input',async()=>{
    const f=fixture();try{await f.view.load();f.remote.configure=()=>ok(f.state);f.face.editSettings({autoCollectEnabled:true});expect(await f.face.saveSettings()).toBe(false);expect(f.view.state.getSnapshot().settingsDraft).toMatchObject({dirty:true,status:'error',value:{autoCollectEnabled:true}});}finally{f.view.dispose();}
  });
  it('coalesces repeated save clicks while the same request is running',async()=>{
    const f=fixture();try{await f.view.load();let resolve,calls=0;f.remote.configure=request=>{calls++;return new Promise(done=>{resolve=()=>{f.state.settings=request.settings;f.state.revision++;done({ok:true,value:f.state});};});};f.face.editSettings({autoCollectEnabled:true});const first=f.face.saveSettings(),second=f.face.saveSettings();expect(calls).toBe(1);resolve();expect(await first).toBe(true);expect(await second).toBe(true);}finally{f.view.dispose();}
  });
  it('does not expose an echoed API key in client errors or persisted preferences',async()=>{
    const f=fixture();try{await f.view.load();const key='HOTSTREAM_PRIVATE_TEST_KEY';f.remote.setCredential=()=>Promise.resolve({ok:false,error:{message:'Provider echoed '+key}});expect(await f.face.saveCredential('socialdata',key)).toBe(false);expect(JSON.stringify(f.view.state.getSnapshot()).includes(key)).toBe(false);}finally{f.view.dispose();}
  });
});
