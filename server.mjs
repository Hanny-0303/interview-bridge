/**
 * InterviewBridge · 模型服务
 * 零依赖 Node HTTP 服务，只做三件事：
 *   1. 把「已确认的岗位标准 + 候选人简历」组装成一次结构化调用
 *   2. 用代码校验模型输出（ID 必须存在、引用必须能命中原文、类型必须合法）
 *   3. 校验不过就丢弃该题，而不是把脏数据交给前端
 *
 * 密钥只存在于服务端环境变量，前端永远拿不到。
 */
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'

/* --------------------------- 配置 --------------------------- */

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

const API_KEY = process.env.DEEPSEEK_API_KEY || ''
const BASE_URL = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
const MODEL = process.env.DEEPSEEK_MODEL || 'deepseek-chat'
const PORT = Number(process.env.API_PORT || 8787)

/* --------------------------- 提示词 --------------------------- */

const SYSTEM_PROMPT = `你是 InterviewBridge 的面试问题生成器。服务对象是 HR —— 他们不懂技术，但要为技术岗位招人、并且亲自做第一轮面试。你只输出 JSON。

核心立场：
- 这些题是给 HR 一面用的。技术判断留给业务主管面，你不要出技术考题。
- 每道题问的是「他做过什么、怎么做的」，不是「他懂不懂」。HR 靠听事实来判断人，不靠判断答案对错。
- 不要出现只有同行才能听懂的专业名词；如果必须引用候选人简历里的术语，就用他的原话加引号，然后问「能不能用不涉及技术的话讲一下」。

硬性规则，违反任一条即为不合格输出：
1. competencyId 只能取自给定能力维度；claimId 只能取自给定候选人简历，且必须与原文一致。禁止编造 ID。
2. type=core 与 type=boundary 只能依据岗位与能力维度，claimId 必须为 null，且对同岗位所有候选人完全一致。
3. type=followup 必须引用一条真实 claimId，只追问该候选人自己写过的事，不得虚构经历。
4. 不出现匹配度分数、不做录用推断、不询问年龄性别婚育等敏感信息。
5. 全部中文，口语化。题干是一句 HR 当面能自然说出口的问句，不超过 60 字；不要用「请谈谈」「请描述」这类书面开头。
6. observationPoints 写「HR 该听什么」：2-3 条，必须是可听见的行为事实，例如「说得出具体时间」「讲的是我做了什么而不是我们」「失败了也讲得清」。不要写「理解深刻」这类无法验证的话。
7. 假设题必须给出一个具体的、有张力的处境，问他的做法。禁止问是非题（「你会不会」「愿不愿意」「介不介意」「你会主动……吗」），这类题只会得到标准答案，问不出任何东西。
   - 好：「合作方一直不回复，但上线时间不能拖，你会怎么办？」
   - 坏：「如果半夜出问题没人叫你，你会主动去处理吗？」
8. rationale 用一句话说明这道题为什么存在，要点明它对应哪项业务任务或哪条简历原文。`

function buildUserPrompt(job, candidate) {
  const tasks = (job.tasks ?? []).length
    ? job.tasks.map((t) => `- ${t.id}｜${t.description}`).join('\n')
    : '（这个岗位还没有拆出具体任务，以 JD 为准）'
  const comps = job.competencies
    .map(
      (c) =>
        `- ${c.id}｜${c.name}｜${c.importance}｜对应任务 ${c.taskIds.join(',')}\n  可观察行为：${c.behaviors.join('；')}`,
    )
    .join('\n')
  const claims = candidate.claims
    .map((c) => `- ${c.id}｜${c.rawText}${c.unverified ? '｜（简历自述的短板）' : ''}`)
    .join('\n')

  return `岗位：${job.title}（${job.department}）

岗位 JD（由 HR 维护，末尾几条常常是后来补的要求）：
${job.jdText}

业务任务：
${tasks}

能力维度（HR 面的观察角度）：
${comps}

候选人：${candidate.name}（${candidate.headline}）
简历原文：
${candidate.resumeText}

已抽取的简历线索：
${claims}

这是给 HR 做的第一轮面试（HR 面），不是技术面。请生成 HR 能问、能听懂、能判断的问题，数量要求：
- 每个能力维度生成 1 道 core 题（共 ${job.competencies.length} 道）
- 从中挑选 ${Math.min(6, candidate.claims.length)} 条最值得验证的简历线索，各生成 1 道 followup 题
- 为 ${job.competencies
    .filter((c) => c.importance === 'core' || c.id === 'comp_3')
    .map((c) => c.id)
    .join('、')} 各生成 1 道 boundary 题（极端条件下的判断）

只输出如下 JSON：
{"questions":[{"competencyId":"comp_1","type":"core","claimId":null,"text":"…","observationPoints":["…","…"],"rationale":"…"}]}`
}

