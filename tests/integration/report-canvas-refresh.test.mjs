import {afterAll,afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {createRequire} from 'node:module';
const client=createRequire(new URL('../../packages/client/package.json',import.meta.url));
const host=createRequire(new URL('../../packages/host/package.json',import.meta.url));
const {parseHTML}=await import(host.resolve('linkedom'));
const {window}=parseHTML('<!doctype html><html><body></body></html>');
window.location=new URL('https://hotstream.test/');
vi.stubGlobal('window',window);vi.stubGlobal('document',window.document);vi.stubGlobal('navigator',window.navigator);vi.stubGlobal('HTMLElement',window.HTMLElement);vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT',true);
const {createElement,act}=await import(client.resolve('react'));
const {createRoot}=await import(client.resolve('react-dom/client'));
const navigation=vi.hoisted(()=>({current:()=>{}}));
vi.mock('../../packages/client/lib/types/client/aihot/native/navigation.js',()=>({useNavigate:()=>(...args)=>navigation.current(...args)}));
const {IssueDots}=await import('../../packages/client/lib/types/client/aihot/features/report/IssueDots.js');
const {periodGrid}=await import('../../packages/client/lib/types/client/aihot/features/report/format.js');
let root,container,clock,queue,nextFrame,resets,frames,currentFrame,observers;
const flushFrame=(elapsed=0)=>{clock+=elapsed;const scheduled=[...queue.values()];queue.clear();for(const callback of scheduled)callback(clock);};
const paint={setTransform(){},clearRect(){currentFrame=[];frames.push(currentFrame);},beginPath(){},arc(...args){currentFrame.push(args);},fill(){},stroke(){}};
const theme={getPropertyValue:name=>({'--ink':'#202a30','--accent':'#176b75','--line-strong':'#d1d9d5'}[name]??'')};
class Observer{constructor(callback){this.callback=callback;this.active=false;observers.push(this);}observe(){this.active=true;}disconnect(){this.active=false;}}
beforeEach(()=>{
 clock=1000;queue=new Map();nextFrame=0;resets=0;frames=[];observers=[];
 vi.spyOn(performance,'now').mockImplementation(()=>clock);
 vi.stubGlobal('requestAnimationFrame',callback=>{const id=++nextFrame;queue.set(id,callback);return id;});vi.stubGlobal('cancelAnimationFrame',id=>queue.delete(id));
 vi.stubGlobal('matchMedia',()=>({matches:false,addEventListener(){},removeEventListener(){}}));vi.stubGlobal('getComputedStyle',()=>theme);
 vi.stubGlobal('ResizeObserver',Observer);vi.stubGlobal('MutationObserver',Observer);
 Object.defineProperty(window.HTMLCanvasElement.prototype,'clientWidth',{configurable:true,get(){return 140;}});
 Object.defineProperty(window.HTMLCanvasElement.prototype,'width',{configurable:true,get(){return this._width??0;},set(value){this._width=value;resets++;}});
 Object.defineProperty(window.HTMLCanvasElement.prototype,'height',{configurable:true,get(){return this._height??0;},set(value){this._height=value;}});
 window.HTMLCanvasElement.prototype.getContext=()=>paint;
 window.HTMLCanvasElement.prototype.getBoundingClientRect=()=>({left:0,top:0,width:140,height:100});
 container=document.createElement('div');document.body.append(container);root=createRoot(container);
});
afterEach(async()=>{await act(async()=>root.unmount());container.remove();expect(queue.size).toBe(0);expect(observers.every(observer=>!observer.active)).toBe(true);vi.restoreAllMocks();});
afterAll(()=>vi.unstubAllGlobals());
const cases=[['daily','2026-10-01','2026-10-02'],['weekly','2026-W40','2026-W41'],['monthly','2026-10','2026-11']];

describe('report date calendar refresh stability',()=>{
 for(const [kind,reportKey,nextKey] of cases)it(`${kind}: preserves a painted calendar across background updates and keeps newly available issues clickable`,async()=>{
  const index=[{key:reportKey,issueNumber:13}];const render=async current=>act(async()=>root.render(createElement(IssueDots,{kind,reportKey,issueNumber:13,index:current})));
  await render(index);flushFrame(1000);const canvas=container.querySelector('canvas'),bufferResets=resets,finished=structuredClone(frames.at(-1));
  expect(finished.length).toBeGreaterThan(10);
  for(let update=0;update<8;update++){navigation.current=vi.fn();await render(index.map(row=>({...row})));flushFrame();expect(container.querySelector('canvas')).toBe(canvas);expect(resets).toBe(bufferResets);expect(frames.at(-1)).toEqual(finished);expect(queue.size).toBe(0);}
  const navigate=vi.fn();navigation.current=navigate;const updated=[{key:nextKey,issueNumber:14},...index];await render(updated);flushFrame();expect(resets).toBe(bufferResets);expect(frames.at(-1).length).toBe(finished.length);expect(queue.size).toBe(0);
  const grid=periodGrid(kind,reportKey,updated,13),at=grid.cells.findIndex(cell=>cell.key===nextKey),event=new window.Event('click');Object.assign(event,{clientX:(at%grid.columns+.5)*140/grid.columns,clientY:(Math.floor(at/grid.columns)+.5)*20});canvas.dispatchEvent(event);expect(navigate).toHaveBeenCalledWith(`/${kind}/${nextKey}`);
 });
 it('redraws a genuine issue change and disposes the prior animation resources',async()=>{
  const index=[{key:'2026-10-01',issueNumber:13},{key:'2026-10-02',issueNumber:14}];
  await act(async()=>root.render(createElement(IssueDots,{kind:'daily',reportKey:index[0].key,issueNumber:13,index})));flushFrame(1000);const first=resets,priorObservers=[...observers];
  await act(async()=>root.render(createElement(IssueDots,{kind:'daily',reportKey:index[1].key,issueNumber:14,index})));expect(resets).toBe(first);expect(priorObservers.every(observer=>!observer.active)).toBe(true);flushFrame();expect(frames.at(-1)).toEqual([]);expect(queue.size).toBe(1);flushFrame(1000);expect(queue.size).toBe(0);
 });
});
