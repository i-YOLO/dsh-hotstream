# Hotstream 宣传视频

34 秒、16:9（1920×1080，60fps）的社媒宣传短片，全部用代码生成：HyperFrames（HTML + GSAP）负责画面，`scripts/make-bgm.mjs` 合成 BGM。

| 时间 | 场景 | 音乐 |
| --- | --- | --- |
| 0–4s | 钩子：资讯标题从四面压来，“AI 新闻，刷不完。重点，全错过。” | 渐快的 ticker 声 + 上升音效 |
| 4–6s | 火焰点燃 HOTSTREAM 品牌 | Drop |
| 6–10s | 六类信源 → 六步处理流水线 | 律动段 |
| 10–14s | 精选时间线：AI 评分、推荐理由 | 加入琶音 |
| 14–18s | 文章阅读：导读、原文/译文、和 AI 讨论 | |
| 18–22s | 日报 / 周报 / 月报 | 琶音升八度 |
| 22–26s | 模型榜：五类榜单、评分、价格 | |
| 26–30s | 数据留在本地 | 军鼓滚奏蓄力 |
| 30–34s | 结尾品牌定格 | 第二次 Drop，收尾和弦 |

## 重新生成

```sh
./scripts/prepare-assets.sh   # 复制截图与音效，合成 BGM（120 BPM、A 小调，剪掉 5.5–7.5s 与画面同步），子集化中文字体（需 macOS + fonttools）
npx hyperframes check
npx hyperframes render --fps 60 --quality delivery -o renders/hotstream-promo-1080p60.mp4
```

成片：[`docs/media/hotstream-promo.mp4`](../../docs/media/hotstream-promo.mp4)。

## GitHub 内嵌播放版本

GitHub 的原生附件播放器不保留 README 自定义 `poster` 属性。交付视频使用仓库已有的 `docs/media/hotstream-promo-poster.jpg` 替换第 0 帧，不在视频前追加时长；首帧单独保留画质，音频直接复制。后处理后的 1080p60 成片约 7.8 MB，低于 10 MB 附件限制。

在本目录渲染完成后，可用以下命令更新同一个交付文件：

```sh
ffmpeg -i renders/hotstream-promo-1080p60.mp4 \
  -i ../../docs/media/hotstream-promo-poster.jpg \
  -filter_complex "[1:v]scale=1920:1080:flags=lanczos,format=yuv420p[cover];[0:v][cover]overlay=enable='eq(n,0)'[v]" \
  -map '[v]' -map 0:a -c:v libx264 -preset medium \
  -b:v 1700k -maxrate 2200k -bufsize 8000k \
  -x264-params 'zones=0,0,q=16' -pix_fmt yuv420p \
  -c:a copy -movflags +faststart -y ../../docs/media/hotstream-promo.mp4
```

上传前检查实际文件大小和首帧。上传到 GitHub 附件后，将获得的 `github.com/user-attachments/assets/…` 地址单独放在主 README 中；不再在播放器上方重复展示封面图。

## 素材

`assets/` 下的文件都不入库，由 `scripts/prepare-assets.sh` 重新生成：

- `assets/shots/`：从仓库 `docs/screenshots/` 复制的原生截图（2026-10-05）。
- `assets/sfx/`：HyperFrames media-use skill 内置音效，来自 Pixabay（Pixabay Content License），默认从 `~/.claude/skills/media-use/audio/assets/sfx` 复制，可用 `SFX_DIR` 指定其他位置。
- `assets/audio/bgm.wav`：`scripts/make-bgm.mjs` 原创合成，没有使用采样。
- `assets/fonts/`：兰亭黑 SC Heavy、苹方 SC 的子集，由 macOS 系统字体生成，只用于本地渲染。
