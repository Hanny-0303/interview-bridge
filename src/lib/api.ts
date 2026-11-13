import type { Candidate, JobProfile, Question } from '../data/types'

export interface ApiOk {
  ok: true
  questions: Question[]
  model?: string
  latencyMs?: number
  rejected: number
}

export interface ApiErr {
  ok: false
  message: string
}

export type ApiResult = ApiOk | ApiErr

/** 调服务端 /api/card：模型输出已经过引用校验，这里只补 id。 */
export async function requestCard(job: JobProfile, candidate: Candidate): Promise<ApiResult> {
  try {
    const res = await fetch('/api/card', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job, candidate }),
      signal: AbortSignal.timeout(70_000),
    })

    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      return { ok: false, message: (data.message as string) || `模型服务返回 ${res.status}` }
    }

    const raw = Array.isArray(data.questions) ? (data.questions as Question[]) : []
    if (!raw.length) return { ok: false, message: '模型没有返回可用题目' }

    const questions: Question[] = raw.map((q, i) => ({
      ...q,
      id: `${candidate.id}_gen_${i}`,
      status: 'ai',
    }))

    return {
      ok: true,
      questions,
      model: data.model as string | undefined,
      latencyMs: data.latencyMs as number | undefined,
      rejected: Array.isArray(data.rejected) ? data.rejected.length : 0,
    }
  } catch (err) {
    const aborted = err instanceof DOMException && err.name === 'TimeoutError'
    return { ok: false, message: aborted ? '模型调用超时' : '无法连接模型服务' }
  }
}

export async function pingApi(): Promise<{ configured: boolean; model?: string } | null> {
  try {
    const res = await fetch('/api/health')
    if (!res.ok) return null
    return (await res.json()) as { configured: boolean; model?: string }
  } catch {
    return null
  }
}
