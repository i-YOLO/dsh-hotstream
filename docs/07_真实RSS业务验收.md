# 真实 RSS 与内置模型业务验收记录

执行日期：2026-10-04。用户已明确要求使用本机正式 `/Applications/DeepSeek Harness.app`（官方 `0.2.0-rc.2` / Node `24.18.1`），并取消原 30 次真实模型测试上限。当前插件库位于 `~/.dsh/data/hotstream`；仅迁入先前已抓取的插件新闻库与辅助审计，没有读取宿主私有数据库或改动用户的聊天模型。

## 当前真实执行

18 个公开 RSS 的 144 条候选已在正式桌面完成真实处理：140 条可阅读、35 条达到原门槛进入精选、4 条被预筛拦截；共有 25 个可见真实事件（库内另保留 3 个旧模拟事件）。保留 3 条已撤回的旧模拟材料及其 23 次模拟审计，均不计入真实结果。

固定使用 DSH 内置 `deepseek-account / deepseek-flash`（DeepSeek-V41-Flash，新闻处理 reasoning off）。累计 **786 次真实调用**，包含此前 23 次和此次追加 763 次；所有调用均为 attempt 1，已完成响应落盘与辅助 Session 审计。其他付费采集为 0。真实 usage 总计 inputTokens 1,412,848、cacheReadTokens 1,662,703、outputTokens 89,734；账号实际扣费没有由 DSH usage 提供，不将折算价格当成账单。

原预算默认值与来源级别/门槛不变；本机真实测试设置按用户授权提升模型调用预算，付费采集预算为 0。模型榜、监控及 External 关闭。当前自动采集关闭；已处理完这批候选，没有继续抓取整站或后台派发未决任务。

