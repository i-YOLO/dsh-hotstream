/** Mechanical AIHOT utility -> scoped CSS Modules conversion; compiler is development-only. */
import {readFile,writeFile,readdir} from 'node:fs/promises';
import {resolve,join,dirname} from 'node:path';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
const root=resolve(import.meta.dirname,'../..');
const tooling=createRequire(resolve(root,'scripts/ui/package.json'));
const {compile}=await import(pathToFileURL(tooling.resolve('@tailwindcss/node')).href);
const {Scanner}=tooling('@tailwindcss/oxide');
const postcss=(await import(pathToFileURL(createRequire(tooling.resolve('@tailwindcss/node')).resolve('postcss')).href)).default;
const files=[];async function walk(dir){for(const item of await readdir(dir,{withFileTypes:true})){const file=join(dir,item.name);if(item.isDirectory())await walk(file);else if(/\.(?:tsx?|css)$/.test(file)&&!file.endsWith('source.module.css'))files.push(file);}}
await walk(resolve(root,'packages/client/src/client/aihot'));
const scanner=new Scanner({sources:[]});const candidates=scanner.scanFiles(await Promise.all(files.map(async file=>({content:await readFile(file,'utf8'),extension:file.endsWith('tsx')?'tsx':'ts'}))));
const theme=await readFile(resolve(dirname(tooling.resolve('tailwindcss/package.json')),'theme.css'),'utf8');
const source=(await readFile(resolve(root,'upstream/aihot-ui.css'),'utf8')).replace('@import "tailwindcss";','');
const sheet=await compile(theme+'\n'+source+'\n@tailwind utilities;',{base:root,onDependency:()=>{}});
const ast=postcss.parse(sheet.build(candidates));
ast.walkRules(rule=>{let parent=rule.parent;while(parent){if(parent.type==='atrule'&&/keyframes$/.test(parent.name))return;parent=parent.parent;}
 if(rule.selector.includes('&'))return;
 rule.selector=rule.selector.split(/,(?![^()]*\))/).map(selector=>{const s=selector.trim();if(s===':root'||s===':host')return '.root';if(s==='[data-theme="dark"]')return '.root[data-theme="dark"]';if(s==='html'||s==='body')return '.root';return ':where(.root) '+s;}).join(', ');
});
ast.walkDecls('position',declaration=>{if(declaration.value==='fixed')declaration.value='absolute';});
ast.walkAtRules('media',rule=>{if(/(?:min|max)-width:|\bwidth\s*[<>=]/.test(rule.params)&&!rule.params.includes('hover')){rule.name='container';rule.params='dsh-hotstream '+rule.params;}});
let css=ast.toString().replaceAll('--tw-','--hsu-').replace(/\b100dvh\b/g,'var(--hs-height)').replace(/\b100vh\b/g,'var(--hs-height)').replace(/\b270dvh\b/g,'calc(var(--hs-height) * 2.7)').replace(/\b200dvh\b/g,'calc(var(--hs-height) * 2)');
css+='\n.root{box-sizing:border-box;color:var(--ink);background:var(--bg);font-family:var(--font-sans);font-size:14px;line-height:1.5;container:dsh-hotstream / inline-size;height:100%;min-height:0;isolation:isolate;}\n:where(.root) :where(*,*::before,*::after){box-sizing:border-box;border-style:solid;border-width:0;}\n:where(.root) :where(h1,h2,h3,h4,h5,h6,p,ul,ol,figure,blockquote){margin:0;padding:0;}\n:where(.root) :where(ul,ol){list-style:none;}\n:where(.root) :where(button,input,textarea,select){font:inherit;}\n:where(.root) :where(button){background:transparent;color:inherit;}\n:where(.root) :where(button,a){-webkit-tap-highlight-color:transparent;}\n:where(.root) :where(svg,img){display:block;vertical-align:middle;}\n:where(.root) :where(button:disabled){cursor:default;}\n';
await writeFile(resolve(root,'packages/client/src/client/aihot/source.module.css'),'/* Generated from AIHOT cc66cceb by scripts/ui/convert-styles.mjs. MIT. */\n'+css);
await writeFile(resolve(root,'artifacts/ui-alpha3/css-conversion.json'),JSON.stringify({sourceCommit:'cc66cceb1dc7a0bc147e942e49ff94c9cee418c6',compiler:'4.3.3',candidates:candidates.length,bytes:Buffer.byteLength(css),sourceFiles:files.length,shippedCompiler:false},null,2));
console.log('Converted '+candidates.length+' source utility candidates into '+Buffer.byteLength(css)+' bytes of isolated CSS Modules.');
