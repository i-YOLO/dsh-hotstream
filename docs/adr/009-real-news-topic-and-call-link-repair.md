# 真实新闻的主题归属与调用关联修复

2026-10-04，用户授权在本机正式 DSH Desktop / `~/.dsh` 执行真实功能测试，随后取消原 30 次模型测试上限。保留固定 DSH 账号内置 DeepSeek Flash 路由、其他付费采集关闭及 Publication 门禁；原授权记录作为历史证据保留，设为 inactive。

144 条真实 RSS 经真实模型处理后，NVIDIA 公司主题仍为空。锁定 AIHOT 的 `packages/backend/src/publication/publish.ts` 将分析主体派生为 `entity:` 标签；`publication/topics.ts` 还要求多公司材料在中文或原始标题中点名该公司。原 SQLite 投影漏掉了前一步，主题查询也只比较普通标签。

恢复派生标签和同一主题归属规则。明确人工标签列表保持优先。公司主题与大事记共用纯规则；SQLite 在标签匹配之后使用 Worker 内的确定性函数执行公司归属检查。迁移 013 只补齐已有发布投影的派生标签，不重新评分、不改模型输出、许可、人工决定、配置或历史 checksum。

逐次审计整理同时发现，首次 reserve 的回执任务关联发生在 receipt 创建之前，因此初次请求未写入 `receipt_jobs`。将关联写入同一个 reserve 事务，并在旧回执复用时核对关联。迁移 014 按已有 epoch、完整逻辑请求身份、任务 dedupe key 和 stage 补齐历史模型关联；不派发任何请求、不改写 request / response / usage / 审计身份。

验证采用当前真实新闻库的只读快照，再执行相同候选迁移：147 篇、809 个逐次回执及全部请求响应摘要 hash、用户标记、配置和 001–012 checksum 保持一致；任务关联从 0 补齐为 809，NVIDIA 主题从 0 恢复为 10 条。正式桌面安装后的 Gateway 和界面另行记录，快照验证不代替实际安装验收。

随后恢复主题的上游 selected/public/seat 范围：全库中 NVIDIA 归属 10 条，其中主题页展示 5 条精选代表报道。公司主题统一使用 entityId 派生的规范标签，旧主题配置仅在读取时适配，保留原保存内容。详见 ADR 010 与真实数据 alpha10 回读。
