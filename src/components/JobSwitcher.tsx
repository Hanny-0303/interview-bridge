import { useEffect, useRef, useState } from 'react'
import type { JobProfile } from '../data/types'
import { relTime } from '../lib/time'
import { IconChevronDown, IconPlus, IconStar } from './Icons'

interface Props {
  jobs: JobProfile[]
  activeJobId: string
  onSwitch: (id: string) => void
  onToggleFavorite: (id: string) => void
  onNew: () => void
}

export default function JobSwitcher({ jobs, activeJobId, onSwitch, onToggleFavorite, onNew }: Props) {
  const [open, setOpen] = useState(false)
  const boxRef = useRef<HTMLDivElement>(null)
  const job = jobs.find((j) => j.id === activeJobId) ?? jobs[0]

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const sorted = [...jobs].sort((a, b) => {
    if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })

  return (
    <div className="relative min-w-0" ref={boxRef}>
      <button
        className={`flex h-8 min-w-0 cursor-pointer items-center gap-1.5 rounded-[10px] border px-2.5 transition-colors ${
          open
            ? 'border-teal/50 bg-teal-soft text-teal-dark'
            : 'border-teal/25 bg-teal-soft/70 text-teal-dark hover:border-teal/40 hover:bg-teal-soft'
        }`}
        onClick={() => setOpen((v) => !v)}
        title="切换岗位（JD 已保存，可随时回到这个岗位继续面试）"
      >
        <span className="truncate text-[12.5px] font-semibold">{job.title}</span>
        <span className="shrink-0 rounded-[6px] bg-white/70 px-1.5 py-[1px] text-[10.5px] font-medium text-teal-dark/70">
          {job.department}
        </span>
        <IconChevronDown width={13} height={13} className={`shrink-0 text-teal/70 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="rise absolute top-[calc(100%+6px)] left-0 z-40 w-[340px] overflow-hidden rounded-xl border border-line bg-surface shadow-[0_12px_32px_-12px_rgba(15,26,29,.35)]">
          <div className="flex items-center justify-between border-b border-line/70 px-3 py-2">
            <span className="text-[11px] font-medium text-muted">岗位库 · {jobs.length} 个岗位</span>
            <span className="text-[10.5px] text-muted/60">JD 已保存，随时可切回</span>
          </div>

          <div className="thin max-h-[320px] overflow-y-auto">
            {sorted.map((j) => {
              const active = j.id === activeJobId
              return (
                <div
                  key={j.id}
                  className={`group flex items-start gap-2 border-b border-line/40 px-3 py-2 last:border-0 ${
                    active ? 'bg-teal-soft/40' : 'hover:bg-paper/70'
                  }`}
                >
                  <button
                    className="mt-[1px] shrink-0 cursor-pointer text-muted/40 hover:text-amber"
                    onClick={() => onToggleFavorite(j.id)}
                    title={j.favorite ? '取消收藏' : '收藏并置顶'}
                  >
                    <IconStar width={13} height={13} filled={j.favorite} className={j.favorite ? 'text-amber' : ''} />
                  </button>
                  <button
                    className="min-w-0 flex-1 cursor-pointer text-left"
                    onClick={() => {
                      onSwitch(j.id)
                      setOpen(false)
                    }}
                  >
                    <div className="flex items-center gap-1.5">
                      <span className={`truncate text-[12.5px] ${active ? 'font-semibold text-teal-dark' : 'text-ink'}`}>
                        {j.title}
                      </span>
                      {active && <span className="chip bg-teal-soft text-[9.5px] text-teal">当前</span>}
                    </div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-[10.5px] text-muted/70">
                      <span>{j.department}</span>
                      <span>·</span>
                      <span>v{j.version}</span>
                      <span>·</span>
                      <span>更新于 {relTime(j.updatedAt)}</span>
                    </div>
                  </button>
                </div>
              )
            })}
          </div>

          <button
            className="flex w-full cursor-pointer items-center gap-1.5 border-t border-line px-3 py-2 text-[12px] text-teal hover:bg-teal-soft/50"
            onClick={() => {
              onNew()
              setOpen(false)
            }}
          >
            <IconPlus width={13} height={13} />
            新建岗位（粘贴 JD）
          </button>
        </div>
      )}
    </div>
  )
}
