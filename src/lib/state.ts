import { initialCards, INITIAL_CANDIDATES, INITIAL_JOBS } from '../data/mock'
import type { AppState } from '../data/types'

/**
 * 存储带结构版本号：数据模型一变，旧数据一律丢弃重新初始化。
 * v5 = 10 个岗位 / 20 位候选人 + 喜欢与收藏互相独立（kinds 数组）
 */
const STORAGE_KEY = 'interviewbridge.state.v5'
const SCHEMA = 5

type Envelope = { v: number; state: AppState }

export function makeInitialState(): AppState {
  const jobs = structuredClone(INITIAL_JOBS)
  const candidates = structuredClone(INITIAL_CANDIDATES)
  return {
    jobs,
    activeJobId: jobs[0].id,
    candidates,
    activeCandidateId: candidates[0].id,
    cards: initialCards(jobs, candidates),
    library: [],
    removed: undefined,
  }
}

function isUsable(state: unknown): state is AppState {
  const s = state as AppState
  if (!Array.isArray(s?.jobs) || s.jobs.length === 0) return false
  if (!s.jobs.every((j) => j?.id && typeof j.jdText === 'string' && Array.isArray(j.competencies))) return false
  if (!s.jobs.some((j) => j.id === s.activeJobId)) return false
  if (!Array.isArray(s.candidates)) return false
  if (
    s.candidates.some(
      (c) => !c?.jobId || !c.source || typeof c.resumeText !== 'string' || !Array.isArray(c.claims) || !c.addedAt,
    )
  ) {
    return false
  }
  if (!s.cards || typeof s.cards !== 'object') return false
  if (!Array.isArray(s.library)) return false
  if (s.library.some((l) => !Array.isArray(l.kinds))) return false
  return true
}

export function loadState(): AppState {
  try {
    // 清掉历史版本的键，避免占空间
    localStorage.removeItem('interviewbridge.state.v2')
    localStorage.removeItem('interviewbridge.state.v4')

    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return makeInitialState()

    const parsed = JSON.parse(raw) as Envelope
    if (parsed?.v !== SCHEMA || !isUsable(parsed.state)) {
      localStorage.removeItem(STORAGE_KEY)
      return makeInitialState()
    }
    return parsed.state
  } catch (err) {
    console.warn('[InterviewBridge] 读取本地数据失败，已重置', err)
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    return makeInitialState()
  }
}

export function saveState(state: AppState) {
  try {
    const envelope: Envelope = { v: SCHEMA, state }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(envelope))
  } catch {
    /* 配额不足时忽略 */
  }
}

export function clearState() {
  for (const k of ['interviewbridge.state.v3', 'interviewbridge.state.v4', STORAGE_KEY]) {
    try {
      localStorage.removeItem(k)
    } catch {
      /* ignore */
    }
  }
}
