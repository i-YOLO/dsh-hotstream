import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {richBody} from '../../packages/client/lib/types/client/rich-body.js';
import {renderBodyNodes} from '../../packages/client/lib/types/client/body-view.js';
const client=createRequire(new URL('../../packages/client/package.json',import.meta.url)),host=createRequire(new URL('../../packages/host/package.json',import.meta.url));
const {createElement}=await import(client.resolve('react')),{renderToStaticMarkup}=await import(client.resolve('react-dom/server')),{DOMParser}=await import(host.resolve('linkedom'));
describe('native article body rendering',()=>{
 it('renders source line breaks and rules without crashing the React reading panel',()=>{globalThis.DOMParser=DOMParser;try{const nodes=richBody('<p>First line<br>Second line</p><hr><table><tbody><tr><td>A<br>B</td></tr></tbody></table>','https://example.com/news');const html=renderToStaticMarkup(createElement('article',null,...renderBodyNodes(nodes)));expect(html).toContain('First line<br/>Second line');expect(html).toContain('<hr/>');expect(html).toContain('<td>A<br/>B</td>');}finally{delete globalThis.DOMParser;}});
});
