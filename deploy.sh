#!/usr/bin/env bash
# 一键部署到 GitHub Pages：构建 → 同步到 gh-pages 分支 → 推送
set -euo pipefail
cd "$(dirname "$0")"

NODE_BIN="${NODE:-}"
if [ -z "$NODE_BIN" ]; then
  if command -v node >/dev/null 2>&1; then NODE_BIN="$(command -v node)"
  elif [ -x /tmp/interviewbridge-node ]; then NODE_BIN=/tmp/interviewbridge-node
  else
    for c in /opt/homebrew/bin/node /usr/local/bin/node "$HOME"/.dsh/dsh-runtimes/*/dependencies/node/bin/node; do
      [ -x "$c" ] && NODE_BIN="$c" && break
    done
  fi
fi
[ -z "$NODE_BIN" ] && { echo "找不到 node" >&2; exit 1; }
# 若 node 无法加载原生模块，复制并重签一份
if ! "$NODE_BIN" -e "1" >/dev/null 2>&1 || [ "$("$NODE_BIN" -e "process.arch" 2>/dev/null)" = "" ]; then
  cp "$NODE_BIN" /tmp/interviewbridge-node && codesign --force --sign - /tmp/interviewbridge-node >/dev/null 2>&1 || true
  NODE_BIN=/tmp/interviewbridge-node
fi

echo "· 构建"
PAGES_BASE=/interview-bridge/ "$NODE_BIN" node_modules/vite/bin/vite.js build >/dev/null
touch dist/.nojekyll

echo "· 准备 gh-pages 工作区"
git fetch -q origin gh-pages:gh-pages 2>/dev/null || true
git worktree remove --force .pages-worktree 2>/dev/null || true
rm -rf .pages-worktree
git worktree add -q -f .pages-worktree gh-pages

echo "· 同步产物"
rsync -a --delete --exclude '.git' dist/ .pages-worktree/

cd .pages-worktree
if git status --porcelain | grep -q .; then
  git add -A
  git commit -q -m "deploy: $(date '+%Y-%m-%d %H:%M')"
  git push -q origin gh-pages
  echo "✓ 已部署 → https://hanny-0303.github.io/interview-bridge/"
else
  echo "· 产物无变化，跳过"
fi
