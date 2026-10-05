# alpha.6 Terminal Bench 4 超时修复

日期：2026-10-05。状态：已安装 `0.1.0-alpha.6`，完成正式 Host 重启、真实刷新和原生页面验证。

## 原因与修复

GitHub 元信息请求正常，原始文件直连在 30 秒超时；本机已有的公开 HTTP 代理未用于 Terminal Bench 读取。修复将该官方仓库的匿名请求接到现有任务级公开连接。未配置代理时仍直连；凭据请求、其他来源和模型调用的路由不变。不新增重试或延长超时，也不改榜单分数、原始证据或系统参考资格。

修复前直连复现见 `artifacts/terminal-bench-alpha6/direct-before.json`。同一版本通过现有代理在 6.041 秒完成 19 个请求，全部 HTTP 200，得到 13 条成绩、版本 4.0.0；见 `proxy-probe.json` 和 `public-source.json`。此阶段没有写入正式库。

## 验证与安装

- 类型检查和构建通过。完整 32 个文件、148 项回归通过；另使用目标桌面内置 Node 24.18.1 再执行全套，148 项全部通过。记录为 `typecheck.log`、`build.log`、`tests-target-node.log`。
- 候选包 350 个文件、四个伴随包完整，无未解析 workspace 依赖或开发者私有路径；安装后逐文件与候选一致，见 `package.log`、`candidate-verification.json`、`installed-match.json`。
- 官方管理器停启只确认配置重新激活；第一次刷新仍执行了缓存的旧模块。目标 DSH 的 Plugin Manager 文档明确要求替换包后重启进程。暂停采集与处理、等现有任务结束后，通过原生应用正常退出并启动，主进程从 95760 更换为 2061。配置通过原生设置页恢复，整个设置对象与重启前一致，见 `restart-intent.json`、`restart-restored.json`。旧模块刷新失败的证据保留为 `native-before-restart.json`，不冒充修复通过。
- 重启后的正式任务 `d306e511-10d1-4f1b-a703-6f342d50015b` 一次成功：23 个公开来源成功、0 个抓取失败、1 个未配置，发布五类榜单。Terminal Bench 状态为 `ok`、错误为空、13 条成绩，最近成功为 **2026-10-05 15:51:33**。新榜单 `dd714a6a-84dc-478c-98b0-3fa8fce60939` 于 15:51:36 发布，原有价格汇率仍有效。见 `native-result.json`。
- 原始版本与数据内容没有变化，因此保留原快照 ID，并把 `lastSeenAt` 更新为 `2026-10-05T07:51:33.655Z`，避免以重复快照制造新数据。系统参考资格与来源 commit 保留。
- 原生页面展开来源诊断后，Terminal Bench 超时条目已消失，只剩 Artificial Analysis 缺凭据；截图和文本见 `native-success.jpg`、`native-success.ax.txt`。

Artificial Analysis 缺凭据不属于本次修复范围；该状态仍会使总览显示“部分来源可用”。本次修复只使用公开数据读取，没有为修复调用付费 API 或模型；原有后台运行设置已恢复。Windows 和长期运行稳定性未作为本次已验证项。

最终交付包以已安装 candidate1 为基础，仅补入完成后的 README 和本验收文档；运行文件逐字节一致，见 `release-verification.json`。全部证据位于 `artifacts/terminal-bench-alpha6/`。
