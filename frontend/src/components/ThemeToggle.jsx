import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { cn } from './ui'

// Initial value mirrors the class set pre-paint by the inline script in index.html.
function getInitial() {
  if (typeof document === 'undefined') return false
  return document.documentElement.classList.contains('dark')
}

export function ThemeToggle({ className }) {
  const [dark, setDark] = useState(getInitial)

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    try {
      localStorage.setItem('nt_theme', dark ? 'dark' : 'light')
    } catch {
      /* ignore storage errors */
    }
  }, [dark])

  return (
    <button
      type="button"
      onClick={() => setDark((d) => !d)}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={dark ? 'Light mode' : 'Dark mode'}
      className={cn(
        'flex h-9 w-9 items-center justify-center rounded-lg border border-line text-muted transition-colors duration-200 cursor-pointer hover:bg-surface-inset hover:text-content',
        className,
      )}
    >
      {dark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
    </button>
  )
}
