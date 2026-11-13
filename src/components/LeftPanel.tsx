import { memo, useMemo, useRef, useState } from 'react'
import type { Candidate, JobProfile, ResumeClaim } from '../data/types'
import { dateTime } from '../lib/time'
import { IconChevronDown, IconEdit, IconFile, IconPaste, IconUpload, IconUser } from './Icons'

interface Props {
  job: JobProfile
  candidates: Candidate[]
  activeId: string
  claims: ResumeClaim[]
  activeClaimId?: string
  parsing: boolean
  savedMap: Record<string, string | undefined>
  onSwitch: (id: string) => void
  onClaimClick: (claim: ResumeClaim) => void
  onUpload: (file: File) => void
  onPaste: () => void
  onOpenAll: () => void
  onUpdateJd: (text: string) => void
}

type Segment = { text: string; claim?: ResumeClaim }

/** 简历正文单独 memo：拖拽调高度时不该重排这 400 多个片段 */
const ResumeBody = memo(function ResumeBody({
  segments,
  activeClaimId,
  onClaimClick,
}: {
  segments: Segment[]
  activeClaimId?: string
  onClaimClick: (c: ResumeClaim) => void
}) {
  return (
    <p className="text-[12.5px] leading-[1.9] whitespace-pre-wrap text-ink/85">
      {segments.map((s, i) =>
        s.claim ? (
          <mark
            key={i}
            className={`claim ${activeClaimId === s.claim.id ? 'active' : ''}`}
            onClick={() => onClaimClick(s.claim!)}
            title="点击定位到对应面试题"
          >
            {s.text}
          </mark>
        ) : (
          <span key={i}>{s.text}</span>
        ),
      )}
    </p>
  )
})

/** JD 正文同理 */
const JdBody = memo(function JdBody({ lines, height }: { lines: { text: string; isNew: boolean }[]; height: number }) {
  return (
    <div className="thin overflow-y-auto rounded-[10px] bg-paper/60 px-2.5 py-2" style={{ height }}>
      {lines.map((line, i) =>
        line.text.trim() ? (
          <div
            key={i}
            id={line.isNew && !lines.slice(0, i).some((l) => l.isNew) ? 'jd-new-0' : undefined}
            className={`mb-0.5 rounded-[6px] px-1.5 py-[1px] text-[12px] leading-[1.8] ${
              line.isNew ? 'bg-teal-soft/70 text-ink/85' : 'text-ink/70'
            }`}
          >
            {line.isNew && <span className="mr-1 rounded-[4px] bg-teal/15 px-1 text-[10px] font-medium text-teal">新增</span>}
            {line.text}
          </div>
        ) : (
          <div key={i} className="h-1.5" />
        ),
      )}
    </div>
  )
})

