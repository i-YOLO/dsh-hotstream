/** Bounded view-owned media reads; queued cancellation never starts network work. */
export class ImageReadQueue {
 private active=0;
 private closed=false;
 private readonly waiting:Array<{start:()=>void;cancel:()=>void}>=[];
 constructor(private readonly limit=2){}
 run<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T>{
  return new Promise<T>((resolve,reject)=>{
   if(this.closed||signal.aborted){reject(signal.reason??new DOMException('Image reader closed','AbortError'));return;}
   const cancel=()=>{const index=this.waiting.indexOf(task);if(index>=0)this.waiting.splice(index,1);signal.removeEventListener('abort',cancel);reject(signal.reason??new DOMException('Image read cancelled','AbortError'));};
   const task={cancel,start:()=>{signal.removeEventListener('abort',cancel);this.active++;void Promise.resolve().then(()=>{signal.throwIfAborted();return work();}).then(resolve,reject).finally(()=>{this.active--;this.pump();});}};
   signal.addEventListener('abort',cancel,{once:true});this.waiting.push(task);this.pump();
  });
 }
 private pump(){while(!this.closed&&this.active<this.limit){const task=this.waiting.shift();if(!task)break;task.start();}}
 close(){this.closed=true;for(const task of [...this.waiting])task.cancel();}
}
