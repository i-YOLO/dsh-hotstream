/** Stage a closed prebuilt bundle with its own companion packages, then create one tgz. */
import { cp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';

const root = resolve(import.meta.dirname, '..');
const artifactRoot = join(root, 'artifacts', 'candidate');
const stage = join(artifactRoot, 'staging');
await rm(stage, { recursive: true, force: true });
await mkdir(join(stage, 'node_modules'), { recursive: true });
const companions = ['contracts', 'storage-sqlite', 'host', 'client'];
const manifest = JSON.parse(await readFile(join(root, 'packages/bundle/package.json'), 'utf8'));
const versions = new Map();
for (const pkg of companions) {
  const data = JSON.parse(await readFile(join(root, 'packages', pkg, 'package.json'), 'utf8'));
  versions.set(data.name, data.version);
}
const rewrite = data => {
  delete data.devDependencies;
  for (const section of ['dependencies', 'peerDependencies']) {
    for (const [name, value] of Object.entries(data[section] ?? {})) {
      if(name === 'dsh-hotstream-core'){delete data[section][name];continue;}
      if (value.startsWith('workspace:')) data[section][name] = versions.get(name);
    }
  }
  return data;
};
for (const pkg of companions) {
  const source = join(root, 'packages', pkg);
  const data = rewrite(JSON.parse(await readFile(join(source, 'package.json'), 'utf8')));
  const target = join(stage, 'node_modules', data.name);
  await mkdir(target, { recursive: true });
  await cp(join(source, 'lib'), join(target, 'lib'), { recursive: true,filter:path=>!path.endsWith('.mjs')&&!path.endsWith('.tsbuildinfo') });
  await writeFile(join(target, 'package.json'), JSON.stringify(data, null, 2) + '\n');
  Object.assign(manifest.peerDependencies, data.peerDependencies);
  for (const [name, version] of Object.entries(data.dependencies ?? {})) {
    if (!versions.has(name)) manifest.dependencies[name] = version;
  }
}
rewrite(manifest);
manifest.bundledDependencies = [...versions.keys()];
manifest.description = 'Native DeepSeek Harness news pipeline plugin (development candidate)';
await cp(join(root, 'packages/bundle/lib'), join(stage, 'lib'), { recursive: true,filter:path=>!path.endsWith('.mjs')&&!path.endsWith('.tsbuildinfo') });
await cp(join(root, 'packages/bundle/cordis.patch.yml'), join(stage, 'cordis.patch.yml'));
await cp(join(root, 'README.md'), join(stage, 'README.md'));
for (const name of ['LICENSE','NOTICE']) await cp(join(root,name),join(stage,name));
await cp(join(root,'docs/screenshots'),join(stage,'docs/screenshots'),{recursive:true});
await mkdir(join(stage,'docs'),{recursive:true});for(const name of ['01_PRD.md','07_真实RSS业务验收.md','08_候选验收报告.md','09_性能报告.md','10_Windows验收流程.md','11_真实报告验收.md','12_UI恢复与当前验收.md','13_后台与接入验收.md','14_模型价格修复验收.md','15_TerminalBench修复验收.md','16_模型榜空行修复验收.md']){const text=await readFile(join(root,'docs',name),'utf8');await writeFile(join(stage,'docs',name),text.replaceAll(root+'/', ''));}
await mkdir(join(stage,'upstream'),{recursive:true});for(const name of ['SOURCE_MAP.md','SOURCE_MAP.json','UI_SOURCE_MAP.json','upstream.lock.json'])await cp(join(root,'upstream',name),join(stage,'upstream',name));
await cp(join(root,'industry/ai'),join(stage,'industry/ai'),{recursive:true});
await cp(join(root,'packages/client/assets/aihot'),join(stage,'upstream/ui-assets'),{recursive:true});
await cp(join(root, 'upstream/licenses/AIHOT-MIT.txt'), join(stage, 'AIHOT-MIT.txt'));
await writeFile(join(stage, 'package.json'), JSON.stringify(manifest, null, 2) + '\n');
const output = execFileSync('npm', ['pack', '--ignore-scripts', '--json', '--pack-destination', artifactRoot], { cwd: stage, encoding: 'utf8' });
const packed = JSON.parse(output)[0];
if (packed.bundled.length !== companions.length) throw new Error('Companion packages were not embedded in the tgz');
await writeFile(join(artifactRoot, 'pack-manifest.json'), JSON.stringify(packed, null, 2) + '\n');
console.log(JSON.stringify({ artifact: join(artifactRoot, packed.filename), files: packed.entryCount, bundled: packed.bundled, integrity: packed.integrity }, null, 2));
