import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import CandidateDrawer from './components/CandidateDrawer'
import CardPanel from './components/CardPanel'
import EvidenceDrawer from './components/EvidenceDrawer'
import { IconBookmark, IconBridge, IconCheck, IconChevronRight, IconGrip, IconRefresh, IconUndo, IconX } from './components/Icons'
import JobSwitcher from './components/JobSwitcher'
import LeftPanel from './components/LeftPanel'
import NewJobDrawer, { type NewJobInput } from './components/NewJobDrawer'
import ProfileDrawer from './components/ProfileDrawer'
import { StandardDrawer } from './components/StandardPanel'
import { Drawer } from './components/ui'
import { buildCard, DEFAULT_COMPETENCIES } from './data/mock'
import type { Candidate, InterviewCard, JobProfile, MarkKind, Question, QuestionType, ResumeClaim } from './data/types'
import { pingApi, requestCard } from './lib/api'
import { canonicalizeCards } from './lib/canonical'
import { extractClaims, guessHeadline, guessName, parseEducation, parseResumeFile } from './lib/resume'
import { clearState, loadState, makeInitialState, saveState } from './lib/state'
import { activeJob, getCard, jobCandidates, marksOf, reducer } from './lib/store'

export default function App() {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const [state, dispatch] = useReducer(reducer, undefined, loadState)
  const [standardOpen, setStandardOpen] = useState(params.get('p') === 'standard')
  const [profileOpen, setProfileOpen] = useState(params.get('p') === 'profile')
  const [allOpen, setAllOpen] = useState(false)
  const [newJobOpen, setNewJobOpen] = useState(false)
  const [pasteOpen, setPasteOpen] = useState(false)
  const [pasteText, setPasteText] = useState('')
  const [busy, setBusy] = useState(false)
  const [parsing, setParsing] = useState(false)
  const [leftW, setLeftW] = useState(410)
  const [api, setApi] = useState<{ configured: boolean; model?: string } | null>(null)
  const [evidence, setEvidence] = useState<Question | null>(null)
  const [flashId, setFlashId] = useState<string | null>(null)
  const [activeClaimId, setActiveClaimId] = useState<string | undefined>()
  const [toast, setToast] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const toastTimer = useRef<number | undefined>(undefined)
  const splitDrag = useRef(false)

  const job = activeJob(state)
  const candidates = jobCandidates(state)
  const candidate = candidates.find((c) => c.id === state.activeCandidateId)
  const card = getCard(state)
  const staleFrom = card.jobVersion !== job.version ? card.jobVersion : null

  useEffect(() => saveState(state), [state])
  useEffect(() => void pingApi().then(setApi), [])

  useEffect(() => {
    if (!state.removed) return
    const t = window.setTimeout(() => dispatch({ type: 'DISMISS' }), 6000)
    return () => window.clearTimeout(t)
  }, [state.removed])

  const showToast = useCallback((msg: string) => {
    setToast(msg)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(null), 2600)
  }, [])

  const marks = useMemo(() => {
    const m = new Map<string, MarkKind[]>()
    for (const l of state.library) m.set(l.text, l.kinds)
    return m
  }, [state.library])

  const savedMap = useMemo(() => {
    const m: Record<string, string | undefined> = {}
    for (const c of state.candidates) m[c.id] = state.cards[c.id]?.savedAt
    return m
  }, [state.candidates, state.cards])

  useEffect(() => {
    if (params.get('p') !== 'evidence') return
    const q = card.questions.find((x) => x.claimId) ?? card.questions[0]
    if (q) setEvidence(q)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ---------------------------- 岗位 ---------------------------- */

  const handleSwitchJob = (jobId: string) => {
    dispatch({ type: 'SET_JOB', jobId })
    setActiveClaimId(undefined)
    setFlashId(null)
    setEvidence(null)
    scrollRef.current?.scrollTo({ top: 0 })
  }

  const handleNewJob = (input: NewJobInput) => {
    const now = new Date().toISOString()
    const next: JobProfile = {
      id: `job_${Math.random().toString(36).slice(2, 8)}`,
      title: input.title,
      department: input.department,
      jdText: input.jdText,
      baselineJd: input.jdText,
      version: 1,
      status: 'confirmed',
      createdAt: now,
      updatedAt: now,
      favorite: false,
      tasks: [],
      competencies: DEFAULT_COMPETENCIES(),
      issues: [],
    }
    dispatch({ type: 'NEW_JOB', job: next })
    setNewJobOpen(false)
    setActiveClaimId(undefined)
    showToast(`「${next.title}」已存进岗位库`)
  }

  /* ---------------------------- 候选人 ---------------------------- */

  const addCandidateFromText = (text: string, fileName?: string) => {
    const claims = extractClaims(text, job.competencies)
    const edu = parseEducation(text)
    const cand: Candidate = {
      id: `cand_${Date.now().toString(36)}`,
      jobId: job.id,
      name: guessName(text, fileName),
      headline: guessHeadline(text),
      years: 0,
      resumeText: text,
      claims,
      source: 'upload',
      addedAt: new Date().toISOString(),
      educationLevel: edu?.level,
      gradYear: edu?.gradYear,
    }
    dispatch({ type: 'ADD_CANDIDATE', candidate: cand, card: { ...buildCard(job, cand), source: 'preset' } })
    setActiveClaimId(undefined)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
    showToast(
      claims.length
        ? `已解析 ${cand.name} 的简历 · 抽出 ${claims.length} 条可追问的线索`
        : `已解析 ${cand.name} 的简历，但没抽到可追问的线索`,
    )
  }

  const handleUpload = async (file: File) => {
    setParsing(true)
    try {
      const text = await parseResumeFile(file)
      if (!text.trim()) throw new Error('这份文件里没有可识别的文字')
      addCandidateFromText(text, file.name)
    } catch (err) {
      showToast(err instanceof Error ? err.message : '简历解析失败')
    } finally {
      setParsing(false)
    }
  }

  /* ---------------------------- 出题 ---------------------------- */

  const handleRegenerate = async () => {
    if (busy) return
    if (!candidates.length) {
      showToast('先上传一份简历，才有可生成的问题')
      return
    }
    setBusy(true)

    const results = await Promise.all(candidates.map((c) => requestCard(job, c)))
    const failed = results.find((r) => !r.ok)

    if (!failed) {
      const cards: Record<string, InterviewCard> = {}
      let total = 0
      let model = ''
      let latency = 0
      candidates.forEach((c, i) => {
        const r = results[i]
        if (!r.ok) return
        total += r.questions.length
        model = r.model ?? model
        latency = Math.max(latency, r.latencyMs ?? 0)
        const prev = state.cards[c.id]
        cards[c.id] = {
          candidateId: c.id,
          jobVersion: job.version,
          generatedAt: new Date().toISOString(),
          questions: r.questions,
          source: 'live',
          model: r.model,
          latencyMs: r.latencyMs,
          savedAt: prev?.savedAt,
          savedQuestions: prev?.savedQuestions,
        }
      })
      // 模型逐人独立生成，措辞会对不上；这一步保证"同岗位问同一道题"
      const aligned = canonicalizeCards(cards, candidates)
      dispatch({ type: 'REGENERATE', cards: aligned, jobVersion: job.version })
      setBusy(false)
      showToast(`AI 生成 ${total} 道题 · ${model} · ${(latency / 1000).toFixed(1)}s`)
      return
    }

    const cards: Record<string, InterviewCard> = {}
    for (const c of candidates) {
      const prev = state.cards[c.id]
      cards[c.id] = {
        ...buildCard(job, c),
        source: 'fallback',
        savedAt: prev?.savedAt,
        savedQuestions: prev?.savedQuestions,
      }
    }
    dispatch({ type: 'REGENERATE', cards, jobVersion: job.version })
    setBusy(false)
    showToast(`${(failed as { message: string }).message}，已回退到预置样例`)
  }

  /* ---------------------------- 交互 ---------------------------- */

  const handleSwitchCandidate = (id: string) => {
    dispatch({ type: 'SET_CANDIDATE', candidateId: id })
    setActiveClaimId(undefined)
    setFlashId(null)
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleClaimClick = useCallback(
    (claim: ResumeClaim) => {
      setActiveClaimId(claim.id)
      const target = card.questions.find((q) => q.claimId === claim.id)
      if (!target) {
        showToast('这条线索还没被用上，点「重新生成」可以让它出现在追问里')
        return
      }
      setFlashId(claim.id)
      window.setTimeout(() => setFlashId(null), 1500)
      document.getElementById(`q-${target.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    },
    [card.questions, showToast],
  )

  const handleMark = (q: Question, kind: MarkKind) => {
    const compName = job.competencies.find((c) => c.id === q.competencyId)?.name ?? ''
    const current = marksOf(state, q)
    dispatch({
      type: 'TOGGLE_MARK',
      question: q,
      kind,
      competencyName: compName,
      candidateName: candidate?.name ?? '',
      jobId: job.id,
      jobTitle: job.title,
    })
    if (current.includes(kind)) showToast(kind === 'like' ? '已取消喜欢' : '已取消收藏')
    else showToast(kind === 'like' ? '已喜欢，收进个人主页' : '已收藏，收进个人主页')
  }

  const openCount = job.issues.filter((i) => i.status === 'open').length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* 顶栏 */}
      <header className="flex h-13 shrink-0 items-center gap-2 border-b border-line bg-surface px-5">
        <div className="flex shrink-0 items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-[9px] bg-teal text-white">
            <IconBridge width={17} height={17} />
          </div>
          <span className="text-[14.5px] font-semibold tracking-tight">Interview Bridge</span>
        </div>

        <div className="mx-1.5 h-5 w-px bg-line" />

        <JobSwitcher
          jobs={state.jobs}
          activeJobId={job.id}
          onSwitch={handleSwitchJob}
          onToggleFavorite={(id) => dispatch({ type: 'TOGGLE_JOB_FAVORITE', jobId: id })}
          onNew={() => setNewJobOpen(true)}
        />

        <button
          className={`chip shrink-0 cursor-pointer px-2 py-[3px] text-[11.5px] ${
            job.status === 'confirmed' ? 'bg-teal-soft text-teal' : 'bg-amber-soft text-amber'
          }`}
          onClick={() => setStandardOpen(true)}
          title="看这个岗位的能力维度与 JD 待确认项"
        >
          {job.status === 'confirmed' ? `v${job.version}` : `v${job.version} 草稿`}
        </button>

        <button
          className={`flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[9px] border px-2 text-[11.5px] font-medium transition ${
            openCount > 0
              ? 'border-amber/30 bg-amber-soft text-amber hover:bg-amber/15'
              : 'border-line bg-surface text-muted hover:border-teal/30 hover:text-teal'
          }`}
          onClick={() => setStandardOpen(true)}
          title="检查 JD：哪些要求可能筛错人、哪些已经处理过"
        >
          {openCount > 0 ? `JD 有 ${openCount} 项待确认` : 'JD 已检查'}
          <IconChevronRight width={12} height={12} />
        </button>

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span
            className="chip border border-line bg-paper px-2 py-[3px] text-[11.5px] text-muted"
            title={api?.configured ? '重新生成会真实调用大模型' : '未配置模型密钥，使用预置样例'}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                api === null ? 'bg-muted/30' : api.configured ? 'bg-teal' : 'bg-amber'
              }`}
            />
            {api === null ? '检测中' : api.configured ? 'AI 已连接' : '离线样例'}
          </span>
          <button className="btn btn-ghost" onClick={() => setProfileOpen(true)}>
            <IconBookmark width={15} height={15} />
            个人主页
            <span className="rounded bg-teal-soft px-1.5 text-[11px] font-semibold text-teal tabular-nums">
              {state.library.length}
            </span>
          </button>
          <button
            className="btn btn-ghost"
            onClick={() => {
              clearState()
              dispatch({ type: 'RESET', state: makeInitialState() })
              setActiveClaimId(undefined)
              showToast('演示数据已重置')
            }}
            title="重置为初始演示数据"
          >
            <IconRefresh width={15} height={15} />
            重置
          </button>
        </div>
      </header>

      {/* 主体 */}
      <main className="flex min-h-0 flex-1">
        <div style={{ width: leftW }} className="shrink-0">
          <LeftPanel
            job={job}
            candidates={candidates}
            activeId={state.activeCandidateId}
            claims={candidate?.claims ?? []}
            activeClaimId={activeClaimId}
            parsing={parsing}
            savedMap={savedMap}
            onSwitch={handleSwitchCandidate}
            onClaimClick={handleClaimClick}
            onUpload={handleUpload}
            onPaste={() => {
              setPasteText('')
              setPasteOpen(true)
            }}
            onOpenAll={() => setAllOpen(true)}
            onUpdateJd={(text) => {
              dispatch({ type: 'UPDATE_JD', jdText: text })
              showToast('JD 已更新，记得重新生成问题')
            }}
          />
        </div>

        <div
          className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-line/50 transition-colors hover:bg-teal/30"
          onPointerDown={(e) => {
            splitDrag.current = true
            e.currentTarget.setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => {
            if (!splitDrag.current) return
            setLeftW(Math.min(760, Math.max(330, e.clientX)))
          }}
          onPointerUp={(e) => {
            splitDrag.current = false
            e.currentTarget.releasePointerCapture(e.pointerId)
          }}
          onDoubleClick={() => setLeftW(410)}
          title="拖动调整左右宽度，双击复位"
        >
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-line opacity-0 transition-opacity group-hover:opacity-100">
            <IconGrip width={10} height={14} />
          </span>
        </div>

        <div ref={scrollRef} className="relative min-w-0 flex-1 overflow-y-auto">
          {staleFrom !== null && candidate && (
            <div className="sticky top-0 z-20 flex items-center gap-2.5 border-b border-amber/20 bg-amber-soft px-6 py-2.5">
              <span className="text-[12.5px] text-amber">
                JD 已更新到 <b>v{job.version}</b>，这份问题还是 <b>v{staleFrom}</b>
              </span>
              <div className="ml-auto flex shrink-0 items-center gap-1.5">
                <button className="btn btn-ghost btn-sm text-amber/80" onClick={() => setStandardOpen(true)}>
                  看标准
                </button>
                <button className="btn btn-outline btn-sm border-amber/30 text-amber" onClick={handleRegenerate}>
                  <IconRefresh width={12} height={12} />
                  重新生成
                </button>
              </div>
            </div>
          )}

          <CardPanel
            job={job}
            candidate={candidate}
            card={card}
            marks={marks}
            flashId={flashId}
            busy={busy}
            onMark={handleMark}
            onDelete={(id) => dispatch({ type: 'DELETE_QUESTION', id })}
            onDeleteModule={(competencyId) => dispatch({ type: 'DELETE_MODULE', competencyId })}
            onEvidence={(q) => setEvidence(q)}
            onAdd={(competencyId: string, text: string, qtype: QuestionType) =>
              dispatch({ type: 'ADD_QUESTION', competencyId, text, qtype })
            }
            onMove={(fromId, toId, toCompetencyId, position) =>
              dispatch({ type: 'MOVE_QUESTION', fromId, toId, toCompetencyId, position })
            }
            onRegenerate={handleRegenerate}
            onOpenProfile={() => setProfileOpen(true)}
            onSaveCard={() => {
              if (!candidate) return
              dispatch({ type: 'SAVE_CARD', candidateId: candidate.id })
              showToast(`已保存 ${candidate.name} 的这份问题，在个人主页里能打开`)
            }}
            onRestoreCard={() => {
              if (!candidate) return
              dispatch({ type: 'RESTORE_CARD', candidateId: candidate.id })
              showToast('已恢复到上次保存的版本')
            }}
            onUploadClick={() => fileRef.current?.click()}
          />
        </div>
      </main>

      <input
        ref={fileRef}
        type="file"
        accept=".pdf,.docx,.doc,.txt,.md"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void handleUpload(f)
          e.target.value = ''
        }}
      />

      <CandidateDrawer
        open={allOpen}
        job={job}
        candidates={candidates}
        savedMap={savedMap}
        onClose={() => setAllOpen(false)}
        onOpen={handleSwitchCandidate}
        onDelete={(id) => {
          dispatch({ type: 'DELETE_CANDIDATE', candidateId: id })
          showToast('已删除这份简历和它的问题')
        }}
      />

      <ProfileDrawer
        open={profileOpen}
        onClose={() => setProfileOpen(false)}
        library={state.library}
        jobs={state.jobs}
        candidates={state.candidates}
        cards={state.cards}
        onInsert={(libraryId) => {
          const item = state.library.find((l) => l.id === libraryId)
          if (item && card.questions.some((q) => q.text === item.text)) return showToast('这道题已经在这份清单里了')
          dispatch({ type: 'INSERT_LIBRARY', libraryId })
          setProfileOpen(false)
          showToast('已插入到当前这份问题里')
        }}
        onRemove={(id) => dispatch({ type: 'REMOVE_LIBRARY', id })}
        onOpenSaved={(jobId, candidateId) => {
          dispatch({ type: 'SET_JOB', jobId })
          dispatch({ type: 'SET_CANDIDATE', candidateId })
          setActiveClaimId(undefined)
          setFlashId(null)
          scrollRef.current?.scrollTo({ top: 0 })
        }}
      />

      <NewJobDrawer open={newJobOpen} onClose={() => setNewJobOpen(false)} onCreate={handleNewJob} />

      <Drawer
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        width={520}
        title="粘贴简历文本"
        subtitle="从 PDF / 招聘网站复制的内容直接贴进来，右边会立刻按这份 JD 出题"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn btn-ghost" onClick={() => setPasteOpen(false)}>
              取消
            </button>
            <button
              className="btn btn-primary"
              disabled={pasteText.trim().length < 20}
              onClick={() => {
                addCandidateFromText(pasteText.trim())
                setPasteOpen(false)
              }}
            >
              解析这份简历
            </button>
          </div>
        }
      >
        <textarea
          className="field h-[52vh] resize-none text-[12.5px] leading-[1.8]"
          placeholder="把简历全文粘贴到这里…"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
        />
        <p className="mt-2 text-[11.5px] text-muted/70">只做文本抽取，不会把简历内容发到任何地方（接了模型时除外）。</p>
      </Drawer>

      <StandardDrawer
        open={standardOpen}
        job={job}
        onClose={() => setStandardOpen(false)}
        onResolve={(issueId, resolution) => dispatch({ type: 'RESOLVE_ISSUE', issueId, resolution })}
        onReopen={(issueId) => dispatch({ type: 'REOPEN_ISSUE', issueId })}
        onSave={(patches) => {
          dispatch({ type: 'SAVE_STANDARD', patches })
          setStandardOpen(false)
          showToast(`已保存为 v${job.version + 1} 草稿，请重新生成问题`)
        }}
      />

      <EvidenceDrawer
        open={!!evidence}
        question={evidence}
        job={job}
        candidate={candidate}
        liked={evidence ? (marks.get(evidence.text) ?? []).includes('like') : false}
        onClose={() => setEvidence(null)}
        onLike={() => evidence && handleMark(evidence, 'like')}
      />

      {/* 底部浮层 */}
      <div className="pointer-events-none fixed bottom-5 left-1/2 z-60 flex -translate-x-1/2 flex-col-reverse items-center gap-2">
        {state.removed && (
          <div className="rise pointer-events-auto flex items-center gap-3 rounded-full bg-ink px-4 py-2 text-white shadow-lg">
            <span className="text-[12px]">{state.removed.label}</span>
            <button
              className="flex items-center gap-1 rounded-full bg-white/15 px-2 py-0.5 text-[11.5px] font-medium hover:bg-white/25"
              onClick={() => dispatch({ type: 'UNDO' })}
            >
              <IconUndo width={12} height={12} />
              撤销
            </button>
            <button className="text-white/50 hover:text-white" onClick={() => dispatch({ type: 'DISMISS' })}>
              <IconX width={13} height={13} />
            </button>
          </div>
        )}
        {toast && (
          <div className="rise pointer-events-auto flex items-center gap-2 rounded-full border border-teal/25 bg-teal-soft px-4 py-2 text-[12.5px] font-medium text-teal-dark shadow-md">
            <IconCheck width={13} height={13} />
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}
