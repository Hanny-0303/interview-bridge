import { useEffect, useMemo } from 'react'

/** 点击喜欢/收藏时的一次爆散：一圈小点 + 一个扩散的环 */
export default function Burst({
  x,
  y,
  color,
  onDone,
}: {
  x: number
  y: number
  color: string
  onDone: () => void
}) {
  useEffect(() => {
    const t = window.setTimeout(onDone, 700)
    return () => window.clearTimeout(t)
  }, [onDone])

  const dots = useMemo(
    () =>
      Array.from({ length: 9 }, (_, i) => {
        const angle = (i / 9) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12)
        const dist = 20 + (i % 3) * 6
        return {
          dx: Math.cos(angle) * dist,
          dy: Math.sin(angle) * dist,
          size: i % 3 === 0 ? 4 : i % 2 === 0 ? 3 : 2,
          delay: (i % 3) * 18,
        }
      }),
    [],
  )

  return (
    <div
      className="pointer-events-none fixed z-70"
      style={{ left: x, top: y, width: 0, height: 0 }}
      aria-hidden
    >
      <span className="burst-ring" style={{ ['--color' as string]: color }} />
      {dots.map((d, i) => (
        <span
          key={i}
          className="burst-dot"
          style={{
            ['--dx' as string]: `${d.dx}px`,
            ['--dy' as string]: `${d.dy}px`,
            ['--size' as string]: `${d.size}px`,
            ['--color' as string]: color,
            animationDelay: `${d.delay}ms`,
          }}
        />
      ))}
    </div>
  )
}
