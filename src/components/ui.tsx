import { useEffect, type ReactNode } from 'react'
import type { QuestionType } from '../data/types'
import { IconX } from './Icons'

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 560,
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: number
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-ink/15 backdrop-blur-[1px]" onClick={onClose} />
      <aside
        className="slide-in relative flex h-full flex-col border-l border-line bg-surface shadow-[-16px_0_40px_-24px_rgba(15,26,29,.35)]"
        style={{ width }}
        role="dialog"
        aria-modal="true"
      >
        <header className="flex items-start gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0 flex-1">
            <div className="text-[15px] font-semibold">{title}</div>
            {subtitle ? <div className="mt-0.5 text-[12px] text-muted">{subtitle}</div> : null}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="关闭">
            <IconX />
          </button>
        </header>
        <div className="thin flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer ? <footer className="border-t border-line px-5 py-3">{footer}</footer> : null}
      </aside>
    </div>
  )
}

const TYPE_STYLE: Record<QuestionType, string> = {
  core: 'bg-teal-soft text-teal',
  followup: 'bg-violet-soft text-violet',
  boundary: 'bg-amber-soft text-amber',
}

const TYPE_LABEL: Record<QuestionType, string> = {
  core: '必问题',
  followup: '简历追问',
  boundary: '假设题',
}

export function TypeChip({ type }: { type: QuestionType }) {
  return <span className={`chip ${TYPE_STYLE[type]}`}>{TYPE_LABEL[type]}</span>
}

export function ImportanceChip({ importance }: { importance: 'core' | 'important' | 'plus' }) {
  if (importance === 'core') return <span className="chip bg-teal-soft text-teal">核心考察</span>
  if (importance === 'important') return <span className="chip bg-paper text-muted">重要</span>
  return <span className="chip bg-amber-soft text-amber">加分项</span>
}

export function OriginTag({ origin }: { origin: 'jd' | 'manager' | 'both' }) {
  const map = {
    jd: '仅 JD 提到',
    manager: '仅主管提到',
    both: 'JD 与主管一致',
  } as const
  return (
    <span className="inline-flex items-center gap-1 text-[11px] text-muted/80">
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          origin === 'both' ? 'bg-teal/70' : origin === 'manager' ? 'bg-violet/70' : 'bg-amber/70'
        }`}
      />
      {map[origin]}
    </span>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <div className="label mb-2">{children}</div>
}
