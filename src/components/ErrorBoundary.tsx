import { Component, type ErrorInfo, type ReactNode } from 'react'
import { clearState } from '../lib/state'

interface State {
  error: Error | null
}

/**
 * 兜底：任何渲染错误都不应该变成一片空白。
 * 比赛现场如果因为脏数据崩了，至少这里能一键恢复。
 */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[InterviewBridge] render crashed:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children

    return (
      <div className="flex h-full items-center justify-center bg-paper p-6">
        <div className="w-full max-w-[420px] rounded-xl border border-line bg-surface p-6 shadow-sm">
          <h1 className="text-[15px] font-semibold text-ink">页面没能渲染出来</h1>
          <p className="mt-1.5 text-[12px] leading-relaxed text-muted">
            通常是浏览器里存着旧版本的演示数据。重置后即可恢复，不影响任何代码。
          </p>
          <pre className="thin mt-3 max-h-[120px] overflow-auto rounded-lg bg-paper p-2.5 text-[10.5px] leading-relaxed text-rose/80">
            {this.state.error.message}
          </pre>
          <div className="mt-4 flex gap-2">
            <button
              className="btn btn-primary"
              onClick={() => {
                clearState()
                window.location.reload()
              }}
            >
              重置演示数据并刷新
            </button>
            <button className="btn btn-ghost" onClick={() => window.location.reload()}>
              仅刷新
            </button>
          </div>
        </div>
      </div>
    )
  }
}
