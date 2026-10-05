import {forwardRef,useState,type ComponentProps,type ReactNode} from 'react';
import {Button as NativeButton,Input as NativeInput,Modal as NativeModal,Menu,Switch} from '@deepseek-ai/dsh-client-ui-primitives';
import type {CatalogResult,RuntimeSettings} from 'dsh-hotstream-contracts';
import type {UiKey} from '../locales.ts';
import {IconChevronDown} from '../aihot/components/icons.tsx';
import styles from './Admin.module.css';

export const Button=forwardRef<HTMLButtonElement,ComponentProps<typeof NativeButton>>(function Button({variant='primary',type='button',className='',...props},ref){
  return <NativeButton {...props} ref={ref} variant={variant} type={type} className={`${styles.button} ${variant==='primary'?styles.primary:''} ${className}`}/>;
});
export function Modal(props:ComponentProps<typeof NativeModal>){return <NativeModal {...props} className={`${styles.dialog} ${props.className??''}`}/>;}
export const Input=forwardRef<HTMLInputElement,ComponentProps<typeof NativeInput>>(function Input({className='',...props},ref){return <NativeInput {...props} ref={ref} className={`${styles.input} ${className}`}/>;});
export function Field({label,value,onChange,type='text',placeholder,disabled=false}:{label:string;value:string;onChange:(value:string)=>void;type?:string;placeholder?:string;disabled?:boolean}){
  return <label className={styles.field}><span>{label}</span><Input aria-label={label} type={type} autoComplete={type==='password'?'new-password':undefined} spellCheck={type==='password'?false:undefined} placeholder={placeholder} disabled={disabled} value={value} onChange={event=>onChange(event.target.value)}/></label>;
}
export function NumberField({label,value,onChange,min=0,max,disabled=false}:{label:string;value:number;onChange:(value:number)=>void;min?:number;max?:number;disabled?:boolean}){
  return <label className={styles.field}><span>{label}</span><Input aria-label={label} type="number" min={min} max={max} disabled={disabled} value={value} onChange={event=>{const number=Number(event.target.value);if(Number.isFinite(number))onChange(Math.max(min,Math.min(max??Infinity,Math.trunc(number))));}}/></label>;
}
export function Choice({label,value,choices,onChange,disabled=false}:{label:string;value:string;choices:{id:string;label:string}[];onChange:(value:string)=>void;disabled?:boolean}){
  const [open,setOpen]=useState(false);
  return <div className={styles.field}><span>{label}</span><Menu open={open} anchor={<Button variant="outline" className={styles.choice} disabled={disabled} aria-label={label} aria-expanded={open} onClick={()=>setOpen(!open)}><span>{choices.find(choice=>choice.id===value)?.label??(value||label)}</span><IconChevronDown size={16}/></Button>} items={choices} selectedId={value} onSelect={id=>{onChange(id);setOpen(false);}} onClose={()=>setOpen(false)} portal/></div>;
}
export function ModelRoute({catalog,face,provider,model,setProvider,setModel,disabled=false}:{catalog:CatalogResult;face:{t:(key:UiKey)=>string};provider:string;model:string;setProvider:(value:string)=>void;setModel:(value:string)=>void;disabled?:boolean}){
  const selected=catalog.providers.find(item=>item.id===provider);
  return <div className={styles.grid}><Choice label={face.t('provider')} value={provider} choices={catalog.providers.map(item=>({id:item.id,label:item.name}))} onChange={setProvider} disabled={disabled}/><Choice label={face.t('modelName')} value={model} choices={(selected?.models??[]).map(item=>({id:item.id,label:item.name}))} onChange={setModel} disabled={disabled}/>{selected?.error&&<p role="alert" className={styles.error}>{selected.error}</p>}</div>;
}
export function BudgetForm({label,value,face,onChange,disabled=false}:{label:string;value:RuntimeSettings['budgets']['llm'];face:{t:(key:UiKey)=>string};onChange:(value:RuntimeSettings['budgets']['llm'])=>void;disabled?:boolean}){
  return <fieldset className={styles.budget}><legend>{label}</legend><div className={styles.budgetGrid}>{(['perMinute','perHour','per24Hours'] as const).map(key=><NumberField key={key} label={face.t(key==='per24Hours'?'perDay':key)} value={value[key]} max={key==='perMinute'?10000:key==='perHour'?100000:1000000} onChange={number=>onChange({...value,[key]:number})} disabled={disabled}/>)}</div></fieldset>;
}
export function ToggleRow({label,description,checked,onChange,disabled=false}:{label:string;description:string;checked:boolean;onChange:(value:boolean)=>void;disabled?:boolean}){
  return <div className={styles.toggleRow}><div><strong>{label}</strong><p>{description}</p></div><Switch label={label} checked={checked} disabled={disabled} onChange={onChange}/></div>;
}
export function Section({id,title,description,children,actions}:{id?:string;title:string;description?:string;children:ReactNode;actions?:ReactNode}){
  return <section id={id} className={styles.section}><header className={styles.sectionHeader}><div><h2>{title}</h2>{description&&<p>{description}</p>}</div>{actions}</header>{children}</section>;
}
