# Client 重启代次与主题阅读

真实正式桌面测试中，组合包停用再启用后，旧新闻页面没有恢复 watch 订阅；正常退出并重开可恢复。Client 控制器、locale、Slots 和连接监听统一放入同一个 effect 初始化范围，每个激活代次创建新的控制器及组件类型，退出时统一撤销。仍通过官方 Slots 推导 props、共享 React 和 Remote，不调用私有宿主 API。依据为目标发布的 `docs/user/develop/framework/index.zh.md` 与 `packages/client/ui-slots/README.zh.md` 的生命周期和框架 props 合同；实际复验另存。

诊断状态读取是独立的只读操作，不占用讨论/探针的互斥 busy 状态。否则重连期间一个尚未完成的诊断读取会静默阻止讨论按钮。讨论自身仍保持单次准入、新会话、导航取消和输入/附件保护，发送操作始终不由插件执行。

Slots 注入控制器及实际 registration 的幂等 disposer 由同一 Client 关闭流程显式保留：关闭先禁止迟到注册，再撤销监听、注入等待和已注册入口。仍使用官方 `ctx.slots.inject` / `register`，不改写宿主注册表。此调整用于正式桌面实测出现的侧栏残留，并保留停用截图和重新启用证据。

公司主题读取从 entityId 推导 `entity:` 标签，兼容先前把显示名保存为 tags 的配置；不覆写原主题配置。新默认主题使用规范主体标签。匹配仍要求标题点名多主体中的该公司，或材料只有一个公司主体。主题读取沿用上游 `publication/topics.ts` / `scope.ts` 的 public、selected、seat 集合；普通全部动态和收藏维持各自的 Publication 范围。

主题页显示主题名、定义、公司/方向/内容形态本地化名称、大事记与可见报道。原始 RSS 候选仅在全部动态展示，不混入主题页。不足门槛的事件不强行成为大事记；全文与媒体许可保持原门禁。全部变更通过同一批真实新闻回读验证，无新的模型调用。
