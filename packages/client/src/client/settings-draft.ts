import {settingsSchema,type RuntimeSettings} from 'dsh-hotstream-contracts/runtime';
export interface SettingsDraft {
  value:RuntimeSettings;base:RuntimeSettings;revision:number;dirty:boolean;
  status:'clean'|'dirty'|'saving'|'saved'|'error';error:string|null;savedAt:number|null;conflict:boolean;
}
export function sameSettings(left:RuntimeSettings,right:RuntimeSettings):boolean {
  const normalize=(value:RuntimeSettings)=>{const parsed=settingsSchema.parse(value);return JSON.stringify({...parsed,industry:{...parsed.industry,revision:0}});};
  return normalize(left)===normalize(right);
}
export function createSettingsDraft(value:RuntimeSettings,revision:number):SettingsDraft {
  return {value:structuredClone(value),base:structuredClone(value),revision,dirty:false,status:'clean',error:null,savedAt:null,conflict:false};
}
export function refreshSettingsDraft(draft:SettingsDraft|null,value:RuntimeSettings,revision:number):SettingsDraft {
  if(!draft)return createSettingsDraft(value,revision);
  if(draft.dirty||draft.status==='saving')return {...draft,conflict:draft.revision!==revision};
  if(draft.revision===revision)return draft;
  return createSettingsDraft(value,revision);
}
export function changeSettingsDraft(draft:SettingsDraft,patch:Partial<RuntimeSettings>):SettingsDraft {
  const value={...draft.value,...structuredClone(patch)},dirty=JSON.stringify(value)!==JSON.stringify(draft.base);
  return {...draft,value,dirty,status:dirty?'dirty':'clean',error:null};
}
