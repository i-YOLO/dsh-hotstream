# 本机 RSS 全文展示默认开启

2026-10-04，用户先明确开启 Hugging Face 本机全文并补跑 ThinkingBox 翻译，随后要求全部信息源默认全部开启。按当前全文展示上下文，18 个默认 RSS 源的 `site_fulltext` 调整为 true，现有 18 个真实 RSS 源通过官方 revisioned `saveSource` 命令同步。默认种子中的 `syndicate_fulltext` 仍为 false；本插件不提供公开再分发出口。

这是来源展示配置的明确改变，不绕开 Publication。撤回、摘要模式、正文未确认、输入修订和媒体许可的读取检查仍然生效。已有正文可立即在本机读取，现存历史内容不会因这个展示开关自动重新评分、归组、生成摘要或翻译。后续正常处理的新精选按已冻结的来源配置执行全文翻译。

执行证据为 `artifacts/ui-alpha3/rss-fulltext-enabled.json`：17 项改变，加上此前已开启的 Hugging Face，共 18 项；文章 147、事件 28、报告 26、回执 825、任务 1186 均未增加。未修改历史迁移或数据库 checksum。
