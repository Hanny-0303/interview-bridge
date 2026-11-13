import { useMemo, useState, type DragEvent, type MouseEvent } from 'react'
import type { Candidate, InterviewCard, JobProfile, MarkKind, Question, QuestionType } from '../data/types'
import { isDirtySinceSave } from '../lib/store'
import { dateTime } from '../lib/time'
import Burst from './Burst'
import {
  IconBookmark,
  IconChevronDown,
  IconHeart,
  IconInfo,
  IconPlus,
  IconQuote,
  IconRefresh,
  IconSave,
  IconShield,
  IconSparkles,
  IconStar,
  IconTrash,
  IconUpload,
} from './Icons'
import { ImportanceChip, OriginTag, TypeChip } from './ui'

interface Props {
  job: JobProfile
  candidate?: Candidate
  card: InterviewCard
  marks: Map<string, MarkKind[]>
  flashId: string | null
  busy: boolean
  onMark: (q: Question, kind: MarkKind, rect: DOMRect) => void
  onDelete: (id: string) => void
  onDeleteModule: (competencyId: string) => void
  onEvidence: (q: Question) => void
  onAdd: (competencyId: string, text: string, type: QuestionType) => void
  onMove: (fromId: string, toId?: string, toCompetencyId?: string, position?: 'before' | 'after') => void
  onRegenerate: () => void
  onOpenProfile: () => void
  onSaveCard: () => void
  onRestoreCard: () => void
  onUploadClick: () => void
}

const MARK_COLOR: Record<MarkKind, string> = { like: '#c2185b', fav: '#a96209' }

interface DropTarget {
  id: string
  pos: 'before' | 'after'
}

function QuestionRow({
  q,
  index,
  mark,
  flash,
  dragging,
  drop,
  onMark,
  onDelete,
  onEvidence,
  onDragStart,
  onDragOverRow,
  onDropRow,
  onDragEnd,
}: {
  q: Question
  index: number
  mark: MarkKind[]
  flash: boolean
  dragging: boolean
  drop: DropTarget | null
  onMark: (kind: MarkKind, e: MouseEvent<HTMLButtonElement>) => void
  onDelete: () => void
  onEvidence: () => void
  onDragStart: (e: DragEvent<HTMLDivElement>) => void
  onDragOverRow: (e: DragEvent<HTMLDivElement>) => void
  onDropRow: (e: DragEvent<HTMLDivElement>) => void
  onDragEnd: () => void
}) {
  return (
    <div
      id={`q-${q.id}`}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOverRow}
      onDrop={onDropRow}
      onDragEnd={onDragEnd}
      className={`group flex cursor-grab gap-3 px-4 py-3 transition-colors hover:bg-paper/70 active:cursor-grabbing ${
        flash ? 'flash bg-violet-soft/40' : ''
      } ${dragging ? 'dragging' : ''} ${drop?.pos === 'before' ? 'drag-above' : ''} ${
        drop?.pos === 'after' ? 'drag-below' : ''
      }`}
    >
      <span className="mt-[3px] w-5 shrink-0 text-[11px] tabular-nums text-muted/45">
        {String(index + 1).padStart(2, '0')}
      </span>

      <div className="min-w-0 flex-1">
        <p
          className="cursor-pointer text-[14px] leading-[1.7] text-ink/90 selection:bg-teal-soft"
          onClick={onEvidence}
          title="点击看这道题为什么问"
        >
          {q.claimId && <IconQuote width={11} height={11} className="mr-1 inline align-[-1px] text-violet/70" />}
          {q.text}
        </p>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
          <TypeChip type={q.type} />
          {q.id.startsWith('manual_') && <span className="text-[10.5px] text-muted/60">手动补充</span>}
        </div>
      </div>

      <div className="flex shrink-0 items-start gap-0.5 opacity-70 transition-opacity group-hover:opacity-100">
        <button
          className={`icon-btn ${mark.includes('like') ? 'on-like' : ''}`}
          onClick={(e) => onMark('like', e)}
          title={mark.includes('like') ? '取消喜欢' : '喜欢'}
        >
          <IconHeart width={15} height={15} filled={mark.includes('like')} />
        </button>
        <button
          className={`icon-btn ${mark.includes('fav') ? 'on-fav' : ''}`}
          onClick={(e) => onMark('fav', e)}
          title={mark.includes('fav') ? '取消收藏' : '收藏到个人主页'}
        >
          <IconStar width={15} height={15} filled={mark.includes('fav')} />
        </button>
        <button className="icon-btn" onClick={onEvidence} title="看这道题为什么问">
          <IconInfo width={15} height={15} />
        </button>
        <button className="icon-btn hover:text-rose" onClick={onDelete} title="删除这道题">
          <IconTrash width={14} height={14} />
        </button>
      </div>
    </div>
  )
}

