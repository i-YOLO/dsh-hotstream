/** Verify the files npm actually packs, including generated shared chunks and worker URLs. */
import {readFile} from 'node:fs/promises';
import {resolve,posix} from 'node:path';
import ts from 'typescript';
const root=resolve(import.meta.dirname,'..');
const stage=resolve(root,'artifacts/candidate/staging');
const packed=JSON.parse(await readFile(resolve(root,'artifacts/candidate/pack-manifest.json'),'utf8'));
const files=new Set(packed.files.map(file=>file.path));
const errors=[];
for(const file of files){
 if(file.endsWith('package.json')){
  const manifest=JSON.parse(await readFile(resolve(stage,file),'utf8'));
  for(const [name,value]of Object.entries({...manifest.dependencies,...manifest.peerDependencies}))if(typeof value!=='string'||value.startsWith('workspace:')||value.startsWith('file:')||value.startsWith('link:'))errors.push(`${file}: unresolved dependency ${name}`);
 }
 if(!file.endsWith('.js'))continue;
 const source=await readFile(resolve(stage,file),'utf8');
 if(source.includes('/Users/shike/')||source.includes('/dsh-hotstream-source-review-')||/@deepseek-ai\/[^\s"']+\/src\//.test(source))errors.push(`${file}: private or developer path`);
 const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS);
 const check=specifier=>{if(!specifier.startsWith('.'))return;const target=posix.normalize(posix.join(posix.dirname(file),specifier));if(!files.has(target))errors.push(`${file}: missing ${specifier}`);};
 const visit=node=>{
  if((ts.isImportDeclaration(node)||ts.isExportDeclaration(node))&&node.moduleSpecifier&&ts.isStringLiteral(node.moduleSpecifier))check(node.moduleSpecifier.text);
  if(ts.isCallExpression(node)&&(node.expression.kind===ts.SyntaxKind.ImportKeyword||ts.isIdentifier(node.expression)&&node.expression.text==='require')&&node.arguments[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text);
  if(ts.isNewExpression(node)&&ts.isIdentifier(node.expression)&&node.expression.text==='URL'&&node.arguments?.[0]&&ts.isStringLiteral(node.arguments[0]))check(node.arguments[0].text);
  ts.forEachChild(node,visit);
 };
 visit(tree);
}
for(const required of ['lib/index.js','node_modules/dsh-hotstream-client/lib/client.js','node_modules/dsh-hotstream-host/lib/typert.host.js','node_modules/dsh-hotstream-host/lib/typert.remote-client.js','node_modules/dsh-hotstream-host/lib/compute-worker.js','node_modules/dsh-hotstream-storage-sqlite/lib/worker.js','AIHOT-MIT.txt'])if(!files.has(required))errors.push(`missing required artifact ${required}`);
if(errors.length)throw new Error(errors.join('\n'));
console.log(JSON.stringify({artifact:packed.filename,files:files.size,relativeModuleAndWorkerClosure:true,unresolvedWorkspaceDependencies:0,privatePaths:0},null,2));
