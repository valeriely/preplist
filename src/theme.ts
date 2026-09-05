import { useEffect, useState } from 'react'

export type ThemeChoice = 'light' | 'dark' | 'system'

const KEY = 'preplist.theme.v1'

function systemPrefersDark(): boolean {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
}

function resolve(choice: ThemeChoice): 'light' | 'dark' {
  if (choice === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return choice
}

export function useTheme() {
  const [choice, setChoice] = useState<ThemeChoice>(() => {
    const stored = localStorage.getItem(KEY)
    return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system'
  })

  useEffect(() => {
    localStorage.setItem(KEY, choice)
    const apply = () => {
      document.documentElement.dataset.theme = resolve(choice)
    }
    apply()
    if (choice !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [choice])

  const resolved = resolve(choice)

  function toggle() {
    setChoice(resolved === 'dark' ? 'light' : 'dark')
  }

  return { choice, resolved, setChoice, toggle }
}
