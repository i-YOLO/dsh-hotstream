/** Pure module registration; DOM ownership starts and ends with one Cordis effect. */
const styles=new Map<string,string>();
export function defineStyle(id:string,css:string):void{styles.set(id,css);}
export function mountStyles():()=>void{
 const owned:HTMLStyleElement[]=[];
 for(const [id,css] of styles){
  const tag=[...document.querySelectorAll<HTMLStyleElement>('style[data-plugin="dsh-hotstream-client"]')].find(node=>(node.dataset.pluginCss??node.dataset.hotstreamStyle)===id)??document.createElement('style');
  tag.dataset.plugin='dsh-hotstream-client';tag.dataset.pluginCss=id;tag.dataset.hotstreamStyle=id;
  tag.dataset.hotstreamOwners=String(Number(tag.dataset.hotstreamOwners??0)+1);
  if(tag.textContent!==css)tag.textContent=css;if(!tag.isConnected)document.head.append(tag);owned.push(tag);
 }
 let disposed=false;return ()=>{if(disposed)return;disposed=true;for(const tag of owned){const remaining=Math.max(0,Number(tag.dataset.hotstreamOwners??1)-1);tag.dataset.hotstreamOwners=String(remaining);if(!remaining)tag.remove();}};
}
