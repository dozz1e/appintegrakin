import type { Config } from 'tailwindcss'

export default <Partial<Config>>{
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          2: 'var(--color-surface-2)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        ink: {
          DEFAULT: 'var(--color-ink)',
          secondary: 'var(--color-ink-secondary)',
          muted: 'var(--color-ink-muted)',
          onprimary: 'var(--color-ink-on-primary)',
        },
        primary: {
          DEFAULT: 'var(--color-primary)',
          ink: 'var(--color-primary-ink)',
          subtle: 'var(--color-primary-subtle)',
          hover: 'var(--color-primary-hover)',
          active: 'var(--color-primary-active)',
          ring: 'var(--color-primary-ring)',
        },
        success: { bg: 'var(--color-success-bg)', text: 'var(--color-success-text)' },
        warning: { bg: 'var(--color-warning-bg)', text: 'var(--color-warning-text)' },
        danger: {
          DEFAULT: 'var(--color-danger)',
          hover: 'var(--color-danger-hover)',
          bg: 'var(--color-danger-bg)',
          text: 'var(--color-danger-text)',
        },
        violet: { bg: 'var(--color-violet-bg)', text: 'var(--color-violet-text)' },
        neutral: { bg: 'var(--color-neutral-bg)', text: 'var(--color-neutral-text)' },
        overlay: 'var(--color-overlay)',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
}
