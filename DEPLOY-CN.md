# 部署到中国大陆可访问的服务器

> `interview-bridge.vercel.app` 在中国大陆无法稳定打开——`*.vercel.app` 是 DNS 污染，属于网络层不可达，改任何配置都没用。
> 解决办法只有一个：换一个大陆能访问的宿主。

推荐 **香港轻量应用服务器**：大陆访问 30–60ms，**不需要 ICP 备案**（备案只针对境内服务器），买完绑域名当天就能用。

---

## 一、买机器（5 分钟）

| 平台 | 机型 | 价格 |
| --- | --- | --- |
| 腾讯云 轻量应用服务器（中国香港） | 2 核 2G，30GB SSD | ¥24–40/月 |
| 阿里云 轻量应用服务器（中国香港） | 2 核 2G | ¥24–40/月 |

系统选 **Ubuntu 22.04**。买完在控制台「防火墙 / 安全组」里放行 **80、443、8787** 三个端口。

> 为什么要香港：境内服务器绑定域名必须备案（7–20 天），香港不需要。

---

## 二、部署（三种方式，选一种）

先把代码拉上去：

```bash
ssh root@<你的服务器IP>
apt update && apt install -y git
git clone https://github.com/Hanny-0303/interview-bridge.git
cd interview-bridge
cp .env.example .env
vim .env        # 填 DEEPSEEK_API_KEY
```

### 方式 A · Docker（最省事，推荐）

```bash
curl -fsSL https://get.docker.com | sh
docker compose up -d --build
docker compose logs -f      # 看日志，Ctrl+C 退出
```

打开 `http://<服务器IP>` 就是完整站（页面 + AI 接口）。

### 方式 B · 一键脚本（不装 Docker）

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt install -y nodejs
npm i -g pnpm@9 pm2
./deploy-cn.sh
```

打开 `http://<服务器IP>:8787`。

### 方式 C · 纯手工

```bash
pnpm install && pnpm build
node server.mjs          # 前台跑，验证用
pm2 start server.mjs --name interview-bridge && pm2 save
```

---

## 三、绑域名 + HTTPS（可选，但演示更体面）

1. 在域名商处加一条 A 记录，指向服务器 IP（不要开 CDN，先从直连验证）。
2. 装 Caddy，它自动申请证书：

```bash
apt install -y caddy
cp Caddyfile.example /etc/caddy/Caddyfile
vim /etc/caddy/Caddyfile     # 把域名换成你的
systemctl reload caddy
```

打开 `https://你的域名` 即可。

> 别用 Nginx + certbot，配置更长；Caddy 三行搞定，而且证书自动续期。

---

## 四、自检清单

```bash
curl http://127.0.0.1:8787/api/health     # 期望 configured:true
curl -I https://你的域名                    # 期望 200 + text/html
```

浏览器打开后看顶栏：

- **「AI 已连接」** = 模型通了
- **「离线样例」** = key 没读到，检查 `.env` 位置和 `pm2 restart --update-env`

---

## 五、这个 server 做了什么

`server.mjs` 是零依赖的 Node 服务，一个进程同时提供：

| 路径 | 内容 |
| --- | --- |
| `/` | `dist/` 里的前端（自动 gzip、静态资源长缓存、index.html 不缓存） |
| `/api/health` | 模型是否就绪 |
| `/api/card` | 生成面试问题（含引用校验） |

所以**不需要 Nginx 托管静态目录**，只要把 8787 反代出去就行。

---

## 六、常见问题

**打开是 404 / 白屏**
没构建。执行 `pnpm build`，确认 `dist/index.html` 存在。

**顶栏显示「离线样例」**
`.env` 没读到，或者 pm2 启动时没带环境变量。执行 `pm2 restart interview-bridge --update-env`。

**手机能开、电脑不能开（或反过来）**
安全组只放了部分端口，检查 80 / 443 / 8787。

**微信里打开提示「非官方网页」**
未备案域名的常见提示。评委用浏览器打开没有这个问题；如果要发微信群，考虑给境内服务器备案，或先用纯 IP 链接。

**演示当天网络抖动**
本地再跑一份兜底：`./dev.sh`，用手机热点给电脑供网。录屏也要提前备一份。
