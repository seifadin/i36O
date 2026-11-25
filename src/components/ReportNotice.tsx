import { useMemo } from 'react'
import Dialog from '@/components/Dialog'
import { copyAndEmailReport, resolveFeedbackMailto } from '@/lib/feedbackReport'
import { APP } from '@i360/locales'

interface Props {
  open: boolean
  title: string
  message: string
  subject: string
  details: string
  onClose: () => void
}

// A Dialog with an optional "report this problem" action — shared by the OTA
// rollback notice (App.tsx) and the data-loading error (ScienceGrid.tsx). The
// action appears only when a feedback address exists; it copies + opens the
// pre-filled email synchronously inside the tap (§15g), then closes.
export default function ReportNotice({ open, title, message, subject, details, onClose }: Props) {
  // Resolved only while open: it reads storage and may parse the full cache.
  const canReport = useMemo(() => open && resolveFeedbackMailto() !== null, [open])
  return (
    <Dialog
      open={open}
      title={title}
      message={message}
      onClose={onClose}
      secondaryAction={
        canReport
          ? { label: APP.ar.report, onClick: () => { copyAndEmailReport(subject, details); onClose() } }
          : undefined
      }
    />
  )
}
