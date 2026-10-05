---
workflow: general-video
flow: automation
storyboard: no
message: "Hotstream 把 AI 资讯洪流炼成一份可信的精选——DSH 桌面原生插件"
destination: social-landscape
aspect: 1920x1080
language: zh-CN
audience: 关注 AI 动态的开发者与从业者（DeepSeek Harness 用户）
length: 36s
angle: problem-to-product sizzle
---

## Intent

用户原话：“帮我给这个项目做一个宣传视频，时长、音效、BGM你自己把握。我要发到社交媒体上，需要够吸引人……纯代码实现，只使用 Claude code 内置 skill，发挥你的想象，尽你所能地制作。” 后续指定 16:9。

方向：节拍驱动的科技发布会式快剪（120 BPM，每场景 2 小节）。开头用“AI 新闻刷不完”的信息过载制造钩子，火焰点燃品牌，随后用真实产品截图逐一展示流水线、精选、阅读、日报/周报/月报、模型榜、数据边界，最后 CTA。

## Assets

- assets/shots/*.jpg — 仓库 docs/screenshots 的真实原生截图（2026-10-05 拍摄），作为产品画面。
- assets/audio/bgm.wav — 由 scripts/make-bgm.mjs 代码合成的原创 BGM。
- assets/sfx/*.mp3 — media-use 内置 Pixabay 音效库。

## Customizations

- BGM 纯代码合成，与镜头切点同网格（120 BPM）。
- 中文字体从 macOS 系统字体（兰亭黑 SC Heavy / 苹方 SC）按用字子集化，仅用于本地渲染。

## Notes

- 不编造数字或功能；只使用 README 与截图中可见的事实。标注“开发预览 alpha”。
- 不展示热点榜截图（含政治新闻标题）；精选截图顶部的“当前热点”条用页面底色遮盖。
