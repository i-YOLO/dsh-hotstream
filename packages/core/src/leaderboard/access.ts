export interface ModelAccess {domestic:boolean;weightsUrl:string|null;}
const weights={"verifiedOn":"2026-09-30","note":"\u5b98\u65b9\u6a21\u578b\u4ed3\u5e93\u53ca\u6743\u91cd\u6587\u4ef6\u5df2\u6838\u9a8c\uff1b\u53ea\u6309\u660e\u786e\u6a21\u578b\u8eab\u4efd\u767b\u8bb0\uff0c\u4e0d\u628a\u540c\u5382\u5546\u3001\u84b8\u998f\u7248\u6216 RL/MOPD \u7b49\u53e6\u4e00\u4e2a\u68c0\u67e5\u70b9\u63a8\u5b9a\u4e3a\u540c\u4e00\u578b\u53f7\u3002\u5f00\u653e\u6743\u91cd\u4e0d\u7b49\u4e8e\u65e0\u6761\u4ef6\u5546\u7528\u3002","models":{"deepseek-v-3-2":"deepseek-ai/DeepSeek-V3.2","deepseek-v-4-1-flash":"deepseek-ai/DeepSeek-V4.1-Flash","deepseek-v-4-flash-20260731":"deepseek-ai/DeepSeek-V4-Flash-0731","deepseek-v-4-flash-preview":"deepseek-ai/DeepSeek-V4-Flash","deepseek-v-4-pro-20260813":"deepseek-ai/DeepSeek-V4-Pro-0813","deepseek-v-4-pro-preview":"deepseek-ai/DeepSeek-V4-Pro","gemma-4-31-b-it":"google/gemma-4-31B-it","glm-4-6":"zai-org/GLM-4.6","glm-4-7":"zai-org/GLM-4.7","glm-4-7-flash":"zai-org/GLM-4.7-Flash","glm-5":"zai-org/GLM-5","glm-5-1":"zai-org/GLM-5.1","glm-5-2":"zai-org/GLM-5.2","glm-5-3":"zai-org/GLM-5.3","glm-5-3-flash":"zai-org/GLM-5.3-Flash","gpt-oss-120-b":"openai/gpt-oss-120b","gpt-oss-20-b":"openai/gpt-oss-20b","inkling":"thinkingmachines/Inkling","inkling-small":"thinkingmachines/Inkling-Small","kimi-k-2-5":"moonshotai/Kimi-K2.5","kimi-k-2-6":"moonshotai/Kimi-K2.6","kimi-k-2-7-code":"moonshotai/Kimi-K2.7-Code","kimi-k-3":"moonshotai/Kimi-K3","mimo-v-2-5":"XiaomiMiMo/MiMo-V2.5","mimo-v-2-5-pro":"XiaomiMiMo/MiMo-V2.5-Pro","minimax-m-3":"MiniMaxAI/MiniMax-M3","mistral-medium-3-5":"mistralai/Mistral-Medium-3.5-128B","nemotron-3-ultra-550-b-a-55-b":"nvidia/NVIDIA-Nemotron-3-Ultra-550B-A55B-BF16","qwen-3-14-b":"Qwen/Qwen3-14B","qwen-3-235-b-a-22-b-2507":"Qwen/Qwen3-235B-A22B-Thinking-2507","qwen-3-30-b-a-3-b":"Qwen/Qwen3-30B-A3B","qwen-3-32-b":"Qwen/Qwen3-32B","qwen-3-4-b":"Qwen/Qwen3-4B","qwen-3-5-122-b-a-10-b":"Qwen/Qwen3.5-122B-A10B","qwen-3-5-27-b":"Qwen/Qwen3.5-27B","qwen-3-5-35-b-a-3-b":"Qwen/Qwen3.5-35B-A3B","qwen-3-5-397-b-a-17-b":"Qwen/Qwen3.5-397B-A17B","qwen-3-6-27-b":"Qwen/Qwen3.6-27B","qwen-3-8-27-b":"Qwen/Qwen3.8-27B"}};
import { providerSlugOf } from "./providers.ts";
const BOARD_LIMIT=30;

// This describes the developer, not the reader's network, account or an API reseller.
const DOMESTIC_PROVIDERS = new Set(["alibaba", "deepseek", "moonshot", "xiaomi", "z-ai", "minimax", "baidu", "tencent", "bytedance", "stepfun", "meituan", "inclusionai", "iflytek"]);

const DOMESTIC_NAMES = new Set(["ant-group", "china mobile", "kuaishou"]);

export function modelAccess(model: { slug: string; name: string; provider_slug: string | null; provider: string | null }): ModelAccess {
  const repository = (weights.models as Record<string, string>)[model.slug];
  return {
    domestic: DOMESTIC_PROVIDERS.has(providerSlugOf(model) ?? "") || DOMESTIC_NAMES.has(model.provider?.trim().toLowerCase() ?? ""),
    weightsUrl: repository ? `https://huggingface.co/${repository}` : null,
  };
}

/** Filter the existing ranking before taking 30; no recomputation or renumbering. */
export function boardSubset<T extends { rank: number; access: ModelAccess }>(entries: T[], domestic = false, openWeights = false): T[] {
  return entries.filter((e) => (!domestic || e.access.domestic) && (!openWeights || !!e.access.weightsUrl)).slice(0, BOARD_LIMIT);
}