/* --------------------------- 规则校验 --------------------------- */

const MAX_TEXT = 120
const MAX_POINTS = 4
const VALID_TYPES = new Set(['core', 'followup', 'boundary'])

function validateQuestions(raw, job, candidate) {
  const compIds = new Set(job.competencies.map((c) => c.id))
  const claims = new Map(candidate.claims.map((c) => [c.id, c]))
  const resumeText = candidate.resumeText

  const accepted = []
  const rejected = []
  const seen = new Set()

  const list = Array.isArray(raw?.questions) ? raw.questions : []
  for (const q of list) {
    const reason = (() => {
      if (!q || typeof q !== 'object') return 'not_object'
      if (!compIds.has(q.competencyId)) return 'unknown_competency'
      if (!VALID_TYPES.has(q.type)) return 'bad_type'
      if (typeof q.text !== 'string' || q.text.trim().length < 6) return 'text_too_short'
      if (q.text.length > MAX_TEXT) return 'text_too_long'
      if (q.type === 'followup') {
        const claim = claims.get(q.claimId)
        if (!claim) return 'unknown_claim'
        if (!resumeText.includes(claim.rawText)) return 'claim_not_in_resume'
      } else if (q.claimId) {
        return 'core_must_not_cite_resume'
      }
      const key = `${q.competencyId}|${q.type}|${q.text.trim()}`
      if (seen.has(key)) return 'duplicate'
      return null
    })()

    if (reason) {
      rejected.push({ reason, competencyId: q?.competencyId, type: q?.type })
      continue
    }

    seen.add(`${q.competencyId}|${q.type}|${q.text.trim()}`)
    accepted.push({
      competencyId: q.competencyId,
      type: q.type,
      text: q.text.trim(),
      claimId: q.type === 'followup' ? q.claimId : undefined,
      sourceTaskIds: job.competencies.find((c) => c.id === q.competencyId)?.taskIds ?? [],
      observationPoints: Array.isArray(q.observationPoints)
        ? q.observationPoints.filter((x) => typeof x === 'string' && x.trim()).slice(0, MAX_POINTS)
        : [],
      rationale: typeof q.rationale === 'string' ? q.rationale.slice(0, 200) : '',
      status: 'ai',
    })
  }
  return { accepted, rejected }
}

/* --------------------------- 模型调用 --------------------------- */

async function callModel(job, candidate) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)
  try {
    const res = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        temperature: 0.4,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: buildUserPrompt(job, candidate) },
        ],
      }),
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`upstream ${res.status}: ${body.slice(0, 200)}`)
    }
    const data = await res.json()
    const content = data?.choices?.[0]?.message?.content ?? ''
    const cleaned = content.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '')
    return { parsed: JSON.parse(cleaned), usage: data?.usage }
  } finally {
    clearTimeout(timer)
  }
}

/* --------------------------- HTTP --------------------------- */

function send(res, code, obj) {
  const body = JSON.stringify(obj)
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' })
  res.end(body)
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
    return send(res, 200, { ok: true, model: MODEL, configured: Boolean(API_KEY) })
  }

  if (url.pathname === '/api/card' && req.method === 'POST') {
    if (!API_KEY) {
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

    const started = Date.now()
    try {
      const { parsed, usage } = await callModel(job, candidate)
      const { accepted, rejected } = validateQuestions(parsed, job, candidate)

      if (accepted.length === 0) {
        return send(res, 502, {
          error: 'all_rejected',
          message: '模型输出未通过引用校验，已拒绝使用',
          rejected: rejected.slice(0, 5),
        })
      }

      console.log(
        `[card] ${candidate.name} ✓${accepted.length} ✗${rejected.length} ${Date.now() - started}ms tokens=${usage?.total_tokens ?? '-'}`,
      )
      return send(res, 200, {
        questions: accepted,
        source: 'live',
        model: MODEL,
        latencyMs: Date.now() - started,
        rejected,
      })
    } catch (err) {
      console.error('[card] failed:', err?.message)
      const aborted = err?.name === 'AbortError'
      return send(res, 504, {
        error: aborted ? 'timeout' : 'upstream_error',
        message: String(err?.message ?? err).slice(0, 300),
      })
    }
  }

  send(res, 404, { error: 'not_found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[api] listening on http://127.0.0.1:${PORT}  model=${MODEL}  key=${API_KEY ? '已配置' : '未配置'}`)
})
