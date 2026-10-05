#!/bin/sh
# Rebuild the git-ignored inputs: screenshots, SFX, BGM and CJK font subsets.
set -eu
cd "$(dirname "$0")/.."
SFX_DIR="${SFX_DIR:-$HOME/.claude/skills/media-use/audio/assets/sfx}"
mkdir -p assets/shots assets/sfx assets/audio assets/fonts
for s in selected article daily weekly monthly leaderboard topics sources admin; do
  cp "../../docs/screenshots/$s.jpg" assets/shots/
done
for f in whoosh whoosh-short impact-bass-1 impact-bass-2 glitch-1 pop click ping sparkle chime; do
  cp "$SFX_DIR/$f.mp3" assets/sfx/
done
node scripts/make-bgm.mjs assets/audio/bgm.wav
python3 scripts/make-fonts.py
