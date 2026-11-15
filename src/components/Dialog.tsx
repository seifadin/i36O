import { ReactNode, useEffect, useId, useRef } from 'react'
import { closeOnBack } from '@/lib/backButton'

interface DialogProps {
  open: boolean
  title: string
  // ReactNode, not string, so OSRow's version dialog can size its OTA line
  // differently; a plain string is still valid.
  message: ReactNode
  onClose: () => void
  // Optional second button — e.g. "continue anyway" after the reachability check,
  // whose false negatives make a hard block too aggressive.
  secondaryAction?: { label: string; onClick: () => void }
  // Emphasizes the secondary action as the filled, primary-style button
  // (green, receives initial focus) instead of the usual "close" button
  // — used specifically for the website-reachability warning on web,
  // where the check is often unreliable (CORS-subject there, unlike
  // native), so "continue anyway" is frequently the correct choice
  // rather than a risky override. Every other call site omits this and
  // keeps its original styling/focus unchanged.
  emphasizeSecondary?: boolean
}

export default function Dialog({ open, title, message, onClose, secondaryAction, emphasizeSecondary = false }: DialogProps) {
  // useId() rather than a hardcoded string — Dialog is a single shared
  // component rendered from several independent call sites (privacy notice,
  // the queued Edition/Version/Revision dialogs, OSRow's version-info
  // dialog). A hardcoded id would collide with duplicate DOM ids if two
  // instances ever mounted at once; useId() gives each instance its own
  // stable, unique id.
  const id = useId()
  const okButtonRef = useRef<HTMLButtonElement>(null)
  const secondaryButtonRef = useRef<HTMLButtonElement>(null)

  // Hooks must run unconditionally before the early return below (Rules of
  // Hooks) — this effect itself no-ops via its own `if (!open) return`
  // whenever the dialog isn't actually showing.
  useEffect(() => {
    if (!open) return

    // Move focus into the dialog on open, so keyboard/screen-reader users aren't
    // left on page content now hidden behind the overlay. (The separate focus-ring
    // fix is on the button below, §14h.)
    okButtonRef.current?.focus()
    if (emphasizeSecondary && secondaryAction) {
      // Overrides the focus set immediately above — the emphasized
      // action is the one that should genuinely receive it, since it's
      // now the visually primary, filled button.
      secondaryButtonRef.current?.focus()
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onClose()
      }
      // Focus trap: one focusable button (OK), or two with secondaryAction —
      // Tab/Shift+Tab never leave the dialog.
      if (e.key === 'Tab') {
        e.preventDefault()
        if (!secondaryAction) {
          okButtonRef.current?.focus()
        } else if (document.activeElement === okButtonRef.current) {
          secondaryButtonRef.current?.focus()
        } else {
          okButtonRef.current?.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, secondaryAction, emphasizeSecondary])

  // Android's back button closes an open dialog first (lib/backButton.ts), like Escape.
  useEffect(() => (open ? closeOnBack(onClose) : undefined), [open, onClose])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-dialog flex items-center justify-center bg-brand-overlay px-md">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-message`}
        className="i360-popup w-full max-w-sm p-md text-right"
      >
        <h2 id={`${id}-title`} className="mb-sm text-lg font-bold text-brand-blue">
          {title}
        </h2>
        <p id={`${id}-message`} className="mb-md whitespace-pre-line text-base text-brand-blue">
          {message}
        </p>
        {/* The shared buttons (src/page-chrome.css): outlined by default — deliberately less prominent
            than the filled one below. secondaryAction exists for a "proceed despite the warning"
            action, which shouldn't compete with the safer, recommended dismiss; emphasizeSecondary
            swaps the two when proceeding is the recommended choice (see the prop's comment above). */}
        {secondaryAction && (
          <button
            ref={secondaryButtonRef}
            onClick={secondaryAction.onClick}
            className={`i360-btn mb-sm w-full${emphasizeSecondary ? ' i360-btn-primary' : ''}`}
          >
            {secondaryAction.label}
          </button>
        )}
        <button
          ref={okButtonRef}
          onClick={onClose}
          className={`i360-btn w-full${emphasizeSecondary ? '' : ' i360-btn-primary'}`}
        >
          موافق
        </button>
      </div>
    </div>
  )
}
