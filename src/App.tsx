import { Suspense, lazy, useCallback, useState } from 'react'
import { AppStateProvider } from '@/store/appState'
import { DataCacheProvider, useDataCache } from '@/store/dataCache'
import { usePlatform } from '@/hooks/usePlatform'
import { useOtaHealth } from '@/hooks/useOtaHealth'
import { deviceStore } from '@/lib/deviceStorage'
import { APP } from '@i360/locales'
import Dialog from '@/components/Dialog'
import ReportNotice from '@/components/ReportNotice'

const T = APP.ar

const Home = lazy(() => import('@/pages/Home'))

// One-time privacy notice. The check is read-only: the key is written only
// when the user actually dismisses the dialog (§14g).
const PRIVACY_NOTICE_KEY = 'i360Privacy'
function checkPrivacyNotice(): boolean {
  return deviceStore.get<string | null>(PRIVACY_NOTICE_KEY, null) === null
}

// Edition/Version/Revision notices, shown one at a time.
interface QueuedDialog { title: string; message: string }

// The app shell mounts once and never unmounts, so every "once per app
// session" concern lives here, not in a page (§14).
function AppShell() {
  usePlatform()
  const { resource, changeFlags, loading: cacheLoading } = useDataCache()
  const { rollbackDetails, dismissRollback } = useOtaHealth()

  const [privacyOpen, setPrivacyOpen] = useState(false)
  const [needsPrivacyNotice, setNeedsPrivacyNotice] = useState(checkPrivacyNotice)
  const [dialogQueue, setDialogQueue] = useState<QueuedDialog[]>([])
  const [queuedFor, setQueuedFor] = useState<{ resource: typeof resource, changeFlags: typeof changeFlags } | null>(null)

  // Shown only once data has settled — the fastest-rendering UI otherwise
  // caught Amiri's font swap mid-view (§14g). Set while rendering, once (React's pattern for
  // state that follows other state; an effect would draw a frame without it first).
  if (!cacheLoading && needsPrivacyNotice && !privacyOpen) setPrivacyOpen(true)

  // Stable, so Dialog's focus/keydown effect doesn't re-run on every render.
  // needsPrivacyNotice is cleared too, or the effect above would reopen the
  // dialog on every retry cycle (§14m).
  const handlePrivacyClose = useCallback(() => {
    deviceStore.set(PRIVACY_NOTICE_KEY, '1')
    setNeedsPrivacyNotice(false)
    setPrivacyOpen(false)
  }, [])

  // Broadest scope first: Edition → Version → Revision. Queued once per load (a new resource and
  // new change flags), set while rendering like the privacy notice above.
  if (!cacheLoading && resource && (queuedFor?.resource !== resource || queuedFor.changeFlags !== changeFlags)) {
    const queue: QueuedDialog[] = []
    if (changeFlags.editionChanged) queue.push({ title: T.editionTitle, message: T.edition })
    if (changeFlags.versionChanged) queue.push({ title: T.versionTitle, message: T.version })
    if (changeFlags.revisionChanged) queue.push({ title: T.revisionTitle, message: T.revision })
    setQueuedFor({ resource, changeFlags })
    setDialogQueue(queue)
  }

  const handleDialogClose = useCallback(() => {
    setDialogQueue(prev => prev.slice(1))
  }, [])

  return (
    <>
      <Suspense fallback={null}>
        <Home />
      </Suspense>
      <Dialog open={privacyOpen} title={T.privacyTitle} message={T.privacy} onClose={handlePrivacyClose} />
      <Dialog
        open={dialogQueue.length > 0}
        title={dialogQueue[0]?.title ?? ''}
        message={dialogQueue[0]?.message ?? ''}
        onClose={handleDialogClose}
      />
      <ReportNotice
        open={!!rollbackDetails}
        title={T.rollbackTitle}
        message={T.rollback}
        subject={T.reportRollback}
        details={rollbackDetails ?? ''}
        onClose={dismissRollback}
      />
    </>
  )
}

function App() {
  return (
    <AppStateProvider>
      <DataCacheProvider>
        <AppShell />
      </DataCacheProvider>
    </AppStateProvider>
  )
}

export default App
