import {describe,it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {transform} from 'lightningcss';
import {refreshTimelineWindow} from '../../packages/client/lib/types/client/timeline-refresh.js';
const response=(ids,cursor)=>({cards:ids.map(key=>({key,item:{id:key},anchorAt:'2026-10-04T00:00:00Z',group:null})),nextCursor:cursor,dayCounts:{'2026-10-04':ids.length},filters:{channel:'all',category:null,tag:null},hot:[]});
describe('reading windows and native responsive styles',()=>{
 it('revalidates later pages and removes withdrawn cards without discarding loaded depth',async()=>{
  const requested=[];const fresh=await refreshTimelineWindow(response(['new','first'],'next'),4,async cursor=>{requested.push(cursor);return response(['first','third','fourth'],null);},new AbortController().signal);
  expect(requested).toEqual(['next']);expect(fresh.cards.map(c=>c.key)).toEqual(['new','first','third','fourth']);expect(fresh.nextCursor).toBeNull();
 });
 it('drops a late background page when the reader navigates away',async()=>{const control=new AbortController();await expect(refreshTimelineWindow(response(['first'],'next'),3,async()=>{control.abort();return response(['late'],null);},control.signal)).rejects.toMatchObject({name:'AbortError'});});
 it('keeps one namespaced container across theme and layout CSS Modules',()=>{for(const path of ['packages/client/src/client/aihot/source.module.css','packages/client/src/client/aihot/native/Layout.module.css']){const css=transform({filename:path,code:readFileSync(path),cssModules:{container:false}}).code.toString();expect(css).toContain('@container dsh-hotstream');expect(css).not.toMatch(/@container \w+_dsh-hotstream/);}});
});
