import type { Candidate, InterviewCard, Question } from '../data/types'

/**
 * 把「必问题 / 假设题」在多位候选人之间对齐。
 *
 * 模型是逐位候选人独立生成的，措辞必然有出入（"你最近一次…是什么时候"
 * vs "最近一次…你当时在做什么"）。但产品承诺的是"同岗位问同一道题"，
 * 所以这里做一次归一：每个 能力×题型 只保留第一个出现的版本，其余全部覆盖。
 *
 * 这一步是保证，不是美化 —— 没有它，"标准一致"就只是口号。
 */
export function canonicalizeCards(
  cards: Record<string, InterviewCard>,
  candidates: Candidate[],
): Record<string, InterviewCard> {
  const canon = new Map<string, Question>()

  for (const c of candidates) {
    for (const q of cards[c.id]?.questions ?? []) {
      if (q.id.startsWith('manual_')) continue
      if (q.type !== 'core' && q.type !== 'boundary') continue
      const key = `${q.competencyId}|${q.type}`
      if (!canon.has(key)) canon.set(key, q) // 保留第一个，作为岗位级标准问法
    }
  }

  const out: Record<string, InterviewCard> = {}

  for (const c of candidates) {
    const card = cards[c.id]
    if (!card) continue

    const seen = new Set<string>()
    const questions: Question[] = card.questions.map((q) => {
      if (q.id.startsWith('manual_') || (q.type !== 'core' && q.type !== 'boundary')) return q
      const key = `${q.competencyId}|${q.type}`
      seen.add(key)
      const std = canon.get(key)
      if (!std) return q
      return { ...q, text: std.text, observationPoints: std.observationPoints, rationale: std.rationale }
    })

    // 模型漏掉的岗位级题，从标准里补齐，保证两人的题面完全一样
    for (const [key, std] of canon) {
      if (seen.has(key)) continue
      const [competencyId, type] = key.split('|')
      questions.push({
        ...std,
        id: `${c.id}_canon_${competencyId}_${type}`,
        status: 'ai',
      })
    }

    out[c.id] = { ...card, questions }
  }

  return out
}
