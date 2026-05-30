import { useEffect, useRef, useState } from 'react'

/** Returns a debounced copy of `value` that updates `delay`ms after it settles. */
export function useDebounce(value, delay = 400) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(id)
  }, [value, delay])
  return debounced
}

/** Stable debounced callback. */
export function useDebouncedCallback(fn, delay = 400) {
  const timer = useRef(null)
  const fnRef = useRef(fn)
  fnRef.current = fn
  useEffect(() => () => clearTimeout(timer.current), [])
  return (...args) => {
    clearTimeout(timer.current)
    timer.current = setTimeout(() => fnRef.current(...args), delay)
  }
}
