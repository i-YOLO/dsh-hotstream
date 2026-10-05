# Arena 网络修复与正式桌面验收

日期：2026-10-05，北京时间。环境为官方 DSH Desktop 0.2.0-rc.2、内置 Node 24.18.1，插件 0.1.0-alpha.4。

## 已完成

Arena 四个子榜在正式热点库中全部更新成功，错误均为 null；来源页面四张卡片显示“已更新”。任务 `8bfe54ac-8a69-42b3-b6e2-359d18158237` 一次执行成功，未降低评分校准、可比性或成榜门槛。

| Arena 子榜 | 实际保存行数 | 最新源数据日期 |
| --- | ---: | --- |
| Text Style-Controlled | 413 | 2026-10-02 |
| Creative Writing | 411 | 2026-10-02 |
| WebDev | 138 | 2026-10-01 |
| Vision Style-Controlled | 159 | 2026-10-02 |

本机榜单于 13:41:34 完成重算。综合榜从 58 个模型变为 80 个；编程 28、推理 48、知识 68、专业办公 42。Arena 创意写作与视觉数据按现有规则进入评分，综合文本和 WebDev 保留其原有的参考 / 排除规则。快照记录的下载成功不等于所有子榜都参与综合评分。

## 根因与修复

Arena 的四个子榜共用 Hugging Face 数据集入口。本机系统解析出现异常地址，直连路径被地址校验拒绝或连接超时。现有系统 HTTP 代理可以到达该入口；DSH 不自动读取系统代理，原插件自有 Agent 也未接入代理路由。

新增 `leaderboard.arenaProxyUrl`，后台位于“设置 → 可选模块 → Arena HTTP 代理”。本机已保存为 `http://127.0.0.1:7897`，仅用于 Arena 的 Hugging Face 请求及其已校验 CDN 重定向。其他来源、DSH 模型路由、系统 DNS / 代理规则保持原值。直连私网拒绝、代理目的地校验、TLS 验证、认证头跨源保护、取消与资源释放仍有效。详见 ADR 015。

升级前临时暂停新闻自动采集与处理，等待在途模型请求完成，确认零活跃任务和待结算回执后正常退出。安装后恢复原来的两个开关为 true。配置深度比对确认除新增 Arena 代理外完全一致；后台新闻处理继续正常运行，因此后续内容和回执计数会自然增长，不将这些增长归为榜单测试调用。

## 检查与产物

- 构建 / 类型检查通过；29 个文件、128 项回归通过，含真实本机模拟代理传输、污染 DNS、私网重定向、认证头、取消和旧配置兼容检查。
- 实际官方数据集版本：`46919c467f7f93d9609b668a283bcd20d87c28bc`。元信息和三份 parquet 全部 HTTP 200，总共解析四个子榜。
- 当前正式安装包：`artifacts/leaderboard-diagnostics/native-alpha4-arena-01.tgz`。
- SHA-256：`e125c00f47cafa2a0b0eff55b0dc65b2e6facd192f1a720817bcb2e0764dab91`。
- 341 个安装文件与该 tgz 逐文件 SHA-256 完全一致。产物依赖 / Worker 闭包检查通过；无私有路径或未解析 workspace 依赖。
- 无新增数据库迁移，无模型请求用于本次 Arena 验证，无付费采集服务请求。

## 证据

路径均位于 `artifacts/leaderboard-diagnostics/`：

- `2026-10-05-arena-network.json`：直连错误；`2026-10-05-arena-existing-proxy.json`：现有代理入口实证。
- `2026-10-05-arena-full-read.json`：真实完整下载与解析，写库前验证。
- `native-arena-result.json`：正式任务、四个来源状态、快照、评分依据、五个榜条目数及配置保留。
- `arena-source-capture-02.jpg` / `arena-source-capture-02-ax.txt`：正式桌面四个 Arena 卡片已更新。
- `tests-arena-full.log`、`package-arena.log`、`installed-hashes.json`：回归、产物与安装一致性。

`rejected-daily-frame.jpg` 是窗口已经切换后的日报画面，不作为 Arena 截图证据。

## 保留的限制

整体仍显示“部分来源可用”：本轮 Terminal-Bench 的 `raw.githubusercontent.com` 直连超时，保留上次成功快照；Artificial Analysis 在公开刷新中被跳过，其现有“credential missing”提示尚未在本次 Arena 修复中改动。二者均不妨碍 Arena 四项更新成功。Windows 和整套 v1 发布门禁不因本次修复被标记为完成。
