import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import OSRow from '@/components/OSRow'
import SearchBar from '@/components/SearchBar'
import ScienceGrid from '@/components/ScienceGrid'
import OrnamentDivider from '@/components/OrnamentDivider'
import { APP } from '@i360/locales'

// Header sizing (§14i, §15al): the header is drawn, off-screen, at each of the theme's four text
// sizes, largest first, and the largest whose real rendered width fits the space available is used —
// measured, never assumed; no device-width thresholds. The logo is sized in em, so it follows.
const HEADER_STEPS = ['text-xl', 'text-lg', 'text-base', 'text-sm'] as const
type HeaderStep = (typeof HEADER_STEPS)[number]

const HEADER_TITLE = APP.ar.title

// A measurement-imprecision cushion, not a width guess: a real device measured a
// dead-even 328/328, and a zero-margin tie can tip either way when rendered.
const SAFETY_MARGIN_PX = 4

// Math.min(innerWidth, innerHeight) — always the portrait-equivalent width
// regardless of current orientation, since rotating just swaps which
// dimension is which; the smaller one is always the portrait width by
// definition. Gives "compute from portrait width, never recalculate for
// landscape" as a direct consequence of the math, no separate orientation
// check needed.
function currentPortraitWidth() {
  return Math.min(window.innerWidth, window.innerHeight)
}

