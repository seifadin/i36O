// Tailwind for Daily Reflection, built into the page by scripts/build.js (was the
// cdn.tailwindcss.com script until 2026-10-19). Its scales are the shared theme's
// (theme.css, i360-instructions.md §15al), replacing Tailwind's own, so only these exist;
// the page carries the theme's built-in values, so no fallbacks here. Colours too: the
// theme's, which follow the chosen theme by themselves (no dark: classes).
const v = (name) => `var(--i360-${name})`;
export default {
  content: ['./src/day.src.html', './src/day/**/*.js', './src/components.js'],
  theme: {
    // Three sizes: the fourth (xl) is the app title's alone.
    fontSize: {
      sm: [v('text-size-sm'), { lineHeight: v('line-height-ui') }],
      base: [v('text-size'), { lineHeight: v('line-height-ui') }],
      lg: [v('text-size-lg'), { lineHeight: v('line-height-ui') }]
    },
    borderRadius: { none: '0', sm: v('radius-sm'), lg: v('radius-lg'), full: v('radius-full') },
    borderWidth: { 0: '0', DEFAULT: v('line-width'), 2: v('line-width-strong') },
    boxShadow: { none: 'none', page: v('page-shadow'), popup: v('popup-shadow') },
    extend: {
      // Spacing: the theme's four steps (p-sm, gap-xs, …); Tailwind's numbers stay for sizes.
      spacing: { xs: v('space-xs'), sm: v('space-sm'), md: v('space-md'), lg: v('space-lg') },
      lineHeight: { reading: v('line-height') },
      transitionDuration: { DEFAULT: v('speed-quick') },
      colors: {
        hadith: { DEFAULT: v('hadith'), bg: v('hadith-bg') },
        prayer: { DEFAULT: v('prayer'), bg: v('prayer-bg') },
        event: { DEFAULT: v('event'), bg: v('event-bg') },
        converter: { DEFAULT: v('converter'), bg: v('converter-bg') },
        rule: v('rule'),
        page: v('bg')
      }
    }
  }
};
