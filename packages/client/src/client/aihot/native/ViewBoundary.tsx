/** One unreadable page must not remove the native navigation or leave the whole panel blank. */
import {Component,type ReactNode} from 'react';
import {Button} from '@deepseek-ai/dsh-client-ui-primitives';
import {useNative} from './context.tsx';
interface Props {children:ReactNode;resetKey:string;back:()=>void;retry:()=>void;text:(value:string)=>string;}
class Boundary extends Component<Props,{error:string|null}>{
 override state:{error:string|null}={error:null};
 static getDerivedStateFromError(error:unknown){return {error:error instanceof Error?error.message:String(error)};}
 override componentDidUpdate(previous:Props){if(previous.resetKey!==this.props.resetKey&&this.state.error)this.setState({error:null});}
 override render(){if(!this.state.error)return this.props.children;const {text}=this.props;return <section className="card p-6" role="alert"><h2 className="text-[18px] font-semibold">{text('这页内容暂时无法显示')}</h2><p className="mt-3 text-[14px] text-ink-3">{text('你可以刷新当前页面，或返回精选继续阅读。')}</p><div className="mt-5 flex gap-3"><Button onClick={this.props.back}>{text('返回阅读')}</Button><Button variant="ghost" onClick={()=>{this.setState({error:null});this.props.retry();}}>{text('刷新')}</Button></div><details className="mt-5 text-[12px] text-ink-4"><summary>{text('错误详情')}</summary><p>{this.state.error}</p></details></section>;}
}
export function ViewBoundary({children}:{children:ReactNode}){const {state,face,text}=useNative();return <Boundary resetKey={state.routeKey+':'+(state.detail?.revision??0)} back={()=>face.navigateUrl('/')} retry={face.loadNews} text={text}>{children}</Boundary>;}
