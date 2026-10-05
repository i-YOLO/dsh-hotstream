import {IconFlame} from './icons.tsx';
export function Wordmark({size=24}:{size?:number}){return <span className="inline-flex items-center gap-2 font-bold tracking-tight" style={{fontSize:size}}><span className="text-accent"><IconFlame size={22}/></span>Hotstream</span>;}
export function RingMark({className,spinning}:{className?:string|undefined;spinning?:boolean|undefined}){return <span className={[className,spinning?'animate-spin':''].filter(Boolean).join(' ')}><IconFlame size={20}/></span>;}
