import { buildCard } from '../data/mock'
import type {
  AppState,
  Candidate,
  InterviewCard,
  JobProfile,
  LibraryItem,
  MarkKind,
  Question,
  QuestionType,
} from '../data/types'

export type CompetencyPatch = { id: string; name: string; importance: 'core' | 'important' | 'plus' }

export type Action =
  | { type: 'SET_JOB'; jobId: string }
  | { type: 'NEW_JOB'; job: JobProfile }
  | { type: 'TOGGLE_JOB_FAVORITE'; jobId: string }
  | { type: 'SET_CANDIDATE'; candidateId: string }
  | { type: 'ADD_CANDIDATE'; candidate: Candidate; card: InterviewCard }
  | { type: 'DELETE_CANDIDATE'; candidateId: string }
  | { type: 'UPDATE_JD'; jdText: string }
  | { type: 'SAVE_STANDARD'; patches: CompetencyPatch[] }
  | { type: 'RESOLVE_ISSUE'; issueId: string; resolution: 'hard' | 'preferred' | 'discuss' }
  | { type: 'REOPEN_ISSUE'; issueId: string }
  | { type: 'REGENERATE'; cards: Record<string, InterviewCard>; jobVersion: number }
  | { type: 'SET_CARDS'; cards: Record<string, InterviewCard> }
  | { type: 'SAVE_CARD'; candidateId: string }
  | { type: 'RESTORE_CARD'; candidateId: string }
  | {
      type: 'TOGGLE_MARK'
      question: Question
      kind: MarkKind
      competencyName: string
      candidateName: string
      jobId: string
      jobTitle: string
    }
  | { type: 'REMOVE_LIBRARY'; id: string }
  | { type: 'INSERT_LIBRARY'; libraryId: string }
  | { type: 'DELETE_QUESTION'; id: string }
  | { type: 'DELETE_MODULE'; competencyId: string }
  | { type: 'ADD_QUESTION'; competencyId: string; text: string; qtype: QuestionType }
  | { type: 'MOVE_QUESTION'; fromId: string; toId?: string; toCompetencyId?: string; position?: 'before' | 'after' }
  | { type: 'UNDO' }
  | { type: 'DISMISS' }
  | { type: 'RESET'; state: AppState }

const uid = () => Math.random().toString(36).slice(2, 9)

const emptyCard = (candidateId: string, jobVersion: number): InterviewCard => ({
  candidateId,
  jobVersion,
  generatedAt: '',
  questions: [],
})

export const activeJob = (state: AppState): JobProfile =>
  state.jobs.find((j) => j.id === state.activeJobId) ?? state.jobs[0]

export const jobCandidates = (state: AppState): Candidate[] =>
  state.candidates.filter((c) => c.jobId === state.activeJobId)

export const getCard = (state: AppState): InterviewCard =>
  state.cards[state.activeCandidateId] ?? emptyCard(state.activeCandidateId, activeJob(state).version)

const withCard = (state: AppState, fn: (card: InterviewCard) => InterviewCard): AppState => ({
  ...state,
  cards: { ...state.cards, [state.activeCandidateId]: fn(getCard(state)) },
})

const withJob = (state: AppState, fn: (job: JobProfile) => JobProfile): AppState => ({
  ...state,
  jobs: state.jobs.map((j) => (j.id === state.activeJobId ? fn(j) : j)),
})

const touchCandidate = (state: AppState, id: string, patch: Partial<Candidate>): AppState => ({
  ...state,
  candidates: state.candidates.map((c) => (c.id === id ? { ...c, ...patch } : c)),
})

