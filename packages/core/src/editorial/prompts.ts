import { createHash } from "node:crypto";
import { promptFiles } from "../industry/prompts.ts";
function raw(name:string):string{const text=promptFiles[name];if(text===undefined)throw new Error(`Unknown prompt ${name}`);return text;}
// Every editorial prompt lives in the industry pack as a Markdown file (industry/prompts/*.md), so a new
// industry changes its taste by editing text, not code. Two template forms, nothing else:
//   {{name}}     a value the calling step passes (plus siteName, from industry/site.ts)
//   {{> file}}   another prompt file, inserted as it is (shared rules)
// A missing value or file is an error, never a silent blank. Versions are content hashes, so a receipt
// and the admin's model page always say which wording produced a result.

const TOKEN = /\{\{(>\s*)?([A-Za-z][\w.-]*)\s*\}\}/g;

/** The file with its includes expanded, and the names of every file it read. */
function expand(name: string, seen: string[] = []): { text: string; used: string[] } {
  if (seen.includes(name)) throw new Error(`prompt include cycle: ${[...seen, name].join(" → ")}`);
  const used = [name];
  const text = raw(name).replace(TOKEN, (token, include: string | undefined, key: string) => {
    if (!include) return token;
    const inner = expand(key, [...seen, name]);
    used.push(...inner.used);
    return inner.text;
  });
  return { text, used };
}

/** A prompt with its values filled in. */
export function promptText(name: string, values: Record<string, string> = {}): string {
  const all: Record<string, string> = { siteName: "DSH 热点", ...values };
  return expand(name).text.replace(TOKEN, (_token, _include, key: string) => {
    const value = all[key];
    if (value === undefined) throw new Error(`prompt ${name}: no value for {{${key}}}`);
    return value;
  });
}

/** `name@hash` over the files a prompt reads, so any edit shows up as a new version. */
export function promptVersion(...names: string[]): string {
  const used = [...new Set(names.flatMap((n) => expand(n).used))].sort();
  const hash = createHash("sha256");
  for (const n of used) hash.update(`${n}\n${raw(n)}\n`);
  return `${names.join("+")}@${hash.digest("hex").slice(0, 10)}`;
}

/** A job-owned override pack uses the same includes/values contract; it never executes code. */
export function promptFrom(overrides:Record<string,string>,name:string,values:Record<string,string>={},siteName='DSH 热点'):string{
 const expandOverride=(file:string,seen:string[]=[]):string=>{if(seen.includes(file))throw new Error('Prompt include cycle');const text=overrides[file]??raw(file);return text.replace(TOKEN,(token,include:string|undefined,key:string)=>include?expandOverride(key,[...seen,file]):token);};
 const all={siteName,...values};return expandOverride(name).replace(TOKEN,(_token,_include,key:string)=>{const value=all[key as keyof typeof all];if(value===undefined)throw new Error('Missing prompt value '+key);return value;});
}
