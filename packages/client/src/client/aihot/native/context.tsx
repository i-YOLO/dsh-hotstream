import {createContext,useContext,type ReactNode} from 'react';
import type {NewsFace,NewsState} from '../../news-controller.ts';
export interface NativeBridge {state:NewsState;face:Omit<NewsFace,'hooks'>;scroll:HTMLElement|null;root:HTMLElement|null;scheme:'light'|'dark';text:(zh:string)=>string;}
const Context=createContext<NativeBridge|null>(null);
export function NativeProvider({value,children}:{value:NativeBridge;children:ReactNode}){return <Context.Provider value={value}>{children}</Context.Provider>;}
export function useNative():NativeBridge{const value=useContext(Context);if(!value)throw new Error('Hotstream native UI scope is unavailable');return value;}
export function routeLocation(state:NewsState){const url=new URL(state.path,'https://hotstream.invalid');return {pathname:url.pathname,search:url.search,hash:url.hash,key:state.routeKey,state:null};}
