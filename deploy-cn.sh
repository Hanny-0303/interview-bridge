#!/usr/bin/env bash
# 在服务器上运行：装依赖 → 构建 → 常驻启动
# 用法：./deploy-cn.sh
set -euo pipefail
cd "$(dirname "$0")"

command -v node >/dev/null || { echo "✗ 没装 Node，先执行：curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - && sudo apt install -y nodejs"; exit 1; }
MAJOR=$(node -p "process.versions.node.split('.')[0]")
[ "$MAJOR" -ge 20 ] || { echo "✗ Node 版本过低：$(node -v)，需要 20+"; exit 1; }

if [ ! -f .env ]; then
  cp .env.example .env
  echo "· 已生成 .env，请填入 DEEPSEEK_API_KEY 后重跑"
fi

command -v pnpm >/dev/null || { echo "· 安装 pnpm"; npm i -g pnpm@9; }

echo "· 安装依赖"
pnpm install --frozen-lockfile

echo "· 构建"
pnpm build

if command -v pm2 >/dev/null; then
  echo "· 用 pm2 常驻"
  if pm2 describe interview-bridge >/dev/null 2>&1; then
    pm2 restart interview-bridge --update-env
  else
    pm2 start server.mjs --name interview-bridge
  fi
  pm2 save >/dev/null
else
  echo "· 未安装 pm2，用 nohup 启动（建议 npm i -g pm2 后重跑）"
  pkill -f "node server.mjs" 2>/dev/null || true
  nohup node server.mjs > server.log 2>&1 &
fi

sleep 2
echo "· 健康检查"
curl -s "http://127.0.0.1:${PORT:-8787}/api/health" && echo || echo "（没起来，看 server.log 或 pm2 logs）"
echo "✓ 完成。服务器上直接访问 http://<公网IP>:8787"
