/** Render only the parser's inert nodes. Void elements must never receive a child. */
import {createElement,Fragment,type ReactNode} from 'react';
import type {BodyNode} from './rich-body.ts';
export function renderBodyNodes(nodes:BodyNode[],image?:(index:number)=>ReactNode):ReactNode[]{
 return nodes.map((node,key)=>{
  if('text'in node)return node.text;
  if(node.mediaIndex!==undefined)return createElement(Fragment,{key},image?.(node.mediaIndex)??null);
  const props={key,...node.id?{id:node.id,style:{scrollMarginTop:24}}:{},...node.tag==='a'?{href:node.href??undefined,target:'_blank',rel:'noopener noreferrer'}:{}};
  return node.tag==='br'||node.tag==='hr'?createElement(node.tag,props):createElement(node.tag,props,...renderBodyNodes(node.children,image));
 });
}
