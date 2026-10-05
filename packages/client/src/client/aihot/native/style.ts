import classes from '../source.module.css';
export const sourceClasses=classes;
/** Original utility names remain legible in source; generated CSS Module names are the runtime boundary. */
export function cx(value:unknown):string {
 return typeof value==='string'?value.split(/\s+/).filter(Boolean).map(token=>classes[token]??token).join(' '):'';
}
