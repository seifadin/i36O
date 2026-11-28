import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'

// The app's shared components (their look: hub/src/page-chrome.css). Each writes exactly the
// structure of its hub builder in hub/src/components.js — the same element, own classes and fixed
// attributes — so the app and the hub pages can't drift: shared.test.ts renders each one and
// compares it with the hub builder's markup for the same inputs. Components use these, never the
// classes themselves (shared.test.ts checks that too). `className` is placement only (a margin, a
// width, a position), as `class` is on the hub.

const cx = (own: string, extra?: string) => (extra ? `${own} ${extra}` : own)

type ButtonBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type' | 'title' | 'aria-label'>

// A ghost button (hub: ghostButton): no pill and no outline, a fill when hovered or on — the bottom
// bar's buttons and the search bar's. Its icon and/or its `text`, icon first; or its own content
// (the numerals sample). `label` names it — the tooltip and the screen readers' name.
export function GhostButton({ icon, text, label, className, children, ...rest }: ButtonBase & {
  icon?: ReactNode; text?: string; label?: string; className?: string; children?: ReactNode
}) {
  return (
    <button className={cx('i360-btn-ghost', className)} type="button" title={label} aria-label={label} {...rest}>
      {icon}{text !== undefined && <span>{text}</span>}{children}
    </button>
  )
}

// A button (hub: button): its words, its icon alone (icon-only, .i360-btn-icon), or its icon then
// words. `primary` fills it, `small` makes it smaller.
export const Button = forwardRef<HTMLButtonElement, ButtonBase & {
  primary?: boolean; small?: boolean; icon?: ReactNode; label?: string; className?: string; type?: 'button' | 'submit'; children?: ReactNode
}>(function Button({ primary, small, icon, label, className, type = 'button', children, ...rest }, ref) {
  const iconOnly = icon !== undefined && children === undefined
  const own = ['i360-btn', primary && 'i360-btn-primary', small && 'i360-btn-sm', iconOnly && 'i360-btn-icon'].filter(Boolean).join(' ')
  return (
    <button ref={ref} className={cx(own, className)} type={type} title={label} aria-label={label} {...rest}>
      {icon}{children}
    </button>
  )
})

type BoxProps = Omit<HTMLAttributes<HTMLElement>, 'className'> & { className?: string; children?: ReactNode }

// A pop-up (hub: box('popup')): a <div>, or a <span> when it is a tooltip.
export function Popup({ as = 'div', className, children, ...rest }: BoxProps & { as?: 'div' | 'span' }) {
  const Tag = as
  return <Tag className={cx('i360-popup', className)} {...rest}>{children}</Tag>
}

// A notice (hub: box('banner')): a status <div>, or a <button> when tapping it opens its details.
export function Banner({ className, children, onClick, ...rest }: BoxProps & { onClick?: () => void }) {
  return onClick
    ? <button className={cx('i360-banner', className)} type="button" onClick={onClick} {...rest}>{children}</button>
    : <div className={cx('i360-banner', className)} role="status" {...rest}>{children}</div>
}

// A short message that comes and goes (hub: box('toast')).
export function Toast({ className, children, ...rest }: BoxProps) {
  return <div className={cx('i360-toast', className)} role="status" aria-live="polite" {...rest}>{children}</div>
}

// A search field inside a field box (hub: field) — kind search, in-box: the box gives its look; the
// standard search-box behaviour (a search key on the keyboard, no remembered entries, corrections or
// spelling marks), as every search box of the encyclopedia.
export function SearchField({ className, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, 'className' | 'type'> & { className?: string }) {
  return <input className={cx('i360-field-input', className)} type="search" enterKeyHint="search" autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck={false} {...rest} />
}

// A hidden announcer (hub: announcer): words for screen readers only.
export function Announcer({ className, children, ...rest }: BoxProps) {
  return <span className={cx('sr-only', className)} role="status" aria-live="polite" {...rest}>{children}</span>
}

// A toolbar (hub: box('toolbar')): the app's is the bottom one (variant 'bottom'); its parts below.
export function Toolbar({ variant, className, children, ...rest }: BoxProps & { variant?: 'sticky' | 'bottom' }) {
  return <div className={cx(variant ? `toolbar toolbar-${variant}` : 'toolbar', className)} {...rest}>{children}</div>
}

// A toolbar's start (hub: box('toolbarStart')): its settings — ⋮, theme, numerals.
export function ToolbarStart({ className, children, ...rest }: BoxProps) {
  return <div className={cx('tb-start', className)} {...rest}>{children}</div>
}

// A field's look round a field and its buttons (hub: box('fieldBox')) — the search bar.
export function FieldBox({ className, children, ...rest }: BoxProps) {
  return <div className={cx('i360-field i360-field-search', className)} {...rest}>{children}</div>
}