export default function Home() {
  // useState+useLayoutEffect here, unlike the rest of this file — genuinely
  // different situation from the dialogs' remount bugs elsewhere in this
  // project (§14), not an exception to that principle. Those broke because
  // a one-time flag got silently re-consumed or re-triggered on remount.
  // This is idempotent — recomputing "what size actually fits right now"
  // on every mount gives the same correct answer every time for an
  // unchanged device, and the one case a remount could legitimately
  // produce a different answer (the PWA's window was actually resized) is
  // exactly when recomputing is correct, not a bug.
  const [headerStep, setHeaderStep] = useState<HeaderStep>(HEADER_STEPS[0])
  // The chosen step's size, as drawn — the science list never goes bigger (--app-title-size).
  const [titleSize, setTitleSize] = useState<string>()
  const measureRefs = useRef<(HTMLDivElement | null)[]>([])
  const headerRef = useRef<HTMLDivElement>(null)

  // useLayoutEffect, not useEffect — runs synchronously before the browser
  // paints, so even though headerStep's initial value is the largest step,
  // the user never actually sees that size flash before this corrects it.
  useLayoutEffect(() => {
    function recalculate() {
      if (!headerRef.current) return
      // The header's own side padding, as drawn: the shared gap plus each side's
      // safe-area inset (.safe-sides) — read, not assumed.
      const cs = getComputedStyle(headerRef.current)
      const availableWidth = currentPortraitWidth() - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const fits = HEADER_STEPS.findIndex((_, i) => {
        const el = measureRefs.current[i]
        return el !== null && el !== undefined && el.scrollWidth + SAFETY_MARGIN_PX <= availableWidth
      })
      const chosen = fits === -1 ? HEADER_STEPS.length - 1 : fits
      setHeaderStep(HEADER_STEPS[chosen] ?? HEADER_STEPS[0])
      const chosenEl = measureRefs.current[chosen]
      if (chosenEl) setTitleSize(getComputedStyle(chosenEl).fontSize)
    }

    recalculate()

    // Real double-measurement, not a single mount-time guess — the hidden
    // reference element below is measured once immediately (whatever font
    // is active at that moment), then again once Amiri has genuinely
    // settled. A real, measured test (Playwright + the actual Amiri font
    // file vs. a realistic fallback candidate) showed the fallback landing
    // wider than Amiri, not narrower — meaning a single early measurement
    // would likely be safe in practice — but that was one candidate on one
    // platform, not a guarantee across every real device's actual
    // fallback. This removes the need to trust that direction at all, at
    // the cost of one extra, usually-imperceptible step change right when
    // Amiri finishes loading.
    void document.fonts.ready.then(recalculate) // never rejects, by spec

    // Real resize handling too (PWA/desktop-browser window resize).
    window.addEventListener('resize', recalculate)
    return () => window.removeEventListener('resize', recalculate)
  }, [])

  return (
    <div className="flex flex-col h-dvh bg-brand-ivory safe-edges" style={titleSize ? { '--app-title-size': titleSize } as CSSProperties : undefined}>
      {/* Top and bottom safe-area padding here (safe-edges, page-chrome.css), not
          on the header/OSRow individually — one place; each full-width row
          clears the sides itself (safe-sides; OSRow's bar does its own). box-sizing:
          border-box (Tailwind preflight) means it's absorbed within
          h-dvh rather than pushing the layout taller than the viewport.
          bg-brand-ivory already on this element, so the inset itself
          reads as ivory, not a stray black/white bar. Real bug, real
          iPhone: native app rendered edge-to-edge under the status bar
          (Capacitor's native default); Safari tab and installed PWA were
          both already correct without this, since they reserve that
          space on their own — see index.html's viewport comment. */}

      {/* Hidden reference copies of the header, one per text size, purely for measurement,
          off-screen. Real DOM measurement, not canvas measureText(): canvas text
          measurement doesn't always match real DOM rendering for complex script shaping,
          and this header is Arabic. position:absolute + a large negative offset (not
          display:none, which reports 0 for every dimension) keeps them out of the visible
          layout; aria-hidden keeps them from screen readers. Real <img>, not a placeholder:
          a real device measured natural===available exactly (2026-08-31), and at zero
          margin even a tiny rendering difference matters. */}
      {HEADER_STEPS.map((step, i) => (
        <div
          key={step}
          ref={el => { measureRefs.current[i] = el }}
          aria-hidden="true"
          className={`absolute -top-[9999px] -left-[9999px] flex items-center gap-sm ${step} font-bold whitespace-nowrap pointer-events-none`}
        >
          <span>&#xFD3F;</span>
          <img src="/assets/icons/logo-512.png" alt="" className="h-[1.33em] w-[1.33em] object-contain" />
          <span>{HEADER_TITLE}</span>
          <span>&#xFD3E;</span>
        </div>
      ))}

      {/* App header — framed by classical ornate Arabic parentheses
          (U+FD3F / U+FD3E), not the earlier hand-drawn star flanking —
          those are removed. DOM order for RTL (first = rightmost):
          FD3F, icon, title, FD3E → visual right-to-left: FD3F icon title FD3E
          Sized by headerStep (see HEADER_STEPS above) on the row itself; the
          logo is in em, so the whole header stays proportional at every step. */}
      <div ref={headerRef} className={`flex items-center justify-center gap-sm bg-brand-ivory safe-sides py-sm shadow-toolbar shrink-0 ${headerStep} font-bold text-brand-blue`}>
        <span aria-hidden="true">&#xFD3F;</span>
        <img
          src="/assets/icons/logo-512.png"
          alt={APP.ar.logoAlt}
          className="h-[1.33em] w-[1.33em] object-contain shrink-0"
        />
        <span>{HEADER_TITLE}</span>
        <span aria-hidden="true">&#xFD3E;</span>
      </div>

      <OrnamentDivider />

      {/* Science accordion — scrollable. Normal flex flow — search bar +
          OSRow are ordinary siblings below, so this simply ends where they
          begin. No measured/guessed padding needed, unlike the reverted
          fixed-positioning attempt. */}
      <main className="flex-1 overflow-y-auto">
        <ScienceGrid />
      </main>

      {/* Search bar + OSRow — ordinary flex document flow, not fixed. The
          original OS_WebToggle tooltip-overflow bug is already fixed at
          its actual root cause (ToggleItem's tooltipAlign prop), so the
          extra robustness fixed positioning offered wasn't actually needed
          — and it cost several rounds of real debugging pain for content
          being hidden underneath it. Reverted in favor of the simpler,
          overlap-proof-by-construction normal flow. */}
      <OrnamentDivider />
      <div className="shrink-0 bg-brand-ivory">
        <SearchBar />
      </div>
      <OSRow />

    </div>
  )
}