function AddQuestion({
  onAdd,
  onCancel,
  onOpenLibrary,
}: {
  onAdd: (text: string, type: QuestionType) => void
  onCancel: () => void
  onOpenLibrary: () => void
}) {
  const [text, setText] = useState('')
  const [type, setType] = useState<QuestionType>('followup')

  return (
    <div className="rise border-t border-dashed border-line bg-paper/50 px-4 py-3">
      <textarea
        autoFocus
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="写一个你想当面问他的问题…"
        className="field resize-none leading-relaxed"
      />
      <div className="mt-2 flex items-center gap-1.5">
        <select
          className="h-7 cursor-pointer rounded-[9px] border border-line bg-surface px-1.5 text-[12px] text-muted outline-none"
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType)}
        >
          <option value="core">必问题</option>
          <option value="followup">简历追问</option>
          <option value="boundary">假设题</option>
        </select>
        <button className="btn btn-outline btn-sm" onClick={onOpenLibrary}>
          <IconBookmark width={12} height={12} />
          从个人主页选
        </button>
        <div className="ml-auto flex gap-1.5">
          <button className="btn btn-ghost btn-sm" onClick={onCancel}>
            取消
          </button>
          <button
            className="btn btn-primary btn-sm"
            disabled={!text.trim()}
            onClick={() => {
              onAdd(text.trim(), type)
              setText('')
            }}
          >
            添加
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CardPanel({
  job,
  candidate,
  card,
  marks,
  flashId,
  busy,
  onMark,
  onDelete,
  onDeleteModule,
  onEvidence,
  onAdd,
  onMove,
  onRegenerate,
  onOpenProfile,
  onSaveCard,
  onRestoreCard,
  onUploadClick,
}: Props) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [addingIn, setAddingIn] = useState<string | null>(null)
  const [dragId, setDragId] = useState<string | null>(null)
  const [drop, setDrop] = useState<DropTarget | null>(null)
  const [burst, setBurst] = useState<{ x: number; y: number; color: string; k: number } | null>(null)

  const counts = useMemo(() => {
    const c = { core: 0, followup: 0, boundary: 0 }
    for (const q of card.questions) c[q.type] += 1
    return c
  }, [card])

  const integrity = useMemo(() => {
    if (!candidate) return { ok: 0, total: 0 }
    let ok = 0
    for (const q of card.questions) {
      const compOk = job.competencies.some((c) => c.id === q.competencyId)
      const claimOk = q.claimId
        ? (() => {
            const c = candidate.claims.find((x) => x.id === q.claimId)
            return !!c && candidate.resumeText.includes(c.rawText)
          })()
        : true
      if (compOk && claimOk) ok += 1
    }
    return { ok, total: card.questions.length }
  }, [card, candidate, job])

  const dirty = isDirtySinceSave(card)

  if (!candidate) {
    return (
      <section className="flex h-full flex-1 items-center justify-center bg-paper px-6">
        <div className="flex max-w-[400px] flex-col items-center text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-surface text-muted/50 shadow-sm">
            <IconUpload width={22} height={22} />
          </div>
          <h2 className="mt-4 text-[16px] font-semibold">「{job.title}」还没有候选人</h2>
          <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
            JD 已经存在这个岗位下了。上传第一份简历，就能按这份 JD 生成一页只针对他的问题。
          </p>
          <button className="btn btn-primary mt-5" onClick={onUploadClick}>
            <IconUpload width={14} height={14} />
            上传候选人简历
          </button>
        </div>
      </section>
    )
  }

  const handleMark = (q: Question, kind: MarkKind, e: MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    setBurst({ x: r.left + r.width / 2, y: r.top + r.height / 2, color: MARK_COLOR[kind], k: Date.now() })
    onMark(q, kind, r)
  }

  return (
    <section className="thin h-full min-w-0 flex-1 overflow-y-auto bg-paper">
      {busy && (
        <div className="pointer-events-none sticky top-0 z-30 flex justify-center">
          <div className="rise mt-3 flex items-center gap-2 rounded-full bg-ink px-4 py-2 text-[12px] font-medium text-white shadow-lg">
            <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-white/25 border-t-white" />
            正在按当前 JD 重新生成 {candidate.name} 的问题…
          </div>
        </div>
      )}

      <div className={`mx-auto max-w-[1020px] px-7 py-6 transition-opacity ${busy ? 'pointer-events-none opacity-40' : ''}`}>
        {/* 头部 */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-medium tracking-[0.14em] text-muted/60">INTERVIEW SHEET · 面试问题</div>
            <h1 className="mt-1.5 flex items-baseline gap-2.5 text-[23px] font-semibold tracking-tight">
              {candidate.name}
              <span className="text-[14px] font-normal text-muted">{job.title}</span>
            </h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button className="btn btn-outline" onClick={onOpenProfile}>
              <IconBookmark width={14} height={14} />
              个人主页
            </button>
            {card.savedAt ? (
              <button className="btn btn-outline" onClick={onSaveCard} title={`已保存于 ${dateTime(card.savedAt)}`}>
                <IconSave width={14} height={14} />
                更新保存
              </button>
            ) : (
              <button className="btn btn-outline" onClick={onSaveCard}>
                <IconSave width={14} height={14} />
                保存这份问题
              </button>
            )}
            <button className="btn btn-primary" onClick={onRegenerate}>
              <IconRefresh width={14} height={14} />
              重新生成
            </button>
          </div>
        </div>

        {/* 统计 */}
        <div className="mt-3.5 flex flex-wrap items-center gap-2">
          <span className="chip border border-line bg-surface px-2 py-[3px] text-[12px] text-ink/75">
            共 <b className="mx-0.5 tabular-nums">{card.questions.length}</b> 题
          </span>
          <span className="chip bg-teal-soft px-2 py-[3px] text-teal" title="全岗位同一道，换候选人不变">
            必问题 {counts.core}
          </span>
          <span className="chip bg-violet-soft px-2 py-[3px] text-violet">简历追问 {counts.followup}</span>
          <span className="chip bg-amber-soft px-2 py-[3px] text-amber">假设题 {counts.boundary}</span>
          <span
            className={`chip px-2 py-[3px] ${
              integrity.ok === integrity.total ? 'bg-teal-soft text-teal' : 'bg-amber-soft text-amber'
            }`}
            title="每道题引用的简历原文都必须能在简历里找到"
          >
            <IconShield width={11} height={11} />
            引用 {integrity.ok}/{integrity.total}
          </span>
          <span
            className={`ml-auto inline-flex items-center gap-1 text-[11.5px] ${
              card.source === 'live' ? 'text-teal' : card.source === 'fallback' ? 'text-amber' : 'text-muted/60'
            }`}
          >
            <IconSparkles width={12} height={12} />
            {card.source === 'live'
              ? `${card.model ?? 'AI'} 实时生成 · ${((card.latencyMs ?? 0) / 1000).toFixed(1)}s`
              : card.source === 'fallback'
                ? '预置样例 · 模型不可用'
                : '预置样例'}
          </span>
        </div>

        {/* 保存状态 */}
        {card.savedAt && (
          <div
            className={`mt-3 flex items-center gap-2 rounded-[11px] border px-3 py-2 text-[12px] ${
              dirty ? 'border-amber/25 bg-amber-soft/70 text-amber' : 'border-teal/20 bg-teal-soft/50 text-teal-dark'
            }`}
          >
            <IconSave width={12} height={12} />
            <span>
              已保存于 <b>{dateTime(card.savedAt)}</b>
              {dirty ? '　·　当前内容有改动' : '　·　面试当天在「个人主页」里直接打开'}
            </span>
            {dirty && (
              <div className="ml-auto flex items-center gap-1.5">
                <button className="btn btn-ghost btn-sm" onClick={onRestoreCard}>
                  恢复已保存
                </button>
                <button className="btn btn-primary btn-sm" onClick={onSaveCard}>
                  保存更新
                </button>
              </div>
            )}
          </div>
        )}

        {/* 怎么听 */}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-[11px] border border-teal/15 bg-teal-soft/40 px-3 py-2 text-[12px] text-teal-dark/90">
          <span className="font-semibold">怎么听</span>
          <span>① 有没有具体事实</span>
          <span>② 是不是本人做的</span>
          <span>③ 敢不敢讲失败</span>
          <span className="text-[11px] text-teal-dark/60">
            必问题人人相同，所以几位候选人能横向比 · 不用懂技术
          </span>
        </div>

        {card.questions.length === 0 && (
          <div className="card mt-4 flex flex-col items-center justify-center px-6 py-14 text-center">
            <p className="text-[14px] font-medium">这份问题清单还是空的</p>
            <p className="mt-1.5 text-[12px] text-muted">点「重新生成」按当前 JD 出一份，或从个人主页插入题目。</p>
            <button className="btn btn-primary mt-4" onClick={onRegenerate}>
              <IconRefresh width={14} height={14} />
              重新生成
            </button>
          </div>
        )}

        {/* 模块 */}
        <div className="mt-4 space-y-3.5">
          {job.competencies.map((comp, i) => {
            const qs = card.questions.filter((q) => q.competencyId === comp.id)
            const isCollapsed = collapsed.has(comp.id)
            const task = job.tasks.find((t) => comp.taskIds.includes(t.id))

            return (
              <div
                key={comp.id}
                className="card overflow-hidden"
                onDragOver={(e) => {
                  if (dragId) e.preventDefault()
                }}
                onDrop={(e) => {
                  if (!dragId) return
                  e.preventDefault()
                  onMove(dragId, undefined, comp.id)
                  setDragId(null)
                  setDrop(null)
                }}
              >
                <header className="flex items-start gap-3 bg-surface px-4 py-3">
                  <span className="mt-[2px] flex h-6 w-6 shrink-0 items-center justify-center rounded-[8px] bg-paper text-[11px] font-semibold tabular-nums text-muted">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-[15.5px] font-semibold tracking-[-0.01em] text-ink">{comp.name}</h3>
                      <ImportanceChip importance={comp.importance} />
                      <OriginTag origin={comp.origin} />
                      <span className="text-[11.5px] text-muted/60">{qs.length} 题</span>
                    </div>
                    {task && <p className="mt-1 line-clamp-1 text-[11.5px] text-muted/80">业务上对应：{task.description}</p>}
                  </div>
                  <div className="flex shrink-0 items-center gap-0.5">
                    <button
                      className="icon-btn"
                      title="在这个模块下加一道题"
                      onClick={() => setAddingIn((v) => (v === comp.id ? null : comp.id))}
                    >
                      <IconPlus width={16} height={16} />
                    </button>
                    <button className="icon-btn hover:text-rose" title="删掉整个模块" onClick={() => onDeleteModule(comp.id)}>
                      <IconTrash width={15} height={15} />
                    </button>
                    <button
                      className="icon-btn"
                      title="收起 / 展开"
                      onClick={() =>
                        setCollapsed((s) => {
                          const next = new Set(s)
                          if (next.has(comp.id)) next.delete(comp.id)
                          else next.add(comp.id)
                          return next
                        })
                      }
                    >
                      <IconChevronDown
                        width={16}
                        height={16}
                        className={`transition-transform ${isCollapsed ? '-rotate-90' : ''}`}
                      />
                    </button>
                  </div>
                </header>

                {!isCollapsed && (
                  <div className="divide-row border-t border-line/70">
                    {qs.length === 0 && (
                      <div className="px-4 py-5 text-center text-[12.5px] text-muted/60">
                        这个模块的问题都被删掉了，点右上角 ＋ 补充
                      </div>
                    )}
                    {qs.map((q, idx) => (
                      <QuestionRow
                        key={q.id}
                        q={q}
                        index={idx}
                        mark={marks.get(q.text) ?? []}
                        flash={flashId === q.claimId}
                        dragging={dragId === q.id}
                        drop={drop?.id === q.id ? drop : null}
                        onMark={(kind, e) => handleMark(q, kind, e)}
                        onDelete={() => onDelete(q.id)}
                        onEvidence={() => onEvidence(q)}
                        onDragStart={() => setDragId(q.id)}
                        onDragOverRow={(e) => {
                          if (!dragId || dragId === q.id) return
                          e.preventDefault()
                          e.stopPropagation()
                          const r = e.currentTarget.getBoundingClientRect()
                          setDrop({ id: q.id, pos: e.clientY < r.top + r.height / 2 ? 'before' : 'after' })
                        }}
                        onDropRow={(e) => {
                          if (!dragId) return
                          e.preventDefault()
                          e.stopPropagation()
                          if (dragId !== q.id) onMove(dragId, q.id, comp.id, drop?.pos ?? 'before')
                          setDragId(null)
                          setDrop(null)
                        }}
                        onDragEnd={() => {
                          setDragId(null)
                          setDrop(null)
                        }}
                      />
                    ))}
                    {addingIn === comp.id && (
                      <AddQuestion
                        onAdd={(text, type) => {
                          onAdd(comp.id, text, type)
                          setAddingIn(null)
                        }}
                        onCancel={() => setAddingIn(null)}
                        onOpenLibrary={onOpenProfile}
                      />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {burst && (
        <Burst key={burst.k} x={burst.x} y={burst.y} color={burst.color} onDone={() => setBurst(null)} />
      )}
    </section>
  )
}
