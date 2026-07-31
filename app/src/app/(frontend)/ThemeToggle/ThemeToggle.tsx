'use client'

import styles from './ThemeToggle.module.css'

export default function ThemeToggle() {
  return (
    <button
      className={styles.button}
      type="button"
      aria-label="切换深色模式"
      title="切换深色模式"
      onClick={() => {
        const dark = document.documentElement.dataset.theme === 'dark'
        document.documentElement.dataset.theme = dark ? 'light' : 'dark'
        localStorage.setItem('tax-theme', dark ? 'light' : 'dark')
      }}
    >
      ◐
    </button>
  )
}
