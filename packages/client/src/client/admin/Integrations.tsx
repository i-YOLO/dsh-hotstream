import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {CredentialWriteRequest,OptionalModuleHealth} from 'dsh-hotstream-contracts';
import {Modal,Button,Field,Section} from './Controls.tsx';
import {translator,type AdminProps,type RegisterCredentialDraft} from './types.ts';
import styles from './Admin.module.css';

const services:[CredentialWriteRequest['service'],string,string][]=[
  ['socialdata','SocialData','https://socialdata.tools/'],['artificial-analysis','Artificial Analysis','https://artificialanalysis.ai/'],
  ['github','GitHub','https://github.com/settings/tokens'],['dajiala','大家啦',''],['jina','Jina Reader','https://jina.ai/reader/'],['embedding','Embedding',''],['external','External',''],
];
function CredentialCard({service,name,url,state,face,registerDraft,onDraftChange}:{service:CredentialWriteRequest['service'];name:string;url:string;registerDraft:RegisterCredentialDraft;onDraftChange:()=>void}&AdminProps){
  const tr=translator(face),[secret,setSecret]=useState(''),[busy,setBusy]=useState(false),[notice,setNotice]=useState(''),[remove,setRemove]=useState(false);
  const secretRef=useRef(''),alive=useRef(true),busyRef=useRef(false);
  const configured=state.credentials.items.find(item=>item.service===service)?.configured===true;
  const monitorRunning=service==='socialdata'&&state.runtime?.state.settings?.features.codexResetMonitor===true;
  const update=(value:string)=>{secretRef.current=value;setSecret(value);setNotice('');onDraftChange();};
  const save=async()=>{
    if(!secretRef.current.trim())return true;if(busyRef.current)return false;
    busyRef.current=true;setBusy(true);setNotice('');
    try{const ok=await face.saveCredential(service,secretRef.current);if(ok&&alive.current){update('');setNotice(tr('API Key 已保存，未启动采集。','API key saved. No collection was started.'));}return ok;}
    finally{busyRef.current=false;if(alive.current)setBusy(false);}
  };
  const saveRef=useRef(save);saveRef.current=save;
  useEffect(()=>{alive.current=true;const unregister=registerDraft(service,{isDirty:()=>!!secretRef.current,save:()=>saveRef.current(),discard:()=>{secretRef.current='';setSecret('');onDraftChange();}});return()=>{alive.current=false;secretRef.current='';unregister();};},[service,registerDraft]);
  return <div className={styles.section} data-credential-service={service}>
    <header className={styles.sectionHeader}><div><div className={styles.credentialHeading}><h2>{name}{service==='socialdata'?tr(' · Tibo 与 X 接入',' · Tibo and X'):''}</h2>{service==='socialdata'&&<a className={styles.officialLink} href={url} target="_blank" rel="noopener noreferrer" aria-label={tr('SocialData 官网（在新窗口打开）','SocialData website (opens in a new window)')}>{tr('SocialData 官网','SocialData website')} <span aria-hidden="true">↗</span></a>}</div><p>{tr('使用你自己的 API Key；应用只显示配置状态，不回显密钥。','Use your own API key. Saved secrets are never shown or returned.')}</p></div><span className={styles.status} data-state={configured?'saved':'unconfigured'}>{tr(configured?'已配置':'未配置',configured?'Configured':'Not configured')}</span></header>
    {monitorRunning&&<p className={styles.notice}>{tr('请先关闭并保存 Tibo 周期监控，再录入、更换或清除 SocialData Key。','Pause and save periodic Tibo monitoring before changing the SocialData key.')} <a href="#settings-modules">{tr('前往可选模块','Go to optional modules')}</a></p>}
    <div className={styles.credential}><Field label={`${name} API Key`} type="password" value={secret} onChange={update} disabled={busy||monitorRunning} placeholder={tr(configured?'输入新 Key 以更换':'粘贴你自己的 API Key',configured?'Enter a new key to replace it':'Paste your own API key')}/><div className={styles.actions}><Button disabled={busy||monitorRunning||!secret.trim()} onClick={()=>{void save();}}>{tr(busy?'保存中…':configured?'更换 Key':'保存 Key',busy?'Saving…':configured?'Replace key':'Save key')}</Button>{configured&&<Button variant="outline" disabled={busy||monitorRunning} onClick={()=>setRemove(true)}>{tr('清除','Remove')}</Button>}</div></div>
    {notice&&<p role="status" className={styles.muted}>{notice}</p>}
    <div className={styles.credentialLinks}>{url&&<a href={url} target="_blank" rel="noopener noreferrer">{tr('获取自己的 API Key','Get your own API key')}</a>}{service==='socialdata'&&<a href="https://docs.socialdata.tools/getting-started/pricing/" target="_blank" rel="noopener noreferrer">{tr('官方计费说明','Official pricing')}</a>}</div>
    {service==='socialdata'&&<p className={styles.muted}>{tr('搜索主要按返回条数计费，当前参考价为每 1,000 条 0.20 美元；余额与最终费用以 SocialData 为准。保存 Key 与启用监控分开操作。','Search is billed by returned results, currently listed at $0.20 per 1,000. SocialData controls your balance and final charges. Saving a key does not enable monitoring.')}</p>}
    <Modal open={remove} onClose={()=>setRemove(false)} title={tr(`清除 ${name} Key`,`Remove ${name} key`)} closeLabel={tr('关闭','Close')} description={tr('清除后保留历史数据，后续依赖此凭据的请求将不能继续。','History is retained. Requests that require this credential can no longer continue.')} footer={<div className={styles.dialogFooter}><Button variant="outline" onClick={()=>setRemove(false)}>{tr('取消','Cancel')}</Button><Button onClick={()=>{void face.deleteCredential(service).then(ok=>{if(ok){update('');setRemove(false);setNotice(tr('已清除 API Key。','API key removed.'));}});}}>{tr('确认清除','Remove key')}</Button></div>}/>
  </div>;
}
export function Integrations({state,face,registerDraft,onDraftChange}:AdminProps&{registerDraft:RegisterCredentialDraft;onDraftChange:()=>void}){
  const tr=translator(face);
  return <section id="settings-integrations" className={styles.sections}>
    <CredentialCard service="socialdata" name="SocialData" url="https://socialdata.tools/" state={state} face={face} registerDraft={registerDraft} onDraftChange={onDraftChange}/>
    <MonitorTestCard state={state} face={face}/>
    <details><summary>{tr('其他第三方服务凭据','Other service credentials')}</summary><div className={styles.sections}>{services.slice(1).map(([service,name,url])=><CredentialCard key={service} {...{service,name,url,state,face,registerDraft,onDraftChange}}/>)}</div></details>
  </section>;
}
export function MonitorTestCard({state,face}:AdminProps){
  const tr=translator(face),[confirm,setConfirm]=useState(false),test=state.monitorTest??state.moduleHealth?.monitor.latestTest;
  const configured=state.credentials.items.find(item=>item.service==='socialdata')?.configured===true,periodic=state.runtime?.state.settings?.features.codexResetMonitor===true;
  const paidBudget=state.runtime?.state.settings?.budgets.paidCollectorPerService;
  const budgetPaused=!paidBudget||Object.values(paidBudget).some(value=>value===0);
  const active=!!test&&['queued','running','retry_wait','blocked'].includes(test.state);
  const labels:Record<string,string>={queued:tr('等待执行','Queued'),running:tr('正在测试','Running'),succeeded:tr('测试完成','Completed'),failed:tr('测试失败','Failed'),cancelled:tr('已取消','Cancelled'),blocked:tr('等待处理','Blocked')};
  return <Section title={tr('Tibo 单次测试','One-time Tibo test')} description={tr('不启用周期监控。最多一页搜索、两次上下文补查、五条帖子识别；失败不自动重试。','Does not enable periodic monitoring. At most one search page, two context lookups and five recognitions; no automatic retries.')} actions={test?<span className={styles.status} data-state={test.state==='failed'?'failed':'saved'}>{labels[test.state]??test.state}</span>:undefined}>
    <p className={styles.muted}>{tr('会消耗 SocialData 余额和所选模型额度；不会充值或开启自动充值。只对真实原帖作判断，没有重置内容也会如实记录。','Uses SocialData credit and your selected model quota. It never deposits funds or enables auto top-ups. Posts without reset evidence remain non-events.')}</p>
    {periodic&&<p className={styles.notice}>{tr('先关闭并保存周期监控，再进行受限测试。','Pause and save periodic monitoring before running a limited test.')}</p>}
    {budgetPaused&&<p className={styles.notice}>{tr('付费采集预算已暂停。先在“预算与网络”中设置并保存本次测试允许的请求次数。','Paid collection is paused. Set and save request limits under Budget and network before this test.')} <a href="#settings-budgets">{tr('前往预算设置','Go to budget settings')}</a></p>}
    {!configured&&<p className={styles.notice}>{tr('请先在上方保存你自己的 SocialData API Key。','First save your own SocialData API key above.')}</p>}
    {test&&<><dl className={styles.testSummary}>{[[tr('搜索请求','Search requests'),`${test.searchRequests}/1`],[tr('上下文补查','Context lookups'),`${test.contextRequests}/2`],[tr('模型识别','Model requests'),`${test.modelRequests}/5`],[tr('采集费用','Collection cost'),test.cost===null?'—':`$${test.cost.toFixed(4)}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className={styles.muted}>{tr(`已保存 ${test.posts} 条原帖，识别 ${test.recognized} 条。${test.costBasis==='estimated'?'费用为按返回条数估算，最终以服务商账单为准。':''}`,`${test.posts} posts saved; ${test.recognized} recognized. ${test.costBasis==='estimated'?'Cost is estimated from returned results; verify the provider bill.':''}`)}</p>{test.error&&<p role="alert" className={styles.error}>{test.error}</p>}{test.results.length>0&&<ul>{test.results.map(row=><li key={row.postId}><a href={row.url} target="_blank" rel="noopener noreferrer">{row.postId}</a> · {tr(row.outcome==='no-reset'?'未发现重置':row.outcome==='needs-review'?'待核实':row.outcome==='event-evidence'?'存在事件证据':'相关动态',row.outcome)}</li>)}</ul>}{test.receiptIds.length>0&&<details><summary>{tr('查看本次调用回执','View test receipts')}</summary><div className={styles.actions}>{test.receiptIds.map(id=><Button variant="outline" key={id} onClick={()=>face.openCall(id)}>{id.slice(0,8)}</Button>)}</div></details>}</>}
    <div className={styles.actions}><Button disabled={!configured||periodic||budgetPaused||active||state.busy||state.settingsDraft?.dirty} onClick={()=>setConfirm(true)}>{tr(active?'测试执行中…':'开始单次测试',active?'Test in progress…':'Run one-time test')}</Button><Button variant="outline" onClick={face.loadNews}>{tr('刷新结果','Refresh results')}</Button></div>
    <Modal open={!!state.call&&!!test?.receiptIds.includes(state.call.id)} onClose={face.closeCall} title={tr('本次测试的调用回执','This test’s call receipt')} closeLabel={tr('关闭','Close')} footer={<Button variant="outline" onClick={face.closeCall}>{tr('关闭','Close')}</Button>}>
      {state.call&&<><p>{tr('回执编号','Receipt')}: {state.call.id}</p><p className={styles.muted}>{tr(`共 ${state.call.total} 次尝试；密钥与认证头不会展示。`,`${state.call.total} attempts. Keys and authorization headers are not displayed.`)}</p>{state.call.attempts.map(attempt=><section key={attempt.id}><p>{attempt.service} · {attempt.outcome??'—'} · {attempt.cost===null?'—':`${attempt.currency??''} ${attempt.cost}`}</p><p className={styles.muted}>{tr('费用依据','Cost basis')}: {attempt.costBasis}</p></section>)}</>}
    </Modal>
    <Modal open={confirm} onClose={()=>setConfirm(false)} title={tr('执行一次受限测试','Run a limited test')} closeLabel={tr('关闭','Close')} description={tr('使用你自己的 SocialData 余额，最多 3 次采集请求与 5 次模型请求。测试后保持周期监控暂停。','Uses your SocialData credit, up to 3 collection requests and 5 model requests. Periodic monitoring remains paused.')} footer={<div className={styles.dialogFooter}><Button variant="outline" onClick={()=>setConfirm(false)}>{tr('取消','Cancel')}</Button><Button onClick={()=>{setConfirm(false);void face.testMonitor();}}>{tr('执行本次测试','Run this test')}</Button></div>}/>
  </Section>;
}
export function HealthBanner({health,face,title,actions}:{health:OptionalModuleHealth|null|undefined;face:AdminProps['face'];title:string;actions?:ReactNode}){
  if(!health)return null;const tr=translator(face);
  const labels:Record<OptionalModuleHealth['status'],string>={disabled:tr('已暂停','Paused'),unconfigured:tr('尚未配置','Not configured'),queued:tr('等待更新','Queued'),running:tr('更新中','Updating'),partial:tr('部分来源可用','Partial coverage'),failed:tr('更新失败','Update failed'),'waiting-for-evidence':tr('成榜证据不足','Insufficient evidence'),ready:tr('数据就绪','Ready'),idle:tr('等待首次更新','Awaiting first update')};
  return <section className={styles.health} data-status={health.status} aria-label={title}><div><h2>{title} <span className={styles.status} data-state={health.status}>{labels[health.status]}</span></h2><p>{tr('最近成功更新','Last successful update')}：{health.lastSuccessAt?new Date(health.lastSuccessAt).toLocaleString(face.t('back')==='Back'?'en-US':'zh-CN',{timeZone:'Asia/Shanghai'}):tr('尚未完成','Not yet completed')}</p>{health.error&&<p className={styles.error}>{healthError(health.error,face)}</p>}{health.sources.some(source=>source.error)&&<details><summary>{tr('查看来源诊断','Source diagnostics')}</summary><ul className={styles.sourceErrors}>{health.sources.filter(source=>source.error).map(source=><li key={source.id}><strong>{source.id}</strong><span>{source.error}</span></li>)}</ul></details>}</div>{actions}</section>;
}

function healthError(message:string,face:AdminProps['face']):string {
  const tr=translator(face);
  if(message==='Monitor requires SocialData credential')return tr('尚未配置 SocialData API Key，请前往设置完成接入。',message);
  if(message==='SocialData request budget is paused')return tr('付费采集预算已暂停，请检查预算设置。',message);
  if(message==='All leaderboard sources failed')return tr('所有模型榜来源均更新失败，请展开来源诊断。',message);
  return message;
}
