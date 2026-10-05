# ADR 018：Terminal Bench 4 公开读取复用已配置代理

日期：2026-10-05。目标保持 DSH Desktop 0.2.0-rc.2 / Cordis 4.0.4。

本机真实复现：GitHub 三个元信息接口返回 200；随后 `raw.githubusercontent.com` 的 `leaderboard.yaml` 在 30 秒超时，另一个并行文件在诊断结束时取消。使用已配置的公开 HTTP 代理，完全相同的原始读取器在 6.041 秒内完成 19 个请求，全部 200，解析出 13 条 Terminal Bench 4.0.0 系统成绩。根因是榜单模块没有接入任务已经持有的公开读取连接，因而绕过了该代理。

沿用 ADR 015/016 已核对的目标版代理及资源所有权契约；再次核对目标版网络代理指南、架构及 `@deepseek-ai/dsh-http-proxy` README。自有 Dispatcher 不自动继承宿主代理，修复继续使用插件已创建并按任务释放的公开连接，不设置宿主全局 Dispatcher 或系统代理。

Runtime 将现有任务级 `publicNetwork` 传给榜单模块。新选择器只把 `api.github.com/repos/harbor-framework/terminal-bench/` 和 `raw.githubusercontent.com/harbor-framework/terminal-bench/` 上的匿名 HTTPS GET/HEAD 交给公开读取连接。带认证头、Cookie、认证查询参数、请求体或写入方法的请求继续原通路；其他仓库和来源保持原行为，Arena 仍使用自己的连接。公开代理未配置时保持直连。设置说明补充 Terminal Bench 的适用范围，不新增配置字段、凭据或迁移。

上游读取器、30 秒请求期限、最大响应体、原有单次重试、commit 固定、数据版本与任务数提取、所有模型与 Agent 系统成绩均保持原样。Terminal Bench 4 继续是系统参考资料，不进入综合或编程排名。网络边界、取消和关闭由现有 `PublicNetwork` 所有者执行。

自动验收覆盖完整读取器经过新路由取得固定版本和全部提交、系统参考资格保持、认证请求与非目标地址不经公开代理、无代理回退、Arena 路由保留；已有公共网络测试继续检查私网地址／重定向、取消和资源关闭。真实公开读取、正式库、安装包和原生页面证据分别记录，详见 `docs/15_TerminalBench修复验收.md`。

安装验收补充：目标版本 Plugin Manager README 的限制明确指出，替换包后必须重启进程以加载新的 JavaScript 模块。原路径 ESM 缓存不会因为停用／启用自动清除。CLI 成功、文件一致或 Host 重新激活都不等于新代码正在执行；本轮排空任务并正常重启 Desktop 后，真实 Terminal Bench 刷新才由直连失败变为成功。
