/**
 * 本地开发用的模型服务（零依赖 Node HTTP）。
 * 线上跑在 Vercel Serverless 里（api/card.js），两边共用 api/_core.js。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { generateCard, readModelConfig } from './api/_core.js'

function loadEnvFile() {
  const file = path.join(process.cwd(), '.env')
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
const PORT = Number(process.env.API_PORT || 8787)

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

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')

  if (url.pathname === '/api/health') {
    return send(res, 200, { ok: true, model: cfg.model, configured: Boolean(cfg.apiKey) })
  }

  if (url.pathname === '/api/card' && req.method === 'POST') {
    if (!cfg.apiKey) {
      return send(res, 503, {
        error: 'no_key',
        message: '服务端未配置 DEEPSEEK_API_KEY，请写入 .env 后重启',
      })
    }

    let body
    try {
      body = JSON.parse(await readBody(req))
    } catch {
      return send(res, 400, { error: 'bad_request' })
    }

    const { job, candidate } = body ?? {}
    if (!job?.competencies?.length || !candidate?.resumeText) {
      return send(res, 400, { error: 'bad_request', message: '缺少岗位标准或简历' })
    }

    try {
      const result = await generateCard(job, candidate, cfg)
      console.log(
        `[card] ${candidate.name} ✓${result.questions.length} ✗${result.rejected.length} ${result.latencyMs}ms tokens=${result.usage?.total_tokens ?? '-'}`,
      )
      return send(res, 200, {
        questions: result.questions,
        source: result.source,
        model: result.model,
        latencyMs: result.latencyMs,
        rejected: result.rejected,
      })
    } catch (err) {
      if (err?.code === 'ALL_REJECTED') {
        return send(res, 502, {
          error: 'all_rejected',
          message: err.message,
          rejected: (err.rejected ?? []).slice(0, 5),
        })
      }
      console.error('[card] failed:', err?.message)
      const aborted = err?.name === 'AbortError'
      return send(res, aborted ? 504 : 502, {
        error: aborted ? 'timeout' : 'upstream_error',
        message: String(err?.message ?? err).slice(0, 300),
      })
    }
  }

  send(res, 404, { error: 'not_found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] listening on http://127.0.0.1:${PORT}  model=${cfg.model}  key=${cfg.apiKey ? '已配置' : '未配置'}`)
})
