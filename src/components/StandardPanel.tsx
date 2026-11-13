import { useEffect, useMemo, useState } from 'react'
import type { AlignmentIssue, JobProfile } from '../data/types'
import type { CompetencyPatch } from '../lib/store'
import { IconAlert, IconCheck, IconCheckCircle, IconChevronRight, IconRefresh, IconShield } from './Icons'
import { Drawer, OriginTag } from './ui'

/* ------------------------------ 顶部标准条 ------------------------------ */

export function StandardBar({
  job,
  staleFrom,
  onOpen,
  onRegenerate,
}: {
  job: JobProfile
  staleFrom: number | null
  onOpen: () => void
  onRegenerate: () => void
}) {
  const open = job.issues.filter((i) => i.status === 'open').length

  if (staleFrom !== null) {
    return (
      <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-amber/20 bg-amber-soft px-6 py-2.5">
        <IconAlert width={15} height={15} className="shrink-0 text-amber" />
        <div className="text-[12.5px] text-amber">
          岗位标准已更新至 <b>v{job.version}</b>（草稿），当前面试卡仍基于 <b>v{staleFrom}</b>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <button className="btn btn-ghost py-1 text-[12px] text-amber/80 hover:bg-white/60" onClick={onOpen}>
            查看标准
            <IconChevronRight width={12} height={12} />
          </button>
          <button
            className="btn btn-outline border-amber/30 py-1 text-[12px] text-amber hover:bg-white"
            onClick={onRegenerate}
          >
            <IconRefresh width={13} height={13} />
            按新标准重新生成
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-line bg-paper/85 px-6 py-2.5 backdrop-blur">
      <IconShield width={15} height={15} className="text-teal" />
      <div className="flex items-center gap-1.5">
        <span className="text-[12.5px] font-semibold">岗位标准</span>
        <span className="chip bg-teal-soft text-teal">v{job.version} 已确认</span>
      </div>
      <div className="h-3.5 w-px bg-line" />
      <div className="flex min-w-0 flex-wrap items-center gap-1">
        {job.competencies.map((c) => (
          <span key={c.id} className="chip border border-line bg-surface text-ink/75">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                c.importance === 'core' ? 'bg-teal' : c.importance === 'important' ? 'bg-muted/50' : 'bg-amber'
              }`}
            />
            {c.name}
          </span>
        ))}
      </div>
      <button
        className="btn btn-ghost ml-auto py-1 text-[12px]"
        onClick={onOpen}
      >
        {open > 0 ? (
          <span className="flex items-center gap-1.5 text-amber">
            <IconAlert width={13} height={13} />
            {open} 项待处理
          </span>
        ) : (
          <span className="flex items-center gap-1.5 text-teal">
            <IconCheckCircle width={13} height={13} />
            差异已处理
          </span>
        )}
        <IconChevronRight width={13} height={13} />
      </button>
    </div>
  )
}

/* ------------------------------ 标准抽屉 ------------------------------ */

const RESOLUTION_LABEL = {
  hard: '保留为硬性要求',
  preferred: '调整为优先项',
  discuss: '需进一步讨论',
} as const

function IssueCard({
  issue,
  onResolve,
}: {
  issue: AlignmentIssue
  onResolve: (id: string, r: 'hard' | 'preferred' | 'discuss') => void
}) {
  const resolved = issue.status === 'resolved'
  return (
    <div className={`rounded-lg border p-3 ${resolved ? 'border-teal/25 bg-teal-soft/25' : 'border-line bg-surface'}`}>
      <div className="flex items-center gap-2">
        <span className={`chip ${issue.kind === 'conflict' ? 'bg-amber-soft text-amber' : 'bg-violet-soft text-violet'}`}>
          {issue.kind === 'conflict' ? '要求冲突' : '信息缺口'}
        </span>
        <span className="text-[12.5px] font-medium">{issue.title}</span>
        <span className={`ml-auto text-[11px] ${resolved ? 'text-teal' : 'text-amber'}`}>
          {resolved ? `已处理 · ${RESOLUTION_LABEL[issue.resolution ?? 'discuss']}` : '待处理'}
        </span>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto_1fr] items-stretch gap-2">
        <div className="rounded-md border border-line/70 bg-paper/70 p-2">
          <div className="mb-1 text-[10px] font-medium tracking-wide text-muted">HR 提供的 JD</div>
          <p className="text-[11.5px] leading-[1.65] text-ink/80">{issue.jdText}</p>
        </div>
        <div className="flex items-center text-[10px] font-medium text-muted/50">VS</div>
        <div className="rounded-md border border-violet/15 bg-violet-soft/60 p-2">
          <div className="mb-1 text-[10px] font-medium tracking-wide text-violet">业务主管补充</div>
          <p className="text-[11.5px] leading-[1.65] text-ink/80">{issue.managerText}</p>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-1.5">
        {(['hard', 'preferred', 'discuss'] as const).map((r) => (
          <button
            key={r}
            onClick={() => onResolve(issue.id, r)}
            className={`cursor-pointer rounded-md border px-2 py-1 text-[11px] transition ${
              issue.resolution === r
                ? 'border-teal/40 bg-teal-soft font-medium text-teal-dark'
                : 'border-line bg-surface text-muted hover:border-teal/30 hover:text-ink'
            }`}
          >
            {RESOLUTION_LABEL[r]}
          </button>
        ))}
      </div>
      <p className="mt-2 text-[10.5px] leading-relaxed text-muted/70">
        AI 只提出差异，不代替业务方拍板；这一项不会被模型自动融合。
      </p>
    </div>
  )
}

export function StandardDrawer({
  open,
  job,
  onClose,
  onResolve,
  onReopen,
  onSave,
}: {
  open: boolean
  job: JobProfile
  onClose: () => void
  onResolve: (id: string, r: 'hard' | 'preferred' | 'discuss') => void
  onReopen: (id: string) => void
  onSave: (patches: CompetencyPatch[]) => void
}) {
  const [names, setNames] = useState<Record<string, string>>({})
  const [importance, setImportance] = useState<Record<string, 'core' | 'important' | 'plus'>>({})

  useEffect(() => {
    if (!open) return
    const n: Record<string, string> = {}
    const im: Record<string, 'core' | 'important' | 'plus'> = {}
    for (const c of job.competencies) {
      n[c.id] = c.name
      im[c.id] = c.importance
    }
    setNames(n)
    setImportance(im)
  }, [open, job])

  const patches = useMemo<CompetencyPatch[]>(
    () =>
      job.competencies
        .filter((c) => names[c.id] !== c.name || importance[c.id] !== c.importance)
        .map((c) => ({ id: c.id, name: names[c.id] ?? c.name, importance: importance[c.id] ?? c.importance })),
    [job, names, importance],
  )

  const dirty = patches.length > 0

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      title="岗位能力标准"
      subtitle={`${job.title} · ${job.department} · ${job.approvedBy ?? '待确认'}`}
      footer={
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-muted">
            {dirty ? '修改后需重新生成面试卡，已确认的 v' + job.version + ' 不会被静默覆盖' : '当前为标准 v' + job.version}
          </span>
          <div className="ml-auto flex gap-2">
            <button className="btn btn-ghost" onClick={onClose}>
              关闭
            </button>
            <button className="btn btn-primary" disabled={!dirty} onClick={() => onSave(patches)}>
              保存为 v{job.version + 1} 草稿
            </button>
          </div>
        </div>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-paper px-3 py-2 text-[11.5px]">
        <span className="text-muted">
          状态：
          <b className={job.status === 'confirmed' ? 'text-teal' : 'text-amber'}>
            {job.status === 'confirmed' ? '已确认' : '草稿 · 待确认'}
          </b>
        </span>
        <span className="text-muted">
          版本：<b className="text-ink">v{job.version}</b>
        </span>
        <span className="text-muted">
          能力项：<b className="text-ink">{job.competencies.length}</b>
        </span>
        <span className="text-muted/70">
          最近更新 {new Date(job.updatedAt).toLocaleString('zh-CN', { hour12: false }).slice(0, 16)}
        </span>
      </div>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="label">从业务任务推导出的能力标准</span>
        <span className="text-[10.5px] text-muted/60">名称与权重可由主管直接修改</span>
      </div>

      <div className="divide-row overflow-hidden rounded-lg border border-line">
        {job.competencies.map((c, i) => (
          <div key={c.id} className="bg-surface px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="w-4 text-[10px] tabular-nums text-muted/50">{String(i + 1).padStart(2, '0')}</span>
              <input
                className="min-w-0 flex-1 rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[13px] font-medium outline-none hover:border-line focus:border-teal/40 focus:bg-white"
                value={names[c.id] ?? c.name}
                onChange={(e) => setNames((s) => ({ ...s, [c.id]: e.target.value }))}
              />
              <select
                className="cursor-pointer rounded-md border border-line bg-surface px-1.5 py-1 text-[11px] text-muted outline-none"
                value={importance[c.id] ?? c.importance}
                onChange={(e) =>
                  setImportance((s) => ({ ...s, [c.id]: e.target.value as 'core' | 'important' | 'plus' }))
                }
              >
                <option value="core">核心考察</option>
                <option value="important">重要</option>
                <option value="plus">加分项</option>
              </select>
            </div>
            <div className="mt-1 flex items-start gap-2 pl-6">
              <div className="min-w-0 flex-1">
                <ul className="space-y-0.5">
                  {c.behaviors.slice(0, 2).map((b) => (
                    <li key={b} className="text-[11px] leading-[1.6] text-muted">
                      · {b}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <OriginTag origin={c.origin} />
                {c.edited && <span className="chip bg-teal-soft text-[10px] text-teal">已修改</span>}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 mb-2 flex items-baseline justify-between">
        <span className="label">JD 里可能筛错人的地方</span>
        <span className="text-[11px] text-muted/60">
          待确认 {job.issues.filter((i) => i.status === 'open').length} · 已处理{' '}
          {job.issues.filter((i) => i.status === 'resolved').length}
        </span>
      </div>

      <div className="space-y-2.5">
        {job.issues.filter((i) => i.status === 'open').map((issue) => (
          <IssueCard key={issue.id} issue={issue} onResolve={onResolve} />
        ))}
        {job.issues.every((i) => i.status === 'resolved') && (
          <p className="rounded-lg border border-dashed border-line px-3 py-3 text-center text-[11.5px] text-muted/70">
            全部处理完了。你的决定都记在下面的「已处理」里，随时可以改判。
          </p>
        )}
      </div>

      {job.issues.some((i) => i.status === 'resolved') && (
        <>
          <div className="mt-5 mb-2 flex items-baseline justify-between">
            <span className="label">已处理（可以改判）</span>
            <span className="text-[11px] text-muted/60">这就是刚才那些选择去的地方</span>
          </div>
          <div className="divide-row overflow-hidden rounded-lg border border-line">
            {job.issues
              .filter((i) => i.status === 'resolved')
              .map((issue) => (
                <div key={issue.id} className="flex items-center gap-2 bg-surface px-3 py-2.5">
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-teal-soft text-teal">
                    <IconCheck width={10} height={10} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[12px] font-medium text-ink/85">{issue.title}</div>
                    <div className="mt-0.5 text-[10.5px] text-muted/70">
                      已定为「{RESOLUTION_LABEL[issue.resolution ?? 'discuss']}」
                    </div>
                  </div>
                  <button
                    className="btn btn-ghost btn-sm shrink-0"
                    onClick={() => onReopen(issue.id)}
                    title="撤销这个决定，重新处理"
                  >
                    改判
                  </button>
                </div>
              ))}
          </div>
        </>
      )}
    </Drawer>
  )
}
