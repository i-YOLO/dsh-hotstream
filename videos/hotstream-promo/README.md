# Hotstream 宣传视频

36 秒、16:9（1920×1080，60fps）的社媒宣传短片，全部用代码生成：HyperFrames（HTML + GSAP）负责画面，`scripts/make-bgm.mjs` 合成 BGM。

| 时间 | 场景 | 音乐 |
| --- | --- | --- |
| 0–4s | 钩子：资讯标题从四面压来，“AI 新闻，刷不完。重点，全错过。” | 渐快的 ticker 声 + 上升音效 |
| 4–8s | 火焰点燃 HOTSTREAM 品牌 | Drop |
| 8–12s | 六类信源 → 六步处理流水线 | 律动段 |
| 12–16s | 精选时间线：AI 评分、推荐理由 | 加入琶音 |
| 16–20s | 文章阅读：导读、原文/译文、和 AI 讨论 | |
| 20–24s | 日报 / 周报 / 月报 | 琶音升八度 |
| 24–28s | 模型榜：五类榜单、评分、价格 | |
| 28–32s | 数据留在本地 | 军鼓滚奏蓄力 |
| 32–36s | CTA：GitHub 地址 | 第二次 Drop，收尾和弦 |

## 重新生成

```sh
./scripts/prepare-assets.sh   # 复制截图与音效，合成 BGM（120 BPM、A 小调），子集化中文字体（需 macOS + fonttools）
npx hyperframes check
npx hyperframes render --fps 60 --quality delivery -o renders/hotstream-promo-1080p60.mp4
```

成片：[`docs/media/hotstream-promo.mp4`](../../docs/media/hotstream-promo.mp4)。

## 素材

`assets/` 下的文件都不入库，由 `scripts/prepare-assets.sh` 重新生成：

- `assets/shots/`：从仓库 `docs/screenshots/` 复制的原生截图（2026-10-05）。
- `assets/sfx/`：HyperFrames media-use skill 内置音效，来自 Pixabay（Pixabay Content License），默认从 `~/.claude/skills/media-use/audio/assets/sfx` 复制，可用 `SFX_DIR` 指定其他位置。
- `assets/audio/bgm.wav`：`scripts/make-bgm.mjs` 原创合成，没有使用采样。
- `assets/fonts/`：兰亭黑 SC Heavy、苹方 SC 的子集，由 macOS 系统字体生成，只用于本地渲染。
