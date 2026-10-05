/** Browser-local AIHOT preferences are backed by the plugin's durable native state. */
import {useNative} from '../native/context.tsx';
export type ThemePreference='light'|'dark'|null;
export function useReadSet():ReadonlySet<string>{const {state}=useNative();return new Set(Object.entries(state.marks).filter(([,mark])=>mark.readAt!==null).map(([id])=>id));}
export function useIsStarred(id:string):boolean{const {state}=useNative();return state.marks[id]?.bookmarked??false;}
export function useChangelogSeen():string|null{const {state}=useNative();return typeof state.preferences.values.changelogSeen==='string'?state.preferences.values.changelogSeen:null;}
export function useThemePreference():ThemePreference{const value=useNative().state.appearance;return value==='host'?null:value;}
