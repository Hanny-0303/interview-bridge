import { useMemo, useState } from 'react'
import type { Candidate, InterviewCard, JobProfile, LibraryItem } from '../data/types'
import { dateTime, relTime } from '../lib/time'
import { IconArrowUpRight, IconBookmark, IconHeart, IconPlus, IconStar, IconTrash, IconX } from './Icons'
import { TypeChip } from './ui'

type Tab = 'marks' | 'saved'
type Filter = 'all' | 'like' | 'fav'

export default function ProfileDrawer({
  open,
  onClose,
  library,
  jobs,
  candidates,
  cards,
  onInsert,
  onRemove,
  onOpenSaved,
}: {
  open: boolean
  onClose: () => void
  library: LibraryItem[]
  jobs: JobProfile[]
  candidates: Candidate[]
  cards: Record<string, InterviewCard>
  onInsert: (id: string) => void
  onRemove: (id: string) => void
  onOpenSaved: (jobId: string, candidateId: string) => void
}) {
  const [tab, setTab] = useState<Tab>('marks')
  const [filter, setFilter] = useState<Filter>('all')

  const likes = library.filter((l) => l.kinds.includes('like'))
  const favs = library.filter((l) => l.kinds.includes('fav'))

  const markGroups = useMemo(() => {
    const items = filter === 'all' ? library : library.filter((l) => l.kinds.includes(filter))
    const map = new Map<string, LibraryItem[]>()
    for (const it of items) {
      const arr = map.get(it.jobTitle) ?? []
      arr.push(it)
      map.set(it.jobTitle, arr)
    }
    return [...map.entries()]
  }, [library, filter])

  const savedGroups = useMemo(() => {
    return jobs
      .map((job) => {
        const rows = candidates
          .filter((c) => c.jobId === job.id && cards[c.id]?.savedAt)
          .sort((a, b) => new Date(cards[b.id]!.savedAt!).getTime() - new Date(cards[a.id]!.savedAt!).getTime())
        return { job, rows }
      })
      .filter((g) => g.rows.length > 0)
  }, [jobs, candidates, cards])

  const savedCount = savedGroups.reduce((n, g) => n + g.rows.length, 0)

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[75] flex flex-col bg-paper">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
        <div className="flex items-center gap-2">
          <span className="text-[16px] font-semibold tracking-tight">个人主页</span>
          <span className="chip border border-line bg-paper text-muted">只属于我</span>
        </div>

        <div className="ml-6 flex items-center gap-1">
          <button
            className={`h-8 cursor-pointer rounded-[9px] px-3 text-[13px] font-medium transition ${
              tab === 'marks' ? 'bg-teal-soft text-teal-dark' : 'text-muted hover:bg-paper'
            }`}
            onClick={() => setTab('marks')}
          >
            我标记的问题
            <span className="ml-1.5 text-[11px] tabular-nums opacity-70">{library.length}</span>
          </button>
          <button
            className={`h-8 cursor-pointer rounded-[9px] px-3 text-[13px] font-medium transition ${
              tab === 'saved' ? 'bg-teal-soft text-teal-dark' : 'text-muted hover:bg-paper'
            }`}
            onClick={() => setTab('saved')}
          >
            我保存的面试问题
            <span className="ml-1.5 text-[11px] tabular-nums opacity-70">{savedCount}</span>
          </button>
        </div>

        <button className="btn btn-ghost ml-auto" onClick={onClose}>
          <IconX width={15} height={15} />
          关闭
        </button>
      </header>

      <div className="thin flex-1 overflow-y-auto px-6 py-5">
        <div className="mx-auto max-w-[980px]">
          {tab === 'marks' && (
            <>
              <div className="mb-4 flex items-center gap-2">
                {(
                  [
                    ['all', '全部', library.length],
                    ['like', '喜欢', likes.length],
                    ['fav', '收藏', favs.length],
                  ] as const
                ).map(([key, label, n]) => (
                  <button
                    key={key}
                    className={`h-7 cursor-pointer rounded-[9px] px-2.5 text-[12px] font-medium transition ${
                      filter === key ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:bg-surface/60'
                    }`}
                    onClick={() => setFilter(key)}
                  >
                    {label} <span className="tabular-nums opacity-60">{n}</span>
                  </button>
                ))}
                <span className="ml-2 text-[11.5px] text-muted/60">按岗位分组，换岗位看不到别的岗位的标记</span>
              </div>

              {library.length === 0 ? (
                <EmptyState
                  icon={<IconHeart width={20} height={20} />}
                  title="还没有标记任何问题"
                  desc="在面试问题右侧点 ♡ 喜欢、或 ★ 收藏，都会收进这里。"
                />
              ) : markGroups.length === 0 ? (
                <EmptyState icon={<IconStar width={20} height={20} />} title="这个分类还是空的" desc="换个筛选看看。" />
              ) : (
                <div className="space-y-6">
                  {markGroups.map(([jobTitle, items]) => (
                    <div key={jobTitle}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{jobTitle}</span>
                        <span className="text-[11.5px] text-muted/60">{items.length} 道</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                      <div className="divide-row overflow-hidden rounded-[14px] border border-line bg-surface">
                        {items.map((it) => (
                          <div key={it.id} className="flex items-start gap-3 px-4 py-3">
                            <span className="mt-[3px] flex shrink-0 gap-1">
                              {it.kinds.includes('like') && (
                                <IconHeart width={14} height={14} filled className="text-rose" />
                              )}
                              {it.kinds.includes('fav') && (
                                <IconStar width={14} height={14} filled className="text-amber" />
                              )}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[13px] leading-[1.7] text-ink/90">{it.text}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                                <TypeChip type={it.type} />
                                <span className="text-[10.5px] text-muted/60">
                                  {it.competencyName} · 来自 {it.savedFrom} 的面试 · {relTime(it.savedAt)}
                                </span>
                              </div>
                            </div>
                            <div className="flex shrink-0 items-center gap-1">
                              <button className="btn btn-outline btn-sm" onClick={() => onInsert(it.id)}>
                                <IconPlus width={11} height={11} />
                                插入当前
                              </button>
                              <button className="icon-btn hover:text-rose" title="取消标记" onClick={() => onRemove(it.id)}>
                                <IconTrash width={13} height={13} />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}

          {tab === 'saved' && (
            <>
              <p className="mb-4 text-[11.5px] text-muted/60">
                面试当天从这里打开。保存过的问题不会再被「重新生成」覆盖。
              </p>
              {savedGroups.length === 0 ? (
                <EmptyState
                  icon={<IconBookmark width={20} height={20} />}
                  title="还没有保存过面试问题"
                  desc="在右侧点「保存这份问题」，这里就会出现这位候选人。"
                />
              ) : (
                <div className="space-y-6">
                  {savedGroups.map(({ job, rows }) => (
                    <div key={job.id}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className="text-[13px] font-semibold">{job.title}</span>
                        <span className="rounded bg-paper px-1.5 py-[1px] text-[10.5px] text-muted">{job.department}</span>
                        <span className="text-[11.5px] text-muted/60">{rows.length} 位候选人</span>
                        <span className="h-px flex-1 bg-line" />
                      </div>
                      <div className="divide-row overflow-hidden rounded-[14px] border border-line bg-surface">
                        {rows.map((c) => {
                          const card = cards[c.id]!
                          return (
                            <button
                              key={c.id}
                              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-paper/60"
                              onClick={() => {
                                onOpenSaved(job.id, c.id)
                                onClose()
                              }}
                            >
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <span className="text-[13.5px] font-medium">{c.name}</span>
                                  <span className="text-[11.5px] text-muted/70">{c.headline}</span>
                                </div>
                                <div className="mt-0.5 text-[11px] text-muted/60">
                                  保存于 {dateTime(card.savedAt)} · {card.savedQuestions?.length ?? 0} 道题
                                </div>
                              </div>
                              <span className="flex items-center gap-1 text-[12px] font-medium text-teal">
                                打开
                                <IconArrowUpRight width={13} height={13} />
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-[16px] border border-dashed border-line py-16 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface text-muted/50 shadow-sm">
        {icon}
      </div>
      <p className="mt-3 text-[13.5px] font-medium">{title}</p>
      <p className="mt-1 max-w-[300px] text-[12px] leading-relaxed text-muted">{desc}</p>
    </div>
  )
}
