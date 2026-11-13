// InterviewBridge · 核心数据模型
// 核心人群：不懂技术、但要为技术岗位招人的 HR。
// 产品做的事：把业务主管的能力要求，翻译成 HR 能问、能听懂、能判断的行为问题。

export type ReviewStatus = 'ai' | 'pending' | 'confirmed' | 'edited' | 'rejected'

export interface Task {
  id: string
  description: string
  source: 'manager' | 'jd'
}

export interface Competency {
  id: string
  /** HR 能听懂的说法，不是技术名词 */
  name: string
  /** HR 面用的通用行为维度，跨岗位复用 */
  importance: 'core' | 'important' | 'plus'
  taskIds: string[]
  behaviors: string[]
  origin: 'jd' | 'manager' | 'both'
  edited?: boolean
}

export interface AlignmentIssue {
  id: string
  kind: 'conflict' | 'gap'
  title: string
  jdText: string
  managerText: string
  status: 'open' | 'resolved'
  resolution?: 'hard' | 'preferred' | 'discuss'
}

export interface JobProfile {
  id: string
  title: string
  department: string
  /** 当前 JD 全文（HR 可以直接改） */
  jdText: string
  /** 建岗时的 JD 原文，用于标出 HR 后来新加的内容 */
  baselineJd: string
  version: number
  status: 'draft' | 'confirmed'
  approvedBy?: string
  createdAt: string
  updatedAt: string
  /** 收藏 = 置顶常用岗位 */
  favorite: boolean
  tasks: Task[]
  competencies: Competency[]
  issues: AlignmentIssue[]
}

export interface ResumeClaim {
  id: string
  rawText: string
  start: number
  competencyIds: string[]
  unverified?: boolean
}

export type EducationLevel = '博士' | '硕士' | '本科' | '大专' | '其他'

export interface Candidate {
  id: string
  /** 候选人属于哪个岗位 */
  jobId: string
  name: string
  headline: string
  years: number
  resumeText: string
  claims: ResumeClaim[]
  source: 'preset' | 'upload'
  /** 加入这个岗位的时间 */
  addedAt: string
  /** 最近一次生成 / 保存的时间 */
  updatedAt?: string
  educationLevel?: EducationLevel
  gradYear?: number
}

/** 必问题(岗位级) / 简历追问(候选人级) / 假设题(岗位级) */
export type QuestionType = 'core' | 'followup' | 'boundary'

export interface Question {
  id: string
  competencyId: string
  type: QuestionType
  text: string
  claimId?: string
  sourceTaskIds: string[]
  /** HR 听什么 —— 不是技术对错，而是可观察的行为 */
  observationPoints: string[]
  rationale: string
  status: ReviewStatus
}

export type CardSource = 'live' | 'preset' | 'fallback'

export interface InterviewCard {
  candidateId: string
  jobVersion: number
  generatedAt: string
  questions: Question[]
  source?: CardSource
  model?: string
  latencyMs?: number
  /** 已保存给这位候选人的版本（一份 + 保存时间） */
  savedAt?: string
  savedQuestions?: Question[]
}

/** 喜欢 = 表态；收藏 = 收进个人主页备用。两者独立，可以同时存在 */
export type MarkKind = 'like' | 'fav'

export interface LibraryItem {
  id: string
  /** 喜欢和收藏是两件独立的事，可以同时成立 */
  kinds: MarkKind[]
  text: string
  type: QuestionType
  competencyName: string
  observationPoints: string[]
  savedFrom: string
  savedAt: string
  jobId: string
  jobTitle: string
  note?: string
}

export interface RemovedBatch {
  label: string
  snapshot: Question[]
}

export interface AppState {
  /** 岗位库：JD 可以保存、切换、收藏 */
  jobs: JobProfile[]
  activeJobId: string
  candidates: Candidate[]
  activeCandidateId: string
  cards: Record<string, InterviewCard>
  library: LibraryItem[]
  removed?: RemovedBatch
}
