import { generateCard, readModelConfig } from './_core.js'

/** POST /api/card —— 为一位候选人生成一页面试问题 */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const cfg = readModelConfig()
  if (!cfg.apiKey) {
    return res.status(503).json({
      error: 'no_key',
      message: '服务端未配置 DEEPSEEK_API_KEY',
    })
  }

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      return res.status(400).json({ error: 'bad_request' })
    }
  }

  const { job, candidate } = body ?? {}
  if (!job?.competencies?.length || !candidate?.resumeText) {
    return res.status(400).json({ error: 'bad_request', message: '缺少岗位标准或简历' })
  }

  try {
    const result = await generateCard(job, candidate, cfg)
    console.log(
      `[card] ${candidate.name} ✓${result.questions.length} ✗${result.rejected.length} ${result.latencyMs}ms tokens=${result.usage?.total_tokens ?? '-'}`,
    )
    return res.status(200).json({
      questions: result.questions,
      source: result.source,
      model: result.model,
      latencyMs: result.latencyMs,
      rejected: result.rejected,
    })
  } catch (err) {
    if (err?.code === 'ALL_REJECTED') {
      return res.status(502).json({
        error: 'all_rejected',
        message: err.message,
        rejected: (err.rejected ?? []).slice(0, 5),
      })
    }
    const aborted = err?.name === 'AbortError'
    console.error('[card] failed:', err?.message)
    return res.status(aborted ? 504 : 502).json({
      error: aborted ? 'timeout' : 'upstream_error',
      message: String(err?.message ?? err).slice(0, 300),
    })
  }
}
