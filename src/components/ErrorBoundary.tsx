import { Component, ErrorInfo, ReactNode } from 'react'
import { resolveFeedbackMailto, copyAndEmailReport } from '@/lib/feedbackReport'
import { Button } from '@/components/shared'
import { APP } from '@i360/locales'

const T = APP.ar

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  errorDetails: string
  feedbackMailto: string | null
  reported: boolean
}

// Error boundaries must be class components — React has no hooks equivalent
// as of React 18. Catches any unexpected render-time exception (not handled
// fetch failures, which dataCache.tsx already surfaces via its own `error`
// state) and shows a friendly Arabic fallback instead of a blank white screen.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, errorDetails: '', feedbackMailto: null, reported: false }

  static getDerivedStateFromError(): Pick<State, 'hasError'> {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unexpected error caught by ErrorBoundary:', error, info)

    const errorDetails = `${error.message}\n\n${info.componentStack ?? ''}`.trim()

    // resolveFeedbackMailto() (src/lib/feedbackReport.ts) handles the
    // two-tier lookup — its own comment covers the ErrorBoundary-specific
    // reasoning (sits ABOVE DataCacheProvider, so useDataCache() isn't
    // reachable here) and the narrow first-launch edge case where both
    // tiers can come up empty, handled at the render()-level fallback
    // below, not here.
    const feedbackMailto = resolveFeedbackMailto()

    this.setState({ errorDetails, feedbackMailto })
  }

  // Class property (auto-binds `this`), triggered directly by the button's
  // onClick — the synchronous user-gesture context this fires in is what
  // makes navigator.clipboard.writeText() (inside copyAndEmailReport)
  // reliable to call here.
  handleReport = () => {
    // copyAndEmailReport() (src/lib/feedbackReport.ts) handles the actual
    // clipboard write and, if a feedback address was found, opens the
    // pre-filled mailto:. See its own comment for the full reasoning
    // (why clipboard always gets the full text, why the mailto body is
    // trimmed, why the return value is worded to what's actually
    // verifiable).
    copyAndEmailReport(T.reportCrash, this.state.errorDetails)
    this.setState({ reported: true })
  }

  render() {
    if (this.state.hasError) {
      const canEmail = !!this.state.feedbackMailto
      const { reported } = this.state
      // Four distinct labels, not just a toggle — wording differs by
      // whether an email destination was available even before the tap
      // (canEmail), and separately by whether the tap has now happened
      // (reported). Confirmation text stays accurate to what's actually
      // verifiable (see handleReport's own comment on this).
      const reportLabel = reported
        ? (canEmail ? T.copiedAndMailOpened : T.copied)
        : (canEmail ? T.report : T.copyDetails)
      return (
        <div
          dir="rtl"
          className="flex h-dvh flex-col items-center justify-center gap-md bg-brand-ivory safe-area text-center"
          // Safe-area padding, same as Home.tsx (§14d) — applied defensively to the
          // crash screen for consistency.
        >
          <p className="text-lg font-bold text-brand-blue">
            {T.crashTitle}
          </p>
          <p className="text-base text-brand-blue">
            {T.crash}
          </p>
          <Button primary onClick={() => window.location.reload()}>
            {T.reload}
          </Button>
          <Button className={`transition-colors${reported ? ' border-brand-green text-brand-green' : ''}`} onClick={this.handleReport}>
            {/* aria-live on this inner span, not the button itself —
                screen readers handle a live region more reliably when
                it's not also the interactive element receiving focus. */}
            <span aria-live="polite">{reportLabel}</span>
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}
