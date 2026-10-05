/** Build public Host artifacts and the target DSH lazy-CJS Client factory. */
import { build } from 'tsdown';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname, basename, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { transform } from 'lightningcss';
import { emitRemoteArtifacts } from './emit-remotes.mjs';
import {sourceUiTransform} from './ui/transform-source.mjs';
import {generateLeaderboardPrices} from './generate-leaderboard-prices.mjs';

const root = resolve(import.meta.dirname, '..');
const require = createRequire(import.meta.url);
const tsc = require.resolve('typescript/bin/tsc');
const compile = config => execFileSync(process.execPath, [tsc, '-b', config], { cwd: root, stdio: 'inherit' });
const externalNode = spec => !spec.startsWith('.') && !spec.startsWith('/') && !spec.startsWith('\0');

await generateLeaderboardPrices(root);
compile('tsconfig.host.json');
for (const pkg of ['contracts', 'core', 'storage-sqlite', 'host']) {
  const dir = resolve(root, 'packages', pkg);
  await build({
    entry: { index: resolve(dir, 'lib/types/index.js'), ...(pkg === 'storage-sqlite' ? { worker: resolve(dir, 'lib/types/worker.js') } : {}),...(pkg === 'host'?{'compute-worker':resolve(dir,'lib/types/leaderboard/compute-worker.js')}:{}) },
    outDir: resolve(dir, 'lib'), format: 'esm', platform: 'node', dts: false, clean: false,
    deps: { neverBundle: spec => externalNode(spec) && !spec.startsWith('dsh-hotstream-core'), alwaysBundle: spec => spec.startsWith('dsh-hotstream-core') }, outputOptions: { entryFileNames: '[name].js', chunkFileNames: '[name].js' },
  });
}
const hostRequire = createRequire(resolve(root, 'packages/host/package.json'));
for (const artifact of await emitRemoteArtifacts(root, hostRequire)) {
  const dir = resolve(root, artifact.packageRoot, 'lib');
  await mkdir(dir, { recursive: true });
  await writeFile(resolve(dir, `typert.${artifact.face}.js`), artifact.js);
  await writeFile(resolve(dir, `typert.${artifact.face}.d.ts`), artifact.dts);
  if (artifact.remote !== undefined) {
    await writeFile(resolve(dir, 'typert.remote-client.js'), artifact.remote.js);
    await writeFile(resolve(dir, 'typert.remote-client.d.ts'), artifact.remote.dts);
  }
}
compile('packages/bundle/tsconfig.json');
compile('tsconfig.client.json');
for (const pkg of ['bundle', 'client']) {
  const dir = resolve(root, 'packages', pkg);
  await build({ entry: { index: resolve(dir, 'lib/types/index.js') }, outDir: resolve(dir, 'lib'), format: 'esm', platform: 'node', dts: false, clean: false, deps: { neverBundle: spec => externalNode(spec) && !spec.startsWith('dsh-hotstream-core'), alwaysBundle: spec => spec.startsWith('dsh-hotstream-core') }, outputOptions: { entryFileNames: '[name].js' } });
}
const shared = new Set(['react', 'react/jsx-runtime', 'react-dom', 'react-dom/client', '@deepseek-ai/cordis', '@deepseek-ai/dsh-client-store', '@deepseek-ai/dsh-client-ui-slots', '@deepseek-ai/dsh-client-ui-primitives', '@deepseek-ai/dsh-client-ui-dockkit']);
const cssPlugin = {
  name: 'hotstream-css-modules',
  resolveId(source, importer) {
    if (!source.endsWith('.module.css') || importer === undefined) return null;
    return `\0hotstream-css:${relative(root,resolve(dirname(importer), source))}.mjs`;
  },
  async load(id) {
    if (!id.startsWith('\0hotstream-css:')) return null;
    const path = resolve(root,id.slice('\0hotstream-css:'.length, -'.mjs'.length));
    this.addWatchFile(path);
    // The source theme and native layout share one explicitly namespaced container.
    // Per-file hashing would make cross-module responsive rules silently stop matching.
    const result = transform({ filename: path, code: Buffer.from(await readFile(path)), cssModules: {container:false} });
    const classes = Object.fromEntries(Object.entries(result.exports ?? {}).map(([key, value]) => [key, value.name]));
    return `import {defineStyle} from ${JSON.stringify(resolve(root,'packages/client/src/client/styles.ts'))};const css=${JSON.stringify(result.code.toString())};defineStyle(${JSON.stringify("dsh-hotstream-client/"+relative(resolve(root,'packages/client/src/client'),path))},css);export default ${JSON.stringify(classes)};`;
  },
};
await build({
  entry: { client: resolve(root, 'packages/client/src/client/index.ts') },
  outDir: resolve(root, 'packages/client/lib'), format: 'cjs', platform: 'browser', clean: false, dts: false,
  deps: { neverBundle: spec => shared.has(spec), alwaysBundle: spec => !shared.has(spec) },
  plugins: [sourceUiTransform(root),cssPlugin],
  outputOptions: {
    entryFileNames: 'client.js', codeSplitting: false,
    banner: 'window.__ModuleLoader__.load({id:"dsh-hotstream-client",factory:(require)=>{',
    intro: 'var module={exports:{}};var exports=module.exports;',
    footer: 'return module.exports;}});',
  },
});
