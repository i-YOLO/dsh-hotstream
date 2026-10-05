# Hotstream · DSH 热点

[![MIT License](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Development](https://img.shields.io/badge/status-alpha.7-orange.svg)](docs/implementation-state.md)
[![DeepSeek Harness](https://img.shields.io/badge/DSH-0.2.0--rc.2-176b75.svg)](https://github.com/deepseek-ai/deepseek-harness)

运行在 **DeepSeek Harness Desktop** 内的 AI 资讯工作台：从信源采集、筛选评分、事件归并，到阅读、日报、模型榜和后台管理，在一个原生插件里完成。

项目基于 [AIHOT](https://github.com/KKKKhazix/AIHOT) 的界面与业务规则迁移，使用 DSH 的模型、凭据、会话、Slots 和 Remote 能力。业务数据保存在插件自己的 SQLite 中，安装使用不需要另起数据库或 Web 服务器。

**当前为开发预览版。** 已在 macOS 的 DSH `0.2.0-rc.2` 验证；Windows 与长期运行验收仍在进行。兼容性、完整验证范围见 [开发状态](docs/implementation-state.md)。

[安装](#安装) · [功能](#功能) · [界面截图](#界面截图) · [开发](#开发) · [反馈问题](https://github.com/i-YOLO/dsh-hotstream/issues)

## 功能

| 页面 / 模块 | 可以做什么 |
| --- | --- |
| 精选与全部 AI 动态 | 阅读资讯时间线，按类别与关键词查找；保留来源、发布时间、推荐理由与评分 |
| 文章阅读 | 查看导读、许可正文、原文与翻译、图片和目录；收藏、打开原文、准备 AI 讨论 |
| 热点、主题与事件 | 将相关报道归并到事件，查看热度、公司 / 主题动态和大事记 |
| 日报、周报、月报 | 按刊期浏览汇总与导读，支持显式补编已有历史材料，并标明覆盖不足 |
| 模型榜 | 综合、编程、推理、知识、专业办公五类榜单；查看证据覆盖、来源、模型详情与官方 API 价格 |
| Tibo / Codex 监控 | 阅读原帖和重置日历，区分预告、进展与完成；可手工核实，历史覆盖不足时保持统计未知 |
| 信源管理 | 管理 RSS、网页列表、JSON、X、公众号与 External 六类来源；编辑、启停和试抓预览 |
| 后台 | 查看内容、任务、模型调用、审计记录、人工修订与精选评测 |
| 设置 | 明确保存，离页保护；配置模型、运行开关、预算、并发、网络、第三方凭据和可选模块 |

### 处理与数据约定

- 采集 → 初筛 → 独立双评分 → 内容理解 / 翻译 → 事件归并 → 发布与汇总；模型调用统一经过 DSH LLM。
- 每次调用保留请求、响应、用量和审计关联，任务状态持久化；后台可查看失败原因和重试状态。
- 模型榜更新失败会保留上次有效数据。价格带核验日期与来源，人民币汇率随榜单冻结；缺少价格和缺少汇率分别显示。
- 阅读和“和 AI 讨论”不会自动发送消息。讨论先准备材料和草稿，由用户审阅后发送。
- 停用、卸载和退出应用保留数据；彻底退出应用期间不执行采集与处理。

## 界面截图

以下 13 张截图于 2026-10-05 从原生 macOS DSH 的全屏模式重新拍摄，收起了账号侧栏。数据、计数和连接状态代表拍摄时刻，不是预置内容或推荐配置。详见 [截图说明](docs/screenshots/README.md)。

### 精选首页

按时间线浏览精选资讯，查看推荐理由、分类、来源和热点。

![精选资讯时间线](docs/screenshots/selected.jpg)

<details>
<summary>查看热点榜与主题目录</summary>

![热点榜](docs/screenshots/hot.jpg)

![主题目录](docs/screenshots/topics.jpg)

</details>

### 文章阅读

导读、来源、正文 / 翻译、图片、标签与讨论入口。

![文章阅读](docs/screenshots/article.jpg)

### AI 日报

按日期浏览刊期、头条和来源，历史补编与覆盖范围明确标注。

![AI 日报](docs/screenshots/daily.jpg)

<details>
<summary>查看周报与月报</summary>

**周报**：按周汇总新闻与导读。

![AI 周报](docs/screenshots/weekly.jpg)

**月报**：按月查看主要事件和趋势。

![AI 月报](docs/screenshots/monthly.jpg)

</details>

### 模型榜

五类榜单、证据覆盖，以及缓存 / 输入 / 输出价格。报价是对应核验日期的标准 API 档位，截图中的金额不代表最新供应商报价。

![模型榜与价格](docs/screenshots/leaderboard.jpg)

<details>
<summary>查看监控、后台、信源编辑与设置</summary>

**Tibo 监控**：展示已保存原帖、重置日历及模块暂停状态；历史覆盖不足时统计保持未知。

![Tibo 监控](docs/screenshots/monitor.jpg)

**后台概览**：模块状态、记录数量与最近任务。

![后台概览](docs/screenshots/admin.jpg)

**信源管理**：查看来源状态、采集间隔，支持编辑、启停和试抓。

![信源管理](docs/screenshots/sources.jpg)

**信源编辑**：来源类型、地址、间隔、级别与正文许可。

![信源编辑](docs/screenshots/source-editor.jpg)

**设置**：预算、并发与网络，修改后统一保存。图中为开发验收配置，请按自己的额度设置。

![设置](docs/screenshots/settings.jpg)

</details>

## 安装

### 环境

- DeepSeek Harness Desktop **0.2.0-rc.2**。
- 构建源码需要 **Node.js 24.11+** 和 **pnpm 11.7.0**；本轮验证使用桌面内置 Node `24.18.1`。
- 插件使用你在 DSH 中配置的模型。新闻处理会消耗对应模型额度；第三方采集服务按其规则计费。

### 从源码生成安装包

```sh
git clone https://github.com/i-YOLO/dsh-hotstream.git
cd dsh-hotstream
pnpm install --frozen-lockfile
pnpm build
pnpm pack:bundle
```

生成的组合包位于：

```text
artifacts/candidate/dsh-hotstream-0.1.0-alpha.7.tgz
```

在 DSH 桌面的“插件”页面选择此本地安装包。组合包包含 Host、Client、Remote、Worker 和行业资源，无需逐个安装工作区包。

若已安装官方 `dsh` 命令，也可以：

```sh
dsh plugin --profile desktop add /absolute/path/to/dsh-hotstream-0.1.0-alpha.7.tgz
```

更新已有安装后，应完整退出并重新打开 DSH，让替换后的 JavaScript 模块生效。先暂停采集与新闻处理，等待当前任务结束，重开后恢复所需开关。

### 首次使用

1. 在 DSH 中配置可用模型，打开左侧火焰图标的“热点”入口。
2. 按页面提示初始化本地库；检查默认信源、处理模型、预算和并发。
3. 在设置里明确开启所需的采集与新闻处理，并点击保存。
4. 模型榜、Tibo 监控和 External 为可选模块，默认关闭，按需配置。

**仅安装和打开未初始化页面不会启动新闻采集或模型处理。** 默认带有 18 个 RSS 来源的配置，新闻内容由启用后的实际采集产生。

### 可选服务

| 服务 | 用途 | 说明 |
| --- | --- | --- |
| SocialData | X 来源、Tibo 原帖与上下文 | 在后台输入自己的 Key；保存 Key 与启动任务分开 |
| Artificial Analysis | 对应模型评测来源 | 缺少凭据时单独标为未配置，其他公开来源仍可更新 |
| HTTP 代理 | 部分公开来源的网络访问 | 可配置公开读取代理及 Arena 专用代理，不修改系统代理 |
| 向量服务 | 启用向量归并时的检索 | 需要显式配置服务、模型、维度和凭据 |

密钥使用 DSH Credentials 的插件命名空间存储，读取接口只返回配置状态。仓库不提供开发者 API Key。

## 开发

```sh
pnpm typecheck
pnpm test
pnpm build
pnpm pack:bundle
```

最近一次目标 Node 全套回归：**33 个测试文件、151 项通过**。静态检查、模拟提供方测试和原生桌面验收分别记录；源码测试通过不等于所有平台发布门禁已通过。

```text
packages/
  bundle/          DSH 组合包与 Cordis 配置
  client/          原生界面、状态控制与主题
  contracts/       公共 DTO、设置与存储协议
  core/            业务规则与计算逻辑
  host/            采集、模型调用、调度与模块运行
  storage-sqlite/  迁移、持久任务和 SQLite Worker
industry/ai/      信源、提示词、模型名录与价格种子
scripts/          构建、打包与校验
specs/            行为规格与验收要求
tests/            回归测试与隔离样本
upstream/         上游锁定版本、文件映射与许可
docs/             架构、决策、验收记录和截图
```

运行数据位于当前 DSH Home 的 `data/hotstream/`，默认是 `~/.dsh/data/hotstream/`。数据库、缓存、日志、本机安装诊断和凭据不提交到仓库。开发验收文档中引用的 `artifacts/` 为本地证据目录。

- [产品范围](docs/01_PRD.md)
- [技术架构](docs/02_技术架构与选型.md)
- [开发与验收状态](docs/implementation-state.md)
- [发布门禁](docs/05_验收与发布门禁.md)
- [上游文件映射](upstream/SOURCE_MAP.md)
- [架构决策](docs/adr/)

## 反馈与贡献

请通过 [Issues](https://github.com/i-YOLO/dsh-hotstream/issues) 提交问题，附 DSH 版本、系统、复现步骤和脱敏截图。请勿附 API Key、登录链接、完整私有日志或业务数据库。

欢迎提交功能建议、兼容性验证与修复 PR。涉及 DSH 集成时，以目标版本的官方文档、类型和公共导出为准。

## 许可与致谢

代码使用 [MIT License](LICENSE)。感谢 [AIHOT](https://github.com/KKKKhazix/AIHOT)（数字生命卡兹克）提供的原始代码、界面与业务规则，以及 [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 提供的原生插件基础。

AIHOT 基线固定在 `cc66cceb1dc7a0bc147e942e49ff94c9cee418c6`，原始 MIT 声明保存在 [upstream/licenses/AIHOT-MIT.txt](upstream/licenses/AIHOT-MIT.txt)，迁移差异见来源映射。第三方依赖、商标、文章与数据来源保留各自权利，详见 [NOTICE](NOTICE)。
