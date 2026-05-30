import { useEffect, useRef, useState } from 'react'

/** Smoothly tweens a number toward `value`, formatted by `format`. */
export function AnimatedNumber({ value, format = (n) => Math.round(n).toString(), duration = 600 }) {
  const [display, setDisplay] = useState(value)
  const fromRef = useRef(value)
  const rafRef = useRef(null)

  useEffect(() => {
    const from = fromRef.current
    const to = Number(value) || 0
    const start = performance.now()
    cancelAnimationFrame(rafRef.current)

    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration)
      // easeOutExpo
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t)
      const current = from + (to - from) * eased
      setDisplay(current)
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick)
      } else {
        fromRef.current = to
      }
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [value, duration])

  return <span className="nums">{format(display)}</span>
}
