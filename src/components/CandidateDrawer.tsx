import { useMemo, useState } from 'react'
import type { Candidate, JobProfile } from '../data/types'
import { levelRank } from '../lib/resume'
import { dateTime, relTime } from '../lib/time'
import { IconArrowUpRight, IconTrash, IconUser, IconX } from './Icons'
import { Drawer } from './ui'

type SortKey = 'added' | 'updated' | 'edu' | 'grad'

const SORTS: { key: SortKey; label: string; hint: string }[] = [
  { key: 'added', label: '最新添加', hint: '按加入这个岗位的时间，新的在前' },
  { key: 'updated', label: '最近更新', hint: '按最后一次生成或保存问题的时间，新的在前' },
  { key: 'edu', label: '第一学历', hint: '按学历层次从高到低，解析不到的在最后' },
  { key: 'grad', label: '毕业时间', hint: '按毕业年份从近到远，解析不到的在最后' },
]

export default function CandidateDrawer({
  open,
  job,
  candidates,
  savedMap,
  onClose,
  onOpen,
  onDelete,
}: {
  open: boolean
  job: JobProfile
  candidates: Candidate[]
  savedMap: Record<string, string | undefined>
  onClose: () => void
  onOpen: (id: string) => void
  onDelete: (id: string) => void
}) {
  const [sort, setSort] = useState<SortKey>('added')
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const list = [...candidates]
    const time = (s?: string) => (s ? new Date(s).getTime() : 0)
    switch (sort) {
      case 'added':
        return list.sort((a, b) => time(b.addedAt) - time(a.addedAt))
      case 'updated':
        return list.sort((a, b) => time(b.updatedAt ?? b.addedAt) - time(a.updatedAt ?? a.addedAt))
      case 'edu':
        return list.sort((a, b) => levelRank(b.educationLevel) - levelRank(a.educationLevel))
      case 'grad':
        return list.sort((a, b) => (b.gradYear ?? -1) - (a.gradYear ?? -1))
      default:
        return list
    }
  }, [candidates, sort])

  const activeSort = SORTS.find((s) => s.key === sort)!

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={620}
      title={`全部候选人 · ${candidates.length}`}
      subtitle={`${job.title} · 这个岗位下的所有简历，随时切回去`}
      footer={
        <div className="flex items-center gap-2 text-[11.5px] text-muted">
          {activeSort.hint}
          <button className="btn btn-ghost ml-auto" onClick={onClose}>
            关闭
          </button>
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={`h-7 cursor-pointer rounded-[9px] border px-2.5 text-[12px] font-medium transition ${
              sort === s.key
                ? 'border-teal/40 bg-teal-soft text-teal-dark'
                : 'border-line bg-surface text-muted hover:text-ink'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-[14px] border border-dashed border-line py-14 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-paper text-muted/50">
            <IconUser width={18} height={18} />
          </div>
          <p className="mt-3 text-[13px] font-medium">这个岗位还没有候选人</p>
          <p className="mt-1 text-[11.5px] text-muted">回左侧点「上传」，简历会挂在这个岗位下面。</p>
        </div>
      ) : (
        <div className="divide-row overflow-hidden rounded-[14px] border border-line">
          {rows.map((c) => (
            <div key={c.id} className="flex items-center gap-3 bg-surface px-3.5 py-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-paper text-[12px] font-semibold text-muted">
                {c.name.slice(0, 1)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13.5px] font-medium">{c.name}</span>
                  <span className="text-[11.5px] text-muted/70">{c.headline}</span>
                  {savedMap[c.id] && (
                    <span className="chip bg-teal-soft text-[10px] text-teal">
                      已保存 {dateTime(savedMap[c.id])}
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[11px] text-muted/65">
                  <span>{c.educationLevel ?? '学历未知'}{c.gradYear ? ` · ${c.gradYear} 毕业` : ''}</span>
                  <span className="text-muted/30">·</span>
                  <span>加入于 {relTime(c.addedAt)}</span>
                  <span className="text-muted/30">·</span>
                  <span>{c.claims.length} 条线索</span>
                </div>
              </div>

              {confirmId === c.id ? (
                <div className="flex shrink-0 items-center gap-1.5">
                  <span className="text-[11.5px] text-rose">连问题一起删掉？</span>
                  <button
                    className="btn btn-sm bg-rose text-white hover:opacity-90"
                    onClick={() => {
                      onDelete(c.id)
                      setConfirmId(null)
                    }}
                  >
                    删除
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setConfirmId(null)}>
                    取消
                  </button>
                </div>
              ) : (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => {
                      onOpen(c.id)
                      onClose()
                    }}
                  >
                    打开
                    <IconArrowUpRight width={12} height={12} />
                  </button>
                  <button className="icon-btn hover:text-rose" title="删除这份简历" onClick={() => setConfirmId(c.id)}>
                    <IconTrash width={14} height={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted/60">
        <IconX width={11} height={11} />
        删除简历会同时删掉为这位候选人保存的面试问题，无法恢复。
      </p>
    </Drawer>
  )
}
