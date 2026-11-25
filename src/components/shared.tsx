import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'

// The app's shared components (their look: hub/src/page-chrome.css). Each writes exactly the
// structure of its hub builder in hub/src/components.js — the same element, own classes and fixed
// attributes — so the app and the hub pages can't drift: shared.test.ts renders each one and
// compares it with the hub builder's markup for the same inputs. Components use these, never the
// classes themselves (shared.test.ts checks that too). `className` is placement only (a margin, a
// width, a position), as `class` is on the hub.

const cx = (own: string, extra?: string) => (extra ? `${own} ${extra}` : own)

type ButtonBase = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className' | 'type' | 'title' | 'aria-label'>

// A toolbar button (hub: toolbarButton): its icon, or its own content (the numerals sample).
// `label` names it — the tooltip and the screen readers' name.
export function ToolbarButton({ icon, label, className, children, ...rest }: ButtonBase & {
  icon?: ReactNode; label?: string; className?: string; children?: ReactNode
}) {
  return (
    <button className={cx('toolbar-btn', className)} type="button" title={label} aria-label={label} {...rest}>
      {icon}{children}
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

// A bare icon button beside a field or inside one (the search bar's mode, search, assistant and
// keyboard buttons): app-only, no hub twin. `label` names it (tooltip and screen readers); disabled
// shows the disabled colour.
export function IconButton({ icon, label, disabled, className, ...rest }: ButtonBase & {
  icon: ReactNode; label: string; className?: string
}) {
  return (
    <button className={cx(`shrink-0 ${disabled ? 'text-brand-disabled' : 'text-brand-blue'}`, className)} type="button" title={label} aria-label={label} disabled={disabled} {...rest}>
      {icon}
    </button>
  )
}

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

// A field's look round a field and its buttons (hub: box('fieldBox')) — the search bar.
export function FieldBox({ className, children, ...rest }: BoxProps) {
  return <div className={cx('i360-field i360-field-search', className)} {...rest}>{children}</div>
}