| 真实样本 | 来源时间（北京时间） | 独立双分 / 均值 | 实际结果 |
|---|---|---|---|
| [NVIDIA DGX Spark 64GB](https://blogs.nvidia.com/blog/local-ai-dgx-spark-64gb-sync/) | 10-02 21:00:39 | 62 / 62 / 62 | T1=60，通过精选及事件归组 |
| [ThinkingBox](https://huggingface.co/blog/microsoft/thinkingbox) | 10-04 06:56:48 | 71 / 71 / 71 | T1=60，通过精选及事件归组 |
| [BootLoops](https://the-decoder.com/open-source-bootloops-harness-supports-ai-models-in-performing-precise-scientific-calculations/) | 10-03 17:19:23 | 71 / 71 / 71 | 可阅读并归组，未达到 T2=76 |

三个样本都经过真实预筛、两次评分、结构化和中文理解/摘要。两个评分请求分别有独立回执，只有一个用户材料消息；去除各请求自身消息 ID 后，输入和系统提示相同，第二次没有第一次的模型答案。逐 attempt 请求、响应、usage、hash 与审计引用按需由实际 Gateway 读取，保存于 `artifacts/official-live/real-business-evidence.json`。

## 真实数据发现与修复

NVIDIA 公司主题曾错误显示零条。已按锁定上游补齐 Publication 的 `entity:` 主体标签和多公司标题归属规则，人工标签保持优先。迁移 013 修复已有投影；早先全库归属检查从 0 恢复为 10 条，其中 5 条是主题页所用的精选代表报道。公司主题同时兼容旧显示名配置，主题页不混入无关原始候选。首次回执未写入任务关联的问题同时修复；迁移 014 按完整既有身份补齐 809 条历史关联，不重新派发模型。

真实库快照迁移保持 147 篇、全部 809 次真实/历史模拟回执、用户标记、配置、请求/响应摘要 hash 及 001–012 checksum 不变，记录于 `artifacts/official-live/real-data-upgrade.json`。构建和类型检查通过；本阶段按用户要求以真实数据与正式 Desktop 功能执行为主，不扩大模拟测试。

正式精选截图为 `artifacts/official-live/selected-real.png`，候选与处理中截图为 `real-rss-running.png`。ThinkingBox 已在正式桌面实际收藏，讨论打开新会话并预填，未发送；截图为 `real-discussion-alpha9.jpg`。后续截图及停启检查以 `artifacts/official-live` 实际记录为准；macOS 后台窗口缩略图不当作页面验收截图。

## 最新正式桌面功能回读

NVIDIA / ThinkingBox / BootLoops 的收藏已逐一保存。ThinkingBox 的正式新会话预填见 `real-discussion-alpha9.jpg`；诊断忙碌锁修复后，NVIDIA 与 BootLoops 的新会话预填见 `nvidia-discussion-alpha11.jpg`、`bootloops-discussion-alpha11.jpg`，全部保持未发送。BootLoops 在全部动态和搜索中可阅读，候选明确显示“未进入精选”，没有降低 T2 门槛。

主题实际恢复为 NVIDIA 的 5 条精选代表报道，截图 `nvidia-topic-alpha10.jpg`；原始候选没有混入主题页。停用后入口撤销，再启用并重新打开后，一条 watch、一个 SQLite Worker 和一个业务 timer 恢复，内容与调用总数保留，见 `ui-reactivation-alpha10.json`。相同版本预构建 tgz 更新采用正式桌面的正常退出/启动刷新 Client，旧截图缩略图或与 AX 不一致的帧不作为通过证据。

最后安装快照为 `artifacts/official-live/native-live-alpha2-14.tgz`。正式库最终回读见 `real-business-evidence.json`；最终停用入口撤销、再启用、watch / Worker / timer 恢复及数据保留见 `ui-reactivation-alpha13.json`。重连后的 ThinkingBox 草稿 AX 记录为 `thinkingbox-discussion-alpha13.ax.txt`，其截图只得到后台缩略图，不计作完整页面截图；完整实际讨论截图仍使用已注明版本的 alpha9 / alpha11 记录。最后类型检查/构建见 `final-build.log`，包内闭包检查见 `package-closure-alpha14.json`。另一次正式 Host 免费 TechCrunch RSS 试抓返回 20 条，明确未提交、未付费，原 144 条已在热点库；见 `free-rss-preview.json`。

## 保留限制

- 首次导入不制造当前热度或实时刊期。用户要求补齐报告后，已显式补编 16 期真实历史日报、7 期周报、3 期月报，新增 10 次真实内置 Flash 导读调用；累计真实调用 796 次。全部报告显示抓取覆盖不完整，实际记录见 `11_真实报告验收.md` 与 `artifacts/reports-live/official-compilation.json`。上面 786 次与 alpha14 属于报告补编前的快照。
- 默认来源保持摘要许可，因此这批新闻没有被强行开放全文或全文翻译。原有完整全文/图片/分块翻译的模拟验证与真实模型效果分开。
- 早先综述里“公司没有回应”的推断仍是质量未通过项，保存原响应并回退到来源摘要。抽查三个新样本不代表其余 140 条的人工质量审查全部通过。
- 真实 X、公众号等付费采集、默认关闭模块的真实服务、Windows x64、物理休眠/全盘写满及大库聊天 UI 压力仍未执行。原始 57 项规格不批量改状态。

## 先前隔离阶段的历史记录

以下 23/30 上限、暂停状态、隔离 Home 和 M0 聊天模型说明均属于此前阶段，已被用户的新授权及上面的正式桌面执行状态取代。

## 数据与授权

18 个默认公开 RSS 的 144 条实抓候选已复用并进入当前桌面使用的插件热点库。界面在“全部动态”展示来源、原标题、发布时间、原文链接、正文材料和归组状态；未编辑候选仍与 Publication 阅读投影分开。旧模拟源隔离后不可进入真实阅读与归组，收藏只保留撤回标识。

用户明确授权本轮额外累计最多 30 次真实模型调用，所有重试计入上限。固定使用 DSH 账号内置 `deepseek-account / deepseek-flash`（DeepSeek-V41-Flash），未更换模型或启用其他付费采集服务。授权计数在 SQLite 中持久化，并与文章范围、模型和每次 attempt 关联，跨重启、滚动预算和清空仍保留。

最终使用 **23 / 30** 次真实调用，实际派发重试 0 次，其他付费采集 0 次。剩余 7 次未使用，后续编辑处理已经暂停。SDK usage 为未缓存输入 28,875、缓存读取 26,367、输出 2,833 tokens。按当天公布的空闲时段 API 价格折算约 **0.0407 元**；这不是测得的账号费用，实际账号扣费或额度变化没有通过 usage 回执提供。[官方价格](https://api-docs.deepseek.com/zh-cn/quick_start/pricing/)

## 三条样本

| 来源 | 原始报道 | 发布时间（北京时间） | 两次评分 / 均值 | 结果 |
|---|---|---|---|---|
| TechCrunch · AI | [OpenAI safety employee resigns, claiming the company’s ‘culture is broken’](https://techcrunch.com/2026/10/03/openai-safety-employee-resigns-claiming-the-companys-culture-is-broken/) | 10-04 00:30:01 | 58 / 62 / 60 | 可阅读，未入精选 |
| The Verge · AI | [An OpenAI safety employee has quit and is sounding the alarm](https://www.theverge.com/ai-artificial-intelligence/1004408/openai-safety-quits-sounding-the-alarm) | 10-03 22:31:56 | 58 / 62 / 60 | 可阅读，未入精选 |
| The Decoder | [Another OpenAI safety departure adds to a pattern of researchers leaving with public warnings](https://the-decoder.com/another-openai-safety-departure-adds-to-a-pattern-of-researchers-leaving-with-public-warnings/) | 10-03 22:01:14 | 58 / 58 / 58 | 可阅读，未入精选 |

实际原文抓取成功，材料修订推进至 2。三条均通过预筛并完成结构化、中文摘要、自动归组及独立关系复核，归入同一 Fact / Story。两次评分的原文输入相同，第二次不包含第一次结果；六个独立回执和完整请求已保存。

媒体源门槛仍为 76。三条均未达到门槛，因此没有强制进入精选，也没有将这一结果记成“精选入选验收通过”。全文展示继续服从来源许可，本轮讨论只预填当前允许的摘要等素材。

## 执行与修复

| 项目 | 实际结果与证据 |
|---|---|
| 当前热点库候选展示 | 144 条真实候选，18 来源；`artifacts/mac-native/real-rss-inbox.json` 和 `real-rss-candidates.png` |
| 编辑与双评分 | 真实模型完成；`real-model-evidence.json` 包含逐 attempt 请求、响应、usage、审计引用和双分输入对照 |
| Article → Fact → Story | 三源同事实、同事件；Fact `1b22db81-42f7-4363-8edc-f7cfa4e6f04b`，Story `19d0e613-981e-4e40-b0f3-2313772271ef` |
| 收藏 | 实际点击、保存和收藏页读回；`real-bookmark.png` |
| 讨论 | 实际新会话预填真实标题、来源、摘要、链接；发送次数 0，模型计数保持 23；`real-discussion-draft.png` |
| 频闪 | 原因是暂停源的到期时间驱动空循环及无变化操作增加数据版本。已修调度、变更通知和静默刷新，空闲版本 15 秒不变 |
| 阅读入口 | 已编辑的三篇内容置于原始候选区之前；`real-reading-fixed.png` |
| 时间线 | 原顺序未按发布时间排列，已按时间排序；`real-reading-fix-evidence.json` / `real-event-fixed.png` |
| 模型综述质量 | 原输出声称现有报道未呈现公司回应，然而 TechCrunch 原文有发言人回应。此结论未通过校验，阅读投影按保存摘要回退，明确标注；原始付费输出仍保留 |
| 自动检查 | 官方内置 Node 下 64 项测试通过，构建、类型检查与包内相对模块/Worker 闭包检查通过 |

所有证据均为本地文件，不上传、发布或推送。当前截图中聊天输入框的独立默认模型仍是 M0 诊断模型；它不参与这 23 次真实新闻编辑，并且预填后没有发送消息。

## 未通过与未执行

- 三篇未入精选是评分门禁的实际结果，不改低门槛、不人工强制入选。
- 原模型综述的“尚无回应”结论未通过证据校验，已经投影回退；不把其流畅文字作为质量通过证据。
- 日报/周报/月报、主题大事记、全部可选模块、全面故障注入及十轮桌面资源验收仍属于原开发方案的后续工作。
- Windows x64 官方桌面正式发布门禁仍未执行。
- 本轮使用账号内置模型，实际账号费用/额度扣除尚无独立账务证据；只报告 usage 与 API 价格折算。

下一阶段继续原完整 v1 方案，保持真实调用累计上限和剩余调用不自动使用。

## 最后候选回读

alpha2-7 的实际 Gateway 回读、逐 attempt 按需审计、调用上限和资源计数见 `artifacts/mac-native/final-gateway-evidence.json`。最后版本十轮停启见 `final-lifecycle-10-cycles.json`。最新真实界面截图尚未取得：Cua 在窗口变化后反复 screen capture failed / timeout；成功的 `upgrade-alpha2-5-reading.png` 是 alpha2-5 的真实桌面快照，不冒充最后版本截图。为排除同 bundle ID 定位冲突创建了仅测试用身份副本，后来使用 ad-hoc 签名；变更和 hash 在 `test-app-identity.json`。官方签名 Node、Gateway、生命周期证据与该截图定位实验分开。原应用和 Home 未改。
