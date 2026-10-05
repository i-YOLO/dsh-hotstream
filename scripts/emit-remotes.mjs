/** Emit strict Remote artifacts using public DSH type models and actual decorator metadata. */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import ts from 'typescript';

/** Closed DTO objects must reject keys before the gateway can strip them. */
export function strictObjectCodecs(source) {
  const tree=ts.createSourceFile('remote-codecs.js',source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),edits=[];
  const visit=node=>{
    if(ts.isCallExpression(node)&&ts.isPropertyAccessExpression(node.expression)&&ts.isIdentifier(node.expression.expression)&&node.expression.expression.text==='z'&&node.expression.name.text==='object'){
      const parent=node.parent;
      if(ts.isCallExpression(parent)&&ts.isPropertyAccessExpression(parent.expression)&&parent.expression.expression.getText(tree)==='z'&&parent.expression.name.text==='intersection')throw new Error('Open indexed DTO objects require an explicit codec policy');
      edits.push({start:node.expression.getStart(tree),end:node.expression.end});
    }
    ts.forEachChild(node,visit);
  };
  visit(tree);if(!edits.length)throw new Error('Generated Remote has no closed object codecs');
  for(const edit of edits.sort((a,b)=>b.start-a.start))source=source.slice(0,edit.start)+'z.strictObject'+source.slice(edit.end);
  return source;
}

/** The target generator recognizes workspace-owned protocol declarations, not npm declarations. */
export async function emitRemoteArtifacts(root, require) {
  const { WorkspaceAnalyzer, FaceModelEmitter } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-typert-generator')).href);
  const { Context } = await import(pathToFileURL(require.resolve('@deepseek-ai/cordis')).href);
  const { remoteMethods } = await import(pathToFileURL(require.resolve('@deepseek-ai/dsh-typert-protocol')).href);
  const { HotstreamController } = await import(pathToFileURL(resolve(root, 'packages/host/lib/index.js')).href);
  const workspace = new WorkspaceAnalyzer({ root, packages: ['dsh-hotstream-host'], faces: ['host'], checkDiagnostics: false }).analyze();
  const face = workspace.faces[0];
  if (face === undefined) throw new Error('Host type model is missing');
  const pkg = face.packages.find(pkg => pkg.name === 'dsh-hotstream-host');
  const service = pkg?.services.find(service => service.key === 'hotstreamController');
  const declaration = face.graph.declarations.find(declaration => declaration.id === service?.symbol);
  if (pkg === undefined || service === undefined || declaration === undefined) throw new Error('Host service model is missing');
  const nodes = new Map(face.graph.nodes.map(node => [node.id, node]));
  const declarations = new Map(face.graph.declarations.map(declaration => [declaration.id, declaration]));
  const unwrap = (id, mode) => {
    const node = nodes.get(id);
    if (node?.kind === 'reference' && node.target.kind === 'standard' && ['Promise',...(mode==='stream'?['AsyncIterable','Iterable']:[])].includes(node.target.name)) return node.arguments[0];
    return id;
  };
  const boundary = (id, identity) => {
    if (id === undefined) throw new Error(`Missing type at ${identity}`);
    const node = nodes.get(id);
    if (node?.kind !== 'reference' || node.target.kind !== 'declaration') throw new Error(`Hotstream requires explicit public DTO types at ${identity}`);
    const target = declarations.get(node.target.symbol);
    if (target === undefined || !target.exported) throw new Error(`Missing public DTO at ${identity}`);
    return {
      type: id, codecType: id, acceptsUndefined: false, typeSymbol: target.id,
      imports: [{ symbol: target.id, specifier: target.package, name: target.name }],
    };
  };
  const context = new Context();
  const controller = new HotstreamController(context, {
    diagnosticsEnabled: false, auditRoot: '/unused-build-audit',
    storage: { inspect: () => null, probe: async () => { throw new Error('Build must not execute storage'); }, close: async () => {} },
  });
  let invocations;
  try {
    const binding = controller.typertRemote;
    invocations = remoteMethods(controller).map(remote => {
      const member = declaration.members.find(member => member.name === remote.method);
      if (member?.kind !== 'method' || remote.invocation.kind !== 'direct') throw new Error('Unsupported Hotstream Remote signature');
      if (binding.serviceKey !== service.key) throw new Error('Runtime binding differs from the public type model');
      const method = remote.exportName ?? remote.method;
      const id = `${pkg.name}#${binding.namespace}/${method}`;
      const signal=member.signature.parameters.find(parameter=>parameter.name==='signal');
      if(signal&&!(nodes.get(signal.type)?.kind==='reference'&&nodes.get(signal.type).target.kind==='standard'&&nodes.get(signal.type).target.name==='AbortSignal'))throw new Error('Cancellation parameter must use the public AbortSignal type');
      if(signal&&member.signature.parameters.at(-1)!==signal)throw new Error('Cancellation must be the final parameter');
      return {
        ...(remote.mode==='stream'?{mode:'stream'}:{}),...(signal?{cancellation:{parameter:'signal'}}:{}),
        id, service: service.key, namespace: binding.namespace, method,
        ...(method === remote.method ? {} : { implementation: remote.method }), invocation: { kind: 'direct' },
        parameters: member.signature.parameters.filter(parameter=>parameter!==signal).map(parameter => {
          if (parameter.optional || parameter.rest || parameter.receiver || parameter.binding !== 'identifier') throw new Error('Hotstream only admits explicit JSON parameters');
          return { name: parameter.name, wire: parameter.name, source: 'json', boundary: boundary(parameter.type, `${id}:${parameter.name}`) };
        }),
        result: boundary(unwrap(member.signature.returns,remote.mode), `${id}:result`), location: member.location,
      };
    });
  } finally { await controller.close(); await context.fiber.dispose(); }
  if (invocations.length < 3) throw new Error('Required diagnostic Remote definitions are missing');
  const modeled = { ...face, packages: face.packages.map(item => item === pkg ? { ...item, invocations } : item) };
  const artifact = new FaceModelEmitter(modeled).emit(pkg.name);
  if (artifact.remote === undefined) throw new Error('Strict Remote artifacts were not emitted');
  return [{ ...artifact, js:strictObjectCodecs(artifact.js),remote:{...artifact.remote,js:strictObjectCodecs(artifact.remote.js)},packageRoot: pkg.root }];
}