/** 这道题当前被标成了什么（可以同时是喜欢 + 收藏） */
export const marksOf = (state: AppState, q: Question): MarkKind[] =>
  state.library.find((l) => l.text === q.text)?.kinds ?? []

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_JOB': {
      const next = state.candidates.find((c) => c.jobId === action.jobId)
      return { ...state, activeJobId: action.jobId, activeCandidateId: next?.id ?? '', removed: undefined }
    }

    case 'NEW_JOB':
      return {
        ...state,
        jobs: [action.job, ...state.jobs],
        activeJobId: action.job.id,
        activeCandidateId: '',
        removed: undefined,
      }

    case 'TOGGLE_JOB_FAVORITE':
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === action.jobId ? { ...j, favorite: !j.favorite } : j)),
      }

    case 'SET_CANDIDATE':
      return { ...state, activeCandidateId: action.candidateId, removed: undefined }

    case 'ADD_CANDIDATE':
      return {
        ...state,
        candidates: [...state.candidates, action.candidate],
        activeCandidateId: action.candidate.id,
        cards: { ...state.cards, [action.candidate.id]: action.card },
        removed: undefined,
      }

    case 'DELETE_CANDIDATE': {
      const rest = state.candidates.filter((c) => c.id !== action.candidateId)
      const cards = { ...state.cards }
      delete cards[action.candidateId]
      const nextActive =
        state.activeCandidateId === action.candidateId
          ? (rest.find((c) => c.jobId === state.activeJobId)?.id ?? '')
          : state.activeCandidateId
      return { ...state, candidates: rest, cards, activeCandidateId: nextActive }
    }

    case 'UPDATE_JD':
      return withJob(state, (job) => ({
        ...job,
        jdText: action.jdText,
        version: job.version + 1,
        status: 'draft',
        updatedAt: new Date().toISOString(),
      }))

    case 'SAVE_STANDARD':
      return withJob(state, (job) => ({
        ...job,
        version: job.version + 1,
        status: 'draft',
        updatedAt: new Date().toISOString(),
        competencies: job.competencies.map((c) => {
          const p = action.patches.find((x) => x.id === c.id)
          return p ? { ...c, name: p.name, importance: p.importance, edited: true } : c
        }),
      }))

    case 'RESOLVE_ISSUE':
      return withJob(state, (job) => ({
        ...job,
        issues: job.issues.map((i) =>
          i.id === action.issueId ? { ...i, status: 'resolved', resolution: action.resolution } : i,
        ),
      }))

    case 'REOPEN_ISSUE':
      return withJob(state, (job) => ({
        ...job,
        issues: job.issues.map((i) =>
          i.id === action.issueId ? { ...i, status: 'open' as const, resolution: undefined } : i,
        ),
      }))

    case 'REGENERATE': {
      const job = { ...activeJob(state), status: 'confirmed' as const }
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
        // 只覆盖本次生成涉及到的候选人，其余岗位的面试卡必须保留。
        // 这里如果写成 cards: action.cards，会整张表替换掉，其他岗位保存过的面试问题会全部消失。
        cards: { ...state.cards, ...action.cards },
        removed: undefined,
      }
    }

    case 'SET_CARDS':
      return {
        ...state,
        jobs: state.jobs.map((j) => (j.id === state.activeJobId ? { ...j, status: 'confirmed' } : j)),
        cards: { ...state.cards, ...action.cards },
        removed: undefined,
      }

    case 'SAVE_CARD': {
      const card = state.cards[action.candidateId]
      if (!card) return state
      const savedAt = new Date().toISOString()
      const next: AppState = {
        ...state,
        cards: {
          ...state.cards,
          [action.candidateId]: { ...card, savedAt, savedQuestions: card.questions },
        },
      }
      return touchCandidate(next, action.candidateId, { updatedAt: savedAt })
    }

    case 'RESTORE_CARD': {
      const card = state.cards[action.candidateId]
      if (!card?.savedQuestions) return state
      return { ...state, cards: { ...state.cards, [action.candidateId]: { ...card, questions: card.savedQuestions } } }
    }

    case 'TOGGLE_MARK': {
      const { question, kind, competencyName, candidateName, jobId, jobTitle } = action
      const existing = state.library.find((l) => l.text === question.text)
      if (existing) {
        // 两个标记互相独立：点一次加，再点一次取消
        const has = existing.kinds.includes(kind)
        const kinds = has ? existing.kinds.filter((k) => k !== kind) : [...existing.kinds, kind]
        if (kinds.length === 0) {
          return { ...state, library: state.library.filter((l) => l.id !== existing.id) }
        }
        return {
          ...state,
          library: state.library.map((l) =>
            l.id === existing.id ? { ...l, kinds, savedAt: new Date().toISOString() } : l,
          ),
        }
      }
      const item: LibraryItem = {
        id: `lib_${uid()}`,
        kinds: [kind],
        text: question.text,
        type: question.type,
        competencyName,
        observationPoints: question.observationPoints,
        savedFrom: candidateName,
        savedAt: new Date().toISOString(),
        jobId,
        jobTitle,
      }
      return { ...state, library: [item, ...state.library] }
    }

    case 'REMOVE_LIBRARY':
      return { ...state, library: state.library.filter((l) => l.id !== action.id) }

    case 'INSERT_LIBRARY': {
      const item = state.library.find((l) => l.id === action.libraryId)
      if (!item) return state
      const card = getCard(state)
      if (card.questions.some((q) => q.text === item.text)) return state
      const job = activeJob(state)
      const comp = job.competencies.find((c) => c.name === item.competencyName)
      const q: Question = {
        id: `manual_${uid()}`,
        competencyId: comp?.id ?? job.competencies[0].id,
        type: item.type,
        text: item.text,
        sourceTaskIds: comp?.taskIds ?? [],
        observationPoints: item.observationPoints,
        rationale: `从个人主页复用（原用于 ${item.savedFrom} 的面试）`,
        status: 'confirmed',
      }
      return withCard(state, (c) => ({ ...c, questions: [...c.questions, q] }))
    }

    case 'DELETE_QUESTION': {
      const card = getCard(state)
      if (!card.questions.some((q) => q.id === action.id)) return state
      const next = withCard(state, (c) => ({ ...c, questions: c.questions.filter((q) => q.id !== action.id) }))
      return { ...next, removed: { label: '已删除 1 道题', snapshot: card.questions } }
    }

    case 'DELETE_MODULE': {
      const card = getCard(state)
      const targets = card.questions.filter((q) => q.competencyId === action.competencyId)
      if (!targets.length) return state
      const comp = activeJob(state).competencies.find((c) => c.id === action.competencyId)
      const next = withCard(state, (c) => ({
        ...c,
        questions: c.questions.filter((q) => q.competencyId !== action.competencyId),
      }))
      return {
        ...next,
        removed: { label: `已删除模块「${comp?.name ?? ''}」共 ${targets.length} 道题`, snapshot: card.questions },
      }
    }

    case 'ADD_QUESTION': {
      const comp = activeJob(state).competencies.find((c) => c.id === action.competencyId)
      const q: Question = {
        id: `manual_${uid()}`,
        competencyId: action.competencyId,
        type: action.qtype,
        text: action.text,
        sourceTaskIds: comp?.taskIds ?? [],
        observationPoints: [],
        rationale: '面试官手动补充的问题，没有 AI 生成依据。',
        status: 'confirmed',
      }
      return withCard(state, (c) => ({ ...c, questions: [...c.questions, q] }))
    }

    case 'MOVE_QUESTION': {
      const card = getCard(state)
      const fromIdx = card.questions.findIndex((q) => q.id === action.fromId)
      if (fromIdx < 0) return state
      const moving = card.questions[fromIdx]
      const nextComp = action.toCompetencyId ?? moving.competencyId
      const moved: Question = { ...moving, competencyId: nextComp }

      const rest = card.questions.filter((_, i) => i !== fromIdx)
      let insertAt: number

      if (action.toId) {
        const ti = rest.findIndex((q) => q.id === action.toId)
        insertAt = ti < 0 ? rest.length : action.position === 'after' ? ti + 1 : ti
      } else {
        const lastInModule = rest.reduce((acc, q, i) => (q.competencyId === nextComp ? i : acc), -1)
        insertAt = lastInModule < 0 ? rest.length : lastInModule + 1
      }

      rest.splice(insertAt, 0, moved)
      return withCard(state, (c) => ({ ...c, questions: rest }))
    }

    case 'UNDO':
      if (!state.removed) return state
      return withCard(state, (c) => ({ ...c, questions: state.removed!.snapshot }))

    case 'DISMISS':
      return { ...state, removed: undefined }

    case 'RESET':
      return action.state

    default:
      return state
  }
}

export function rebuildCard(job: JobProfile, candidate: Candidate): InterviewCard {
  return buildCard(job, candidate)
}

export const isStale = (state: AppState) => getCard(state).jobVersion !== activeJob(state).version

export function isDirtySinceSave(card: InterviewCard): boolean {
  if (!card.savedAt || !card.savedQuestions) return false
  if (card.savedQuestions.length !== card.questions.length) return true
  return card.questions.some((q, i) => {
    const s = card.savedQuestions![i]
    return !s || s.id !== q.id || s.text !== q.text
  })
}
