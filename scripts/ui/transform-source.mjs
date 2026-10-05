import ts from 'typescript';
import {resolve,relative,dirname} from 'node:path';
export function sourceUiTransform(root){return {name:'hotstream-source-ui-classes',transform(code,id){if(!id.includes('/client/aihot/')||!id.endsWith('.tsx'))return null;
 const tree=ts.createSourceFile(id,code,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let used=false,localized=false;
 const result=ts.transform(tree,[context=>{const visit=node=>{
  if(ts.isJsxText(node)&&/[\u3400-\u9fff]/.test(node.text)){localized=true;return ts.factory.createJsxExpression(undefined,ts.factory.createCallExpression(ts.factory.createIdentifier('__hsContent'),undefined,[ts.factory.createStringLiteral(node.text.trim())]));}
  if(ts.isJsxExpression(node)&&node.expression&&!ts.isJsxAttribute(node.parent)&&!node.dotDotDotToken){localized=true;return ts.factory.updateJsxExpression(node,ts.factory.createCallExpression(ts.factory.createIdentifier('__hsContent'),undefined,[ts.visitNode(node.expression,visit)]));}
  if(ts.isJsxAttribute(node)&&['title','aria-label','placeholder','label'].includes(node.name.getText(tree))&&node.initializer){const value=ts.isStringLiteral(node.initializer)?node.initializer:ts.isJsxExpression(node.initializer)?node.initializer.expression:undefined;if(value){localized=true;return ts.factory.updateJsxAttribute(node,node.name,ts.factory.createJsxExpression(undefined,ts.factory.createCallExpression(ts.factory.createIdentifier('__hsContent'),undefined,[ts.visitNode(value,visit)])));}}

  if(ts.isJsxAttribute(node)&&node.name.getText(tree)==='className'&&node.initializer){let value=ts.isStringLiteral(node.initializer)?node.initializer:ts.isJsxExpression(node.initializer)?node.initializer.expression:undefined;if(value){used=true;return ts.factory.updateJsxAttribute(node,node.name,ts.factory.createJsxExpression(undefined,ts.factory.createCallExpression(ts.factory.createIdentifier('__hsClasses'),undefined,[ts.visitNode(value,visit)])));}}
  return ts.visitEachChild(node,visit,context);
 };return node=>ts.visitNode(node,visit);}]);
 let output=ts.createPrinter().printFile(result.transformed[0]);result.dispose();if(!used&&!localized)return null;
 let path=relative(dirname(id),resolve(root,'packages/client/src/client/aihot/native/style.ts')).replaceAll('\\','/');if(!path.startsWith('.'))path='./'+path;
 const locale=path.replace('style.ts','locale.ts');return {code:`import {cx as __hsClasses} from ${JSON.stringify(path)};\nimport {uiContent as __hsContent} from ${JSON.stringify(locale)};\n`+output,map:null};}};}
