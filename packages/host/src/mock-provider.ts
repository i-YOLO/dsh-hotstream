/** M0-only provider: deterministic in-process chunks, no network or billing. */
import { LlmAdapter, type GenerateOptions, type StreamChunk, type LlmResolvedModelInfo, type LlmModelInfo } from '@deepseek-ai/dsh-llm';
import type { Context } from '@deepseek-ai/cordis';

export const M0_PROVIDER = 'hotstream-m0';
export const M0_MODEL = 'integration-probe';
export const NEWS_FIXTURE_MODEL = 'news-fixture';

export class M0MockAdapter extends LlmAdapter {
  override async listModels(): Promise<readonly LlmModelInfo[]> {
    return [{ provider: M0_PROVIDER, id: M0_MODEL, name: 'Hotstream M0 simulated provider' },{provider:M0_PROVIDER,id:NEWS_FIXTURE_MODEL,name:'Hotstream news fixture (simulated, no billing)'}];
  }

  override async resolveModel(provider: string, model: string): Promise<LlmResolvedModelInfo> {
    if (provider !== M0_PROVIDER || ![M0_MODEL,NEWS_FIXTURE_MODEL].includes(model)) throw new Error('Diagnostic provider accepts its fixture routes only');
    return { provider, id: model, name: 'Hotstream M0 simulated provider' };
  }

  override async *stream(options: GenerateOptions): AsyncIterable<StreamChunk> {
    options.signal?.throwIfAborted();
    const text = options.model===NEWS_FIXTURE_MODEL?fixtureResponse(options):'HOTSTREAM_M0_AUDITED_RESPONSE';
    yield { type: 'block-start', index: 0, blockType: 'text' };
    yield { type: 'text-delta', index: 0, text };
    yield { type: 'block-end', index: 0, block: { type: 'text', text } };
    yield { type: 'usage', usage: { inputTokens: 8, outputTokens: 4 } };
    yield { type: 'finish', reason: { kind: 'stop' } };
  }
}

/** Explicit diagnostic route only. These outputs test transport and orchestration, not editorial quality. */
function fixtureResponse(options:GenerateOptions):string {
 const user=options.messages.flatMap(message=>message.content??[]).filter(block=>block.type==='text').map(block=>block.text).join('\n');
 let material=user;try{const decoded=JSON.parse(user);if(typeof decoded==='string')material=decoded;else if(Array.isArray(decoded.segments))return JSON.stringify({t:decoded.segments});}catch{/* Most upstream input builders use plain text. */}
 const title=material.match(/【标题】\s*([^\n]+)/)?.[1]??material.match(/标题：([^\n]+)/)?.[1]??'桌面测试事件';
 const body=material.split(/【正文[^】]*】/)[1]?.split('【材料质量】')[0]?.trim()??title;
 if(options.maxTokens===512)return JSON.stringify({label:'PASS',reason:'Explicit desktop fixture'});
 if(options.maxTokens===1024)return JSON.stringify({attentionScore:88});
 if(options.maxTokens===1600)return JSON.stringify({scope:'single',category:'ai-products',tags:['产品更新','Agent'],subjects:['openai'],fact:{title:title.slice(0,80),subject:'OpenAI',action:'更新',object:'桌面验收示例',occurredAt:null,evidence:body.slice(0,200),conditions:[]}});
 if(options.maxTokens===16384)return JSON.stringify({itemType:'product_launch',authorRole:'principal',tags:['产品更新','Agent'],editorialJudgment:'',titleZh:title,summaryZh:body.slice(0,600)});
 if(options.maxTokens===4096){const decisions=[...material.matchAll(/【候选 (C\d+)】/g)].map(match=>({id:match[1],relation:'UNRELATED',confidence:0.99,note:'Distinct fixture materials'}));return JSON.stringify({query:title,decisions,selection:{addsValue:true,reason:'Desktop fixture coverage'}});}
 if(options.maxTokens===2048||options.maxTokens===400)return JSON.stringify({a:'fixture A',b:'fixture B',relation:'UNRELATED',difference:'Distinct fixtures',confidence:0.99});
 if(options.maxTokens===1200)return JSON.stringify({title,digest:'桌面验收示例综述。以下内容由本地模拟模型生成，用于验证事件阅读、任务恢复与审计持久化。'});
 if(options.maxTokens===2500)return JSON.stringify({overview:'',sections:{}});
 return JSON.stringify({titleZh:title,summaryZh:body.slice(0,600),bodyZh:body});
}

/** @param ctx - declared llm consumer context; registration is fiber-owned. */
export function registerM0Provider(ctx: Context): void {
  ctx.llm.registerAdapter([M0_PROVIDER], new M0MockAdapter());
}
