/**
 * 模型调用与规则校验的核心逻辑。
 * 本地 server.mjs 和 Vercel Serverless（api/card.js）共用这一份，保证行为一致。
 *
 * 原则：模型负责理解和建议；代码负责校验、来源检查、状态控制。
 */

export const SYSTEM_PROMPT = `你是 Interview Bridge 的面试问题生成器。服务对象是 HR —— 他们不懂技术，但要为技术岗位招人、并且亲自做第一轮面试。你只输出 JSON。

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

export function buildUserPrompt(job, candidate) {
  const tasks = (job.tasks ?? []).length
    ? job.tasks.map((t) => `- ${t.id}｜${t.description}`).join('\n')
    : '（这个岗位还没有拆出具体任务，以 JD 为准）'
  const comps = job.competencies
    .map(
      (c) =>
        `- ${c.id}｜${c.name}｜${c.importance}\n  可观察行为：${c.behaviors.join('；')}`,
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
    .filter((c) => c.importance === 'core')
    .map((c) => c.id)
    .join('、')} 各生成 1 道 boundary 题（极端条件下的判断）

只输出如下 JSON：
{"questions":[{"competencyId":"comp_1","type":"core","claimId":null,"text":"…","observationPoints":["…","…"],"rationale":"…"}]}`
}

const MAX_TEXT = 120
const MAX_POINTS = 4
const VALID_TYPES = new Set(['core', 'followup', 'boundary'])

/** 模型输出不直接进 UI：ID 必须存在、引用必须命中原文、类型必须合法 */
export function validateQuestions(raw, job, candidate) {
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

async function callModel(job, candidate, cfg) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)
  try {
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${cfg.apiKey}`,
      },
      body: JSON.stringify({
        model: cfg.model,
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

/**
 * 生成一位候选人的问题。返回结构由调用方（HTTP 函数）包装。
 */
export async function generateCard(job, candidate, cfg) {
  const started = Date.now()
  const { parsed, usage } = await callModel(job, candidate, cfg)
  const { accepted, rejected } = validateQuestions(parsed, job, candidate)

  if (accepted.length === 0) {
    const err = new Error('模型输出未通过引用校验，已拒绝使用')
    err.code = 'ALL_REJECTED'
    err.rejected = rejected
    throw err
  }

  return {
    questions: accepted,
    source: 'live',
    model: cfg.model,
    latencyMs: Date.now() - started,
    rejected,
    usage,
  }
}

export function readModelConfig() {
  return {
    apiKey: process.env.DEEPSEEK_API_KEY || '',
    baseUrl: (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, ''),
    model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
  }
}
