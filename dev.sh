#!/usr/bin/env bash
# 启动本地开发服务器。
# 本机没有系统 node，脚本会自动寻找可用 node；若只能找到 DSH 内置 node，
# 会先做一个 adhoc 重签名的副本（否则 macOS 会拒绝加载 rollup/esbuild 的原生模块）。
set -euo pipefail
cd "$(dirname "$0")"

find_node() {
  if [ -n "${NODE:-}" ]; then echo "$NODE"; return; fi
  if command -v node >/dev/null 2>&1; then command -v node; return; fi
  local candidates=(
    /opt/homebrew/bin/node
    /usr/local/bin/node
    "$HOME/.dsh"/dsh-runtimes/*/dependencies/node/bin/node
    /Applications/DeepSeek\ Harness.app/Contents/Resources/app.asar.unpacked/node/bin/node
  )
  for c in "${candidates[@]}"; do
    if [ -x "$c" ]; then echo "$c"; return; fi
  done
  echo ""
}

NODE_BIN="$(find_node)"
if [ -z "$NODE_BIN" ]; then
  echo "未找到 node，请先安装 Node.js 20+ 或设置 NODE=/path/to/node" >&2
  exit 1
fi

# 检查能否加载原生模块（rollup 的 .node）；失败则重签名一个副本
NEED_RESIGN=0
if ! "$NODE_BIN" -e "require('node:module')" >/dev/null 2>&1; then NEED_RESIGN=1; fi
if ! ls node_modules/.pnpm/@rollup+rollup-* >/dev/null 2>&1; then
  echo "依赖缺失，请先运行：pnpm install" >&2
  exit 1
fi
ROLLUP_NODE=$(find node_modules/.pnpm -name 'rollup.*.node' -path '*rollup-darwin*' 2>/dev/null | head -1 || true)
if [ -n "$ROLLUP_NODE" ] && ! "$NODE_BIN" -e "process.dlopen({exports:{}}, '$ROLLUP_NODE')" >/dev/null 2>&1; then
  NEED_RESIGN=1
fi

if [ "$NEED_RESIGN" = "1" ] && [ "$(uname)" = "Darwin" ]; then
  echo "· 重签名 node 副本以允许加载原生模块…"
  CACHE="${TMPDIR:-/tmp}/interviewbridge-node"
  cp "$NODE_BIN" "$CACHE"
  codesign --force --sign - "$CACHE" >/dev/null 2>&1 || true
  NODE_BIN="$CACHE"
fi

echo "· node: $NODE_BIN"

# 启动模型服务（未配置 key 时也能起，健康检查会返回 configured:false）
API_PORT="${API_PORT:-8787}" "$NODE_BIN" server.mjs > /tmp/interviewbridge-api.log 2>&1 &
API_PID=$!
trap 'kill "$API_PID" 2>/dev/null || true' INT TERM EXIT
sleep 0.6
head -1 /tmp/interviewbridge-api.log 2>/dev/null | sed 's/^/· /' || true

"$NODE_BIN" node_modules/vite/bin/vite.js --port "${PORT:-5178}" --strictPort
