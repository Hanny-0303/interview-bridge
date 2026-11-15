/**
 * Interview Bridge · 自托管服务
 *
 * 一个进程同时提供：
 *   - 前端页面（dist/ 静态文件，带 SPA 兜底）
 *   - 模型接口（/api/health、/api/card）
 *
 * 本地开发也可以只跑它（先 pnpm build）：node server.mjs
 * 线上跑在 Vercel 时用 api/card.js，两边共用 api/_core.js。
 *
 * 环境变量：
 *   DEEPSEEK_API_KEY   必填才有真实生成
 *   DEEPSEEK_BASE_URL  默认 https://api.deepseek.com
 *   DEEPSEEK_MODEL     默认 deepseek-chat
 *   PORT               默认 8787
 *   HOST               默认 0.0.0.0（容器/服务器）；本地想只监听本机就设 127.0.0.1
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { generateCard, readModelConfig } from './api/_core.js'

const ROOT = path.dirname(fileURLToPath(import.meta.url))

function loadEnvFile() {
  const file = path.join(ROOT, '.env')
  if (!fs.existsSync(file)) return
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (!m) continue
    const value = m[2].replace(/^["']|["']$/g, '')
    if (!process.env[m[1]]) process.env[m[1]] = value
  }
}

loadEnvFile()

const cfg = readModelConfig()
const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || '0.0.0.0'
const DIST = path.join(ROOT, 'dist')

/* ------------------------------ 静态资源 ------------------------------ */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
}

const COMPRESSIBLE = new Set(['.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.map'])

function serveStatic(req, res, urlPath) {
  // 目录穿越防护
  const rel = decodeURIComponent(urlPath).replace(/^\/+/, '')
  let file = path.join(DIST, rel)
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end('forbidden')
    return true
  }

  // 目录 或 不存在的文件 → 交给 SPA 兜底
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html')

  if (!fs.existsSync(file)) return false

  const ext = path.extname(file).toLowerCase()
  const stat = fs.statSync(file)
  const etag = `W/"${stat.size}-${stat.mtimeMs.toString(36)}"`

  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag }).end()
    return true
  }

  const headers = {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    ETag: etag,
    // 带 hash 的产物长缓存，index.html 不缓存
    'Cache-Control': rel.startsWith('assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  }

  const acceptGzip = String(req.headers['accept-encoding'] || '').includes('gzip')
  const body = fs.readFileSync(file)

  if (acceptGzip && COMPRESSIBLE.has(ext) && body.length > 1024) {
    const gz = zlib.gzipSync(body, { level: 6 })
    headers['Content-Encoding'] = 'gzip'
    headers['Content-Length'] = gz.length
    headers.Vary = 'Accept-Encoding'
    res.writeHead(200, headers).end(gz)
    return true
  }

  headers['Content-Length'] = body.length
  res.writeHead(200, headers).end(body)
  return true
}

/* ------------------------------ API ------------------------------ */

function send(res, code, obj) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(obj))
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0
    const chunks = []
    req.on('data', (c) => {
      size += c.length
      if (size > 1_500_000) {
        reject(new Error('payload too large'))
        req.destroy()
      }
      chunks.push(c)
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

async function handleApi(req, res, pathname) {
  if (pathname === '/api/health') {
    send(res, 200, { ok: true, model: cfg.model, configured: Boolean(cfg.apiKey) })
    return true
  }

  if (pathname === '/api/card' && req.method === 'POST') {
    if (!cfg.apiKey) {
      send(res, 503, { error: 'no_key', message: '服务端未配置 DEEPSEEK_API_KEY' })
      return true
    }

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      send(res, 400, { error: 'bad_request' })
      return true
    }

    const { job, candidate } = body ?? {}
    if (!job?.competencies?.length || !candidate?.resumeText) {
      send(res, 400, { error: 'bad_request', message: '缺少岗位标准或简历' })
      return true
    }

    try {
      const result = await generateCard(job, candidate, cfg)
      console.log(
        `[card] ${candidate.name} ✓${result.questions.length} ✗${result.rejected.length} ${result.latencyMs}ms tokens=${result.usage?.total_tokens ?? '-'}`,
      )
      send(res, 200, {
        questions: result.questions,
        source: result.source,
        model: result.model,
        latencyMs: result.latencyMs,
        rejected: result.rejected,
      })
    } catch (err) {
      if (err?.code === 'ALL_REJECTED') {
        send(res, 502, { error: 'all_rejected', message: err.message, rejected: (err.rejected ?? []).slice(0, 5) })
      } else {
        const aborted = err?.name === 'AbortError'
        console.error('[card] failed:', err?.message)
        send(res, aborted ? 504 : 502, {
          error: aborted ? 'timeout' : 'upstream_error',
          message: String(err?.message ?? err).slice(0, 300),
        })
      }
    }
    return true
  }

  send(res, 404, { error: 'not_found' })
  return true
}

/* ------------------------------ 入口 ------------------------------ */

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  const pathname = url.pathname

  try {
    if (pathname.startsWith('/api/')) {
      await handleApi(req, res, pathname)
      return
    }

    if (serveStatic(req, res, pathname)) return

    // SPA 兜底：任何未命中的路径都返回 index.html（除非它看起来像静态资源）
    if (!path.extname(pathname)) {
      if (serveStatic(req, res, '/index.html')) return
    }

    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not Found')
  } catch (err) {
    console.error('[server]', err)
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' })
    res.end('Internal Server Error')
  }
})

if (!fs.existsSync(DIST)) {
  console.warn('[warn] 没找到 dist/，页面会 404。先执行：pnpm build')
}

server.listen(PORT, HOST, () => {
  console.log(`[server] http://${HOST}:${PORT}  model=${cfg.model}  key=${cfg.apiKey ? '已配置' : '未配置'}`)
  console.log(`[server] 静态目录 ${DIST}${fs.existsSync(DIST) ? '' : '（不存在）'}`)
})
