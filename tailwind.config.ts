import type { Config } from 'tailwindcss'

export default {
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    // The shared i360 theme's sizes (theme.css, set once for every theme; §15al), each with its value
    // built in for when theme.css can't be reached. Replacing Tailwind's own scales, not extending
    // them, so only these exist: three text sizes, three corners, three shadows.
    fontSize: {
      sm: ['var(--i360-text-size-sm, 0.875rem)', { lineHeight: 'var(--i360-line-height-ui, 1.6)' }],
      base: ['var(--i360-text-size, 1rem)', { lineHeight: 'var(--i360-line-height-ui, 1.6)' }],
      lg: ['var(--i360-text-size-lg, 1.25rem)', { lineHeight: 'var(--i360-line-height-ui, 1.6)' }],
    },
    borderRadius: {
      none: '0',
      sm: 'var(--i360-radius-sm, 0.25rem)',
      lg: 'var(--i360-radius-lg, 0.5rem)',
      full: 'var(--i360-radius-full, 999px)',
    },
    borderWidth: {
      0: '0',
      DEFAULT: 'var(--i360-line-width, 1px)',
      2: 'var(--i360-line-width-strong, 2px)',
    },
    boxShadow: {
      none: 'none',
      toolbar: 'var(--i360-toolbar-shadow, 0 1px 3px rgba(0, 0, 0, 0.05))',
      page: 'var(--i360-page-shadow, 0 4px 6px -1px rgba(0, 16, 207, 0.08), 0 2px 4px -1px rgba(0, 16, 207, 0.05))',
      popup: 'var(--i360-popup-shadow, 0 10px 15px -3px rgba(0, 0, 0, 0.15))',
    },
    extend: {
      // Spacing: the theme's four steps (p-sm, gap-xs, …); Tailwind's numbers stay for sizes (h-5, w-9).
      spacing: {
        xs: 'var(--i360-space-xs, 0.25rem)',
        sm: 'var(--i360-space-sm, 0.5rem)',
        md: 'var(--i360-space-md, 1rem)',
        lg: 'var(--i360-space-lg, 2rem)',
      },
      zIndex: {
        dialog: 'var(--i360-layer-dialog, 50)',
        toast: 'var(--i360-layer-toast, 60)',
      },
      transitionDuration: { DEFAULT: 'var(--i360-speed-quick, 0.15s)' },
      // The shared i360 theme's colours (https://theme.i36o.workers.dev/theme.css),
      // each with the theme's LIGHT value built in as the fallback for when
      // theme.css can't be reached. They follow the chosen theme (system /
      // light / sepia / dark, §7); a change in theme.css reaches the app
      // without a release. Every colour in the app goes through these — no
      // fixed greys or whites (2026-10-21, §15t).
      colors: {
        brand: {
          blue: 'var(--i360-text, #0010CF)',
          green: 'var(--i360-link, #2E8B57)',
          ivory: 'var(--i360-bg, #FAF7F2)',
          highlight: 'var(--i360-hover, #EEF2FF)',
          disabled: 'var(--i360-rule, #CBD5E1)',
          border: 'var(--i360-border, #CBD5E1)',       // edges
          // Dividers in the science list: the theme's line colour at half strength
          // (2026-10-21, §15t), so they stay light in every theme.
          divider: 'color-mix(in srgb, var(--i360-rule, #CBD5E1) 50%, transparent)',
          muted: 'var(--i360-muted, #5A62C9)',         // secondary text, placeholders
          input: 'var(--i360-input, #FAF7F2)',         // text-box backgrounds
          'on-accent': 'var(--i360-on-accent, #FAF7F2)', // text and knobs on blue/green
          danger: 'var(--i360-danger, #b91c1c)',       // errors
          overlay: 'var(--i360-overlay, rgba(0, 0, 0, 0.4))', // behind dialogs
        },
      },
    },
  },
  plugins: [],
} satisfies Config
