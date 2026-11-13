import type { Candidate, JobProfile, Question } from '../data/types'
import { IconFile, IconHeart, IconInfo, IconQuote, IconTarget } from './Icons'
import { Drawer, ImportanceChip, TypeChip } from './ui'

const TYPE_TEXT: Record<Question['type'], string> = {
  core: '必问题 · 所有候选人问同一道',
  followup: '简历追问 · 只用于验证他写过的事',
  boundary: '假设题 · 所有候选人问同一道',
}

function Node({
  step,
  label,
  tone,
  icon,
  children,
}: {
  step: number
  label: string
  tone: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="relative pl-8">
      <span className="absolute top-0 left-0 flex h-6 w-6 items-center justify-center rounded-full border border-line bg-surface text-[10px] font-semibold text-muted">
        {step}
      </span>
      <div className="mb-1 flex items-center gap-1.5">
        <span className={tone}>{icon}</span>
        <span className="text-[11px] font-medium tracking-wide text-muted">{label}</span>
      </div>
      {children}
    </div>
  )
}

export default function EvidenceDrawer({
  open,
  question,
  job,
  candidate,
  liked,
  onClose,
  onLike,
}: {
  open: boolean
  question: Question | null
  job: JobProfile
  candidate?: Candidate
  liked: boolean
  onClose: () => void
  onLike: () => void
}) {
  if (!question) return null

  const comp = job.competencies.find((c) => c.id === question.competencyId)
  const tasks = job.tasks.filter((t) => question.sourceTaskIds.includes(t.id))
  const claim = candidate?.claims.find((c) => c.id === question.claimId)

  return (
    <Drawer
      open={open}
      onClose={onClose}
      width={540}
      title="为什么问这道题"
      subtitle="业务任务 → 岗位能力 → 简历原文 → 本题"
      footer={
        <div className="flex items-center gap-2">
          <button className={`btn btn-outline ${liked ? 'text-rose' : ''}`} onClick={onLike}>
            <IconHeart width={14} height={14} filled={liked} />
            {liked ? '已喜欢（点一下取消）' : '喜欢这道题'}
          </button>
          <button className="btn btn-ghost ml-auto" onClick={onClose}>
            关闭
          </button>
        </div>
      }
    >
      <div className="rounded-lg border border-line bg-paper/60 px-3.5 py-3">
        <div className="mb-1.5 flex items-center gap-2">
          <TypeChip type={question.type} />
          <span className="text-[10.5px] text-muted/70">{TYPE_TEXT[question.type]}</span>
        </div>
        <p className="text-[13.5px] leading-relaxed font-medium text-ink">{question.text}</p>
      </div>

      <div className="relative mt-5 space-y-5">
        <span className="absolute top-2 bottom-2 left-[11px] w-px bg-line" />

        <Node step={1} label="业务任务" tone="text-teal" icon={<IconTarget width={12} height={12} />}>
          {tasks.length ? (
            <ul className="space-y-1">
              {tasks.map((t) => (
                <li key={t.id} className="rounded-md border border-line bg-surface px-2.5 py-1.5">
                  <p className="text-[12px] leading-[1.65] text-ink/85">{t.description}</p>
                  <p className="mt-0.5 text-[10px] text-muted/60">
                    来源：{t.source === 'manager' ? '业务主管补充的真实任务' : 'JD 原文'}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[12px] text-muted">手工补充的问题，未关联业务任务。</p>
          )}
        </Node>

        <Node step={2} label="岗位能力" tone="text-teal" icon={<IconTarget width={12} height={12} />}>
          {comp ? (
            <div className="rounded-md border border-line bg-surface px-2.5 py-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[12.5px] font-medium">{comp.name}</span>
                <ImportanceChip importance={comp.importance} />
              </div>
              <ul className="mt-1 space-y-0.5">
                {comp.behaviors.map((b) => (
                  <li key={b} className="text-[11px] leading-[1.6] text-muted">
                    · {b}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-[12px] text-muted">未找到对应能力。</p>
          )}
        </Node>

        <Node
          step={3}
          label={claim ? `简历原文 · ${candidate?.name ?? ''}` : '简历线索'}
          tone={claim ? 'text-violet' : 'text-muted/60'}
          icon={claim ? <IconQuote width={12} height={12} /> : <IconFile width={12} height={12} />}
        >
          {claim ? (
            <div className="rounded-md border border-violet/20 bg-violet-soft/40 px-2.5 py-2">
              <p className="text-[12px] leading-[1.7] text-ink/85">「{claim.rawText}」</p>
              <p className="mt-1 text-[10px] text-violet/80">
                候选人自述，仅代表陈述；是否真实具备该能力，由面试回答来判断。
              </p>
            </div>
          ) : (
            <p className="text-[12px] leading-relaxed text-muted">
              本题不看简历，来自岗位标准，所以同岗位所有候选人都问同一道 —— 这也是几位候选人能横向比较的原因。
            </p>
          )}
        </Node>

        <Node step={4} label="本题" tone="text-teal" icon={<IconInfo width={12} height={12} />}>
          <p className="rounded-md border border-teal/20 bg-teal-soft/40 px-2.5 py-2 text-[12px] leading-[1.7] text-ink/85">
            {question.text}
          </p>
        </Node>
      </div>

      <div className="mt-5">
        <div className="label mb-2">HR 听什么（不看技术对错，看这三件事）</div>
        {question.observationPoints.length ? (
          <ul className="space-y-1.5">
            {question.observationPoints.map((o) => (
              <li key={o} className="flex items-start gap-2 rounded-md bg-paper px-2.5 py-1.5">
                <span className="mt-[5px] h-1 w-1 shrink-0 rounded-full bg-teal" />
                <span className="text-[11.5px] leading-[1.65] text-ink/80">{o}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11.5px] text-muted">手工补充的问题暂无观察点，建议面试官自行补一条判据。</p>
        )}
      </div>

      <div className="mt-5 rounded-lg border border-line bg-paper/50 px-3 py-2.5">
        <div className="label mb-1">出题依据说明</div>
        <p className="text-[11.5px] leading-[1.7] text-muted">{question.rationale}</p>
      </div>
    </Drawer>
  )
}