export default function LeftPanel({
  job,
  candidates,
  activeId,
  claims,
  activeClaimId,
  parsing,
  savedMap,
  onSwitch,
  onClaimClick,
  onUpload,
  onPaste,
  onOpenAll,
  onUpdateJd,
}: Props) {
  const candidate = candidates.find((c) => c.id === activeId)
  const fileRef = useRef<HTMLInputElement>(null)

  const [jdOpen, setJdOpen] = useState(true)
  const [jdH, setJdH] = useState(200)
  const [editingJd, setEditingJd] = useState(false)
  const [jdDraft, setJdDraft] = useState(job.jdText)
  const [claimH, setClaimH] = useState(224)
  const drag = useRef<{ kind: 'jd' | 'claims'; y: number; h: number; moved: boolean; raf: number } | null>(null)

  const segments = useMemo<Segment[]>(() => {
    const text = candidate?.resumeText ?? ''
    const ranges = claims
      .filter((c) => c.start >= 0 && text.slice(c.start, c.start + c.rawText.length) === c.rawText)
      .map((c) => ({ start: c.start, end: c.start + c.rawText.length, claim: c }))
      .sort((a, b) => a.start - b.start)

    const out: Segment[] = []
    let cursor = 0
    for (const r of ranges) {
      if (r.start < cursor) continue
      if (r.start > cursor) out.push({ text: text.slice(cursor, r.start) })
      out.push({ text: text.slice(r.start, r.end), claim: r.claim })
      cursor = r.end
    }
    if (cursor < text.length) out.push({ text: text.slice(cursor) })
    return out
  }, [candidate, claims])

  const jdLines = useMemo(() => {
    const baseline = new Set(
      job.baselineJd
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    )
    return job.jdText.split('\n').map((line) => ({
      text: line,
      isNew: Boolean(line.trim()) && !baseline.has(line.trim()),
    }))
  }, [job.jdText, job.baselineJd])

  const newCount = jdLines.filter((l) => l.isNew).length

  /* 拖拽只改高度，用 rAF 合并到一帧，避免每个 pointermove 都渲染 */
  const startDrag = (kind: 'jd' | 'claims') => (e: React.PointerEvent) => {
    const h = kind === 'jd' ? (jdOpen ? jdH : 0) : claimH
    drag.current = { kind, y: e.clientY, h, moved: false, raf: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const onDrag = (e: React.PointerEvent) => {
    const s = drag.current
    if (!s) return
    const dy = e.clientY - s.y
    if (Math.abs(dy) > 3) s.moved = true
    if (s.raf) return
    s.raf = requestAnimationFrame(() => {
      s.raf = 0
      if (s.kind === 'jd') {
        setJdOpen(true)
        setJdH(Math.min(440, Math.max(80, s.h + dy)))
      } else {
        setClaimH(Math.min(360, Math.max(0, s.h - dy)))
      }
    })
  }
  const endDrag = (e: React.PointerEvent) => {
    const s = drag.current
    drag.current = null
    if (!s) return
    if (s.raf) cancelAnimationFrame(s.raf)
    if (s.kind === 'jd') {
      if (!s.moved) setJdOpen((v) => !v)
      else setJdH((h) => (h < 100 ? 80 : h))
    } else if (!s.moved) {
      setClaimH(claimH <= 42 ? 224 : 0)
    } else {
      setClaimH((h) => (h < 90 ? 0 : h))
    }
    ;(e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId)
  }

  const claimsCollapsed = claimH <= 42

  return (
    <aside className="flex h-full min-h-0 flex-col border-r border-line bg-surface">
      {/* 一、岗位 JD */}
      <section className="shrink-0 border-b border-line">
        <button
          className="flex w-full cursor-pointer items-center gap-2 px-4 py-2.5 text-left hover:bg-paper/60"
          onClick={() => setJdOpen((v) => !v)}
        >
          <IconFile width={14} height={14} className="text-teal" />
          <span className="section-title">岗位 JD</span>
          <span className="chip bg-teal-soft text-[10.5px] text-teal">v{job.version}</span>
          <span className="truncate text-[11.5px] text-muted">{job.title}</span>
          {newCount > 0 && (
            <span
              className="shrink-0 cursor-pointer text-[10.5px] text-violet hover:underline"
              title="跳到 HR 后来加的内容"
              onClick={(e) => {
                e.stopPropagation()
                setJdOpen(true)
                window.setTimeout(
                  () => document.getElementById('jd-new-0')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }),
                  60,
                )
              }}
            >
              含 {newCount} 条新增 ↓
            </span>
          )}
          <IconChevronDown
            width={14}
            height={14}
            className={`ml-auto shrink-0 text-muted/60 transition-transform ${jdOpen ? '' : '-rotate-90'}`}
          />
        </button>

        {jdOpen && (
          <>
            <div className="px-4">
              {editingJd ? (
                <div>
                  <textarea
                    className="field resize-none text-[12px] leading-[1.8]"
                    style={{ height: Math.max(120, jdH - 36) }}
                    value={jdDraft}
                    onChange={(e) => setJdDraft(e.target.value)}
                  />
                  <div className="mt-2 mb-2 flex justify-end gap-1.5">
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => {
                        setJdDraft(job.jdText)
                        setEditingJd(false)
                      }}
                    >
                      取消
                    </button>
                    <button
                      className="btn btn-primary btn-sm"
                      onClick={() => {
                        onUpdateJd(jdDraft)
                        setEditingJd(false)
                      }}
                    >
                      保存 JD
                    </button>
                  </div>
                </div>
              ) : (
                <JdBody lines={jdLines} height={jdH} />
              )}
            </div>

            {!editingJd && (
              <div className="flex items-center justify-between px-4 py-1.5">
                <button
                  className="btn btn-ghost btn-sm -ml-1.5 text-teal hover:bg-teal-soft"
                  onClick={() => {
                    setJdDraft(job.jdText)
                    setEditingJd(true)
                  }}
                >
                  <IconEdit width={12} height={12} />
                  直接改 JD
                </button>
                <span className="text-[10.5px] text-muted/50">上下拖动调高度</span>
              </div>
            )}

            <div
              className="group flex h-4 cursor-ns-resize touch-none items-center justify-center"
              onPointerDown={startDrag('jd')}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              title="按住拖动，调整 JD 区域高度"
            >
              <span className="h-[3px] w-9 rounded-full bg-line transition-all group-hover:w-14 group-hover:bg-teal/50" />
            </div>
          </>
        )}
      </section>

      {/* 二、候选人 */}
      <div className="shrink-0 border-b border-line px-4 py-2.5">
        <div className="thin flex items-center gap-1.5 overflow-x-auto">
          {candidates.length === 0 && <span className="text-[11.5px] text-muted/60">这个岗位还没有候选人</span>}
          {candidates.map((c) => (
            <button
              key={c.id}
              onClick={() => onSwitch(c.id)}
              className={`flex max-w-[100px] shrink-0 cursor-pointer items-center gap-1 rounded-[9px] border px-2 py-1 text-[12px] transition ${
                c.id === activeId
                  ? 'border-teal/40 bg-teal-soft font-medium text-teal-dark'
                  : 'border-line bg-surface text-muted hover:bg-paper'
              }`}
              title={savedMap[c.id] ? `问题已保存于 ${dateTime(savedMap[c.id])}` : '问题尚未保存'}
            >
              <IconUser width={11} height={11} />
              <span className="truncate">{c.name}</span>
              {savedMap[c.id] && <span className="ml-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />}
            </button>
          ))}
          <button
            className="ml-auto inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[9px] border border-line bg-surface px-2 text-[11.5px] text-muted hover:border-teal/40 hover:text-teal"
            onClick={onOpenAll}
            title="查看这个岗位的全部候选人"
          >
            全部 {candidates.length}
          </button>
          <button
            className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[9px] border border-dashed border-line px-2 text-[11.5px] text-muted hover:border-teal/40 hover:text-teal"
            onClick={() => fileRef.current?.click()}
          >
            <IconUpload width={11} height={11} />
            上传
          </button>
          <button
            className="inline-flex h-7 shrink-0 cursor-pointer items-center gap-1 rounded-[9px] border border-dashed border-line px-2 text-[11.5px] text-muted hover:border-teal/40 hover:text-teal"
            onClick={onPaste}
          >
            <IconPaste width={11} height={11} />
            粘贴
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.docx,.doc,.txt,.md"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onUpload(f)
            e.target.value = ''
          }}
        />
      </div>

      {/* 三、简历原文 */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex shrink-0 items-center gap-2 border-b border-line/70 bg-paper/50 px-4 py-1.5">
          <span className="text-[11.5px] font-medium">简历原文</span>
          {candidate?.source === 'upload' && (
            <span className="chip bg-violet-soft text-[10px] text-violet">已上传</span>
          )}
          <span className="ml-auto truncate text-[10.5px] text-muted/70">
            {candidate ? `${candidate.resumeText.length} 字` : '未选择候选人'}
          </span>
        </div>

        <div className="thin min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {candidate?.resumeText.trim() ? (
            <ResumeBody segments={segments} activeClaimId={activeClaimId} onClaimClick={onClaimClick} />
          ) : (
            <button
              className="flex h-full w-full cursor-pointer flex-col items-center justify-center gap-2 text-muted/60"
              onClick={() => fileRef.current?.click()}
            >
              <IconUpload width={22} height={22} />
              <span className="text-[12px]">拖入或点击上传简历</span>
              <span className="text-[11px] text-muted/45">支持 PDF / DOCX / TXT，也可以直接粘贴</span>
            </button>
          )}
          <div className="pointer-events-none sticky bottom-0 -mb-3 h-7 bg-gradient-to-t from-white via-white/80 to-transparent" />
          {parsing && (
            <div className="mt-2 flex items-center gap-2 text-[11.5px] text-teal">
              <span className="h-3 w-3 animate-spin rounded-full border-[1.5px] border-teal/25 border-t-teal" />
              正在解析简历…
            </div>
          )}
        </div>
      </div>

      {/* 四、简历线索 */}
      <div className="shrink-0 border-t border-line bg-surface" style={{ height: claimsCollapsed ? 34 : claimH }}>
        <div
          className="group flex h-[34px] cursor-ns-resize touch-none items-center gap-1.5 border-b border-line/60 px-4 select-none hover:bg-paper/60"
          onPointerDown={startDrag('claims')}
          onPointerMove={onDrag}
          onPointerUp={endDrag}
          title={claimsCollapsed ? '上拉展开简历线索' : '下拉收起'}
        >
          <span className="h-[3px] w-7 shrink-0 rounded-full bg-line transition-colors group-hover:bg-teal/50" />
          <span className="text-[12px] font-semibold">简历线索</span>
          <span className="chip bg-paper text-[10.5px] text-muted">{claims.length}</span>
          <span className="truncate text-[10.5px] text-muted/55">上下拖动可收起 · 陈述 ≠ 已验证能力</span>
          <IconChevronDown
            width={12}
            height={12}
            className={`ml-auto text-muted/50 transition-transform ${claimsCollapsed ? 'rotate-180' : ''}`}
          />
        </div>
        {!claimsCollapsed && (
          <div className="thin overflow-y-auto" style={{ height: claimH - 34 }}>
            {claims.length === 0 && (
              <p className="px-4 py-3 text-[11.5px] text-muted/60">
                {candidate ? '这份简历里没有抽到可追问的线索。' : '先选一位候选人。'}
              </p>
            )}
            {claims.map((c, i) => (
              <button
                key={c.id}
                onClick={() => onClaimClick(c)}
                className={`block w-full cursor-pointer border-b border-line/40 px-4 py-2 text-left last:border-0 hover:bg-paper ${
                  activeClaimId === c.id ? 'bg-violet-soft/40' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  <span className="mt-[2px] w-4 shrink-0 text-[10px] tabular-nums text-muted/40">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="line-clamp-2 flex-1 text-[12px] leading-[1.6] text-ink/80">{c.rawText}</p>
                  {c.unverified && <span className="chip shrink-0 bg-amber-soft text-[9.5px] text-amber">短板</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}
