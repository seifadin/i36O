import { useEffect, useMemo, useRef, useState, Fragment, ReactNode } from 'react'
import { Capacitor } from '@capacitor/core'
import { useAppState } from '@/store/appState'
import { useDataCache, LOAD_ERROR } from '@/store/dataCache'
import { Science } from '@/api/dataSource'
import { computeIsGMSorApple, computeUseHuawei, resolveEffectiveOS } from '@/hooks/usePlatform'
import { groupSciences } from '@/lib/groupSciences'
import { checkPageReachable } from '@/lib/reachability'
import { wait } from '@i360/net'
import { openResource, ownPagePath } from '@/lib/openResource'
import { ICON } from '@/lib/icons'
import { fetchIcon, iconLoaded, loadedIcon } from '@/lib/iconsLoader'
import { REPORT_SUBJECTS } from '@/lib/feedbackReport'
import Dialog from '@/components/Dialog'
import ReportNotice from '@/components/ReportNotice'

// Visible fallback for a missing/misnamed icon — silently rendering nothing
// would make a bad icon name indistinguishable from "no icon set" (a failure
// nobody sees is hard to diagnose). CircleSlash makes a bad name noticeable.
const FALLBACK_ICON = <ICON.badIcon />

// A science's icon, by its Lucide name from Baserow: drawn at once when already loaded (the
// preload, dataCache.tsx), else as soon as it arrives; nothing until then.
function DynamicIcon({ name }: { name: string }) {
  const [, setArrived] = useState(0)
  useEffect(() => {
    if (iconLoaded(name)) return
    let live = true
    void fetchIcon(name).then(() => { if (live) setArrived((n) => n + 1) })
    return () => { live = false }
  }, [name])
  if (!iconLoaded(name)) return null
  return loadedIcon(name) ?? FALLBACK_ICON
}

// One button for a minor science, under an intermediate or directly under
// its major (only the indent differs: 3 gaps vs 2). Defined
// at module scope, not nested inside ScienceGrid, with onTap passed as a
// prop rather than closed over — a component defined inside another
// component's render body gets a fresh function identity every render,
// which React treats as a brand-new component type and remounts instead
// of reconciling.

// Every row reaches the screen's edges (its highlight and dividers); its content keeps the
// shared gap from them, clear of any safe-area inset (safe-sides, page-chrome.css), one gap
// more per level down.
const BUTTON = {
  major: 'flex w-full items-center justify-between safe-sides py-sm text-right text-list-lg font-normal text-brand-blue hover:bg-brand-highlight focus:outline-none',
  intermediate: 'flex w-full items-center justify-between safe-sides [--safe-level:2] py-xs text-right text-list font-normal text-brand-blue hover:bg-brand-highlight focus:outline-none',
}
const PANEL = { major: 'divide-y divide-brand-divider bg-brand-ivory', intermediate: 'divide-y divide-brand-divider bg-brand-ivory' }

// One expandable row of the science accordion (major or intermediate level).
// aria-expanded / aria-controls let screen readers announce what the chevron
// shows, and tie the button to the panel it reveals (WAI-ARIA disclosure).
function DisclosureRow({ level, label, icon, expanded, panelId, onToggle, children }: {
  level: 'major' | 'intermediate'
  label: string
  icon?: string | null
  expanded: boolean
  panelId: string
  onToggle: () => void
  children: ReactNode
}) {
  return (
    <div>
      <button onClick={onToggle} aria-expanded={expanded} aria-controls={panelId} className={BUTTON[level]}>
        <div className="flex items-center gap-sm">
          {expanded ? <ICON.expanded /> : <ICON.collapsed />}
          {icon && (
            <span className="text-brand-green">
              <DynamicIcon name={icon} />
            </span>
          )}
          <span>{label}</span>
        </div>
      </button>
      {expanded && <div id={panelId} className={PANEL[level]}>{children}</div>}
    </div>
  )
}

function MinorButton({
  science,
  indent,
  onTap,
  onAppendixTap,
}: {
  science: Science
  indent: 'nested' | 'direct'
  onTap: (science: Science) => void
  onAppendixTap: (science: Science) => void
}) {
  // Hover is the only tap feedback (CSS). It sits on this wrapper so the whole row,
  // paperclip included, keeps it.
  return (
    // The row clears the screen's edges (safe-sides at level 0: the insets alone), its button
    // keeps the levels' gaps, so the whole indent stays tappable and the paperclip clears the edge too.
    <div className="flex w-full items-center hover:bg-brand-highlight safe-sides [--safe-level:0]">
      <button
        onClick={() => onTap(science)}
        className={`flex flex-1 items-center gap-sm ${indent === 'nested' ? 'px-[calc(var(--safe-gap)*3)]' : 'px-[calc(var(--safe-gap)*2)]'} py-xs text-right text-list focus:outline-none text-brand-blue`}
      >
        {science.ScienceMinorIcon && (
          <span className="text-brand-green">
            <DynamicIcon name={science.ScienceMinorIcon} />
          </span>
        )}
        <span className="flex-1">{science.ScienceMinor_Ar}</span>
      </button>
      {science.WebAppendix && (
        <button
          // stopPropagation isn't actually needed here — this is a sibling
          // of the row button, not nested inside it, so there's no bubbling
          // "row tap" to prevent — but kept explicit anyway since it costs
          // nothing and removes any doubt for a future reader.
          onClick={e => { e.stopPropagation(); onAppendixTap(science) }}
          className="px-sm py-xs text-brand-blue"
          aria-label="فتح الملحق"
        >
          <ICON.attachment />
        </button>
      )}
    </div>
  )
}

// Short status pill above the bottom bar (fixed positioning is viewport-
// relative, so it works from inside the scrolling grid). The 7rem offset —
// plus the real safe-area inset — is an estimate of the footer's height
// (OrnamentDivider + SearchBar + OSRow), not a measured value.
const CHECK_FLASH_MS = 450 // "site available" shows this long before the open

function StatusPill({ busy, text }: { busy?: boolean; text: string }) {
  return (
    <div
      role="status"
      className="i360-toast fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+7rem)] mx-auto w-fit"
    >
      {busy ? <ICON.loading className="animate-spin" /> : <ICON.checked />}
      <span>{text}</span>
    </div>
  )
}

export default function ScienceGrid() {
  const { state } = useAppState()
  const { sciences, resource: globalResource, loading, isRetrying, lastFailure } = useDataCache()
  const [openMajorId, setOpenMajorId] = useState<number | null>(null)
  const [openIntermediateId, setOpenIntermediateId] = useState<number | null>(null)
  // Reachability-check UI: checkFlash = the brief "available" pill before opening;
  // unreachableUrl drives the warning dialog.
  const [checkFlash, setCheckFlash] = useState(false)
  const [unreachableUrl, setUnreachableUrl] = useState<string | null>(null)
  // Unified loading/retry/error indicator. lastFailure (dataCache.tsx) persists
  // through retries until a real success, so the indicator stays tappable
  // instead of flickering every ~10s retry cycle.
  const [errorDialogOpen, setErrorDialogOpen] = useState(false)
  const [checking, setChecking] = useState(false)
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null)
  // A ref, not state: two quick taps can both land before a state update.
  const busyRef = useRef(false)

  const groups = useMemo(() => groupSciences(sciences), [sciences])

  function resolveUrl(science: Science): string {
    if (computeIsGMSorApple(state.useWeb, state.isChina, state.useHMS, state.simIOS)) {
      return resolveEffectiveOS(state.useWeb, state.simIOS) === 'ios' ? science.AppleAppStore ?? '' : science.GooglePlayStore ?? ''
    }
    if (computeUseHuawei(state.useWeb, state.isChina, state.useHMS)) {
      return science.HuaweiAppGallery ?? ''
    }
    return science.Web ?? ''
  }

  // Where a URL opens: one shared decision (lib/openResource.ts).
  const openCtx = { useWeb: state.useWeb, uriSchemes: globalResource?.URIschemes ?? '', inWebList: globalResource?.inWebList ?? '' }
  const open = (url: string) => openResource(url, openCtx)

  // R8: an open that runs after an await (the check below) can be popup-
  // blocked on the web. openResource() reports that, so offer it again behind
  // a button — a fresh tap.
  async function openOrOffer(url: string) {
    if (!(await open(url))) setBlockedUrl(url)
  }

  // A4: one tap at a time — the check can take ~10s, and a second tap would
  // start a second check and a second open. "checking" shows it's working.
  async function handleMinorTap(science: Science) {
    const url = resolveUrl(science)
    if (!url || busyRef.current) return
    busyRef.current = true
    try {
      // The app's own pages ship with it: nothing to check.
      if (globalResource?.WebsiteStatus && !ownPagePath(url)) {
        setChecking(true)
        const reachable = await checkPageReachable(url)
        setChecking(false)
        if (!reachable) {
          setUnreachableUrl(url)
          return
        }
        setCheckFlash(true)
        await wait(CHECK_FLASH_MS)
        setCheckFlash(false)
      }
      await openOrOffer(url)
    } finally {
      busyRef.current = false
      setChecking(false)
    }
  }

  async function handleAppendixTap(science: Science) {
    if (science.WebAppendix) await openOrOffer(science.WebAppendix)
  }

  if (loading && !lastFailure) {
    // First load, no failure yet — plain, non-interactive status text,
    // unchanged from the original behavior. Nothing to report yet, so
    // this deliberately isn't a button at all.
    return (
      <div className="flex items-center justify-center gap-sm p-md text-base text-brand-muted">
        <ICON.loading className="animate-spin" />
        <span>جارٍ التحميل...</span>
      </div>
    )
  }
  if (lastFailure) {
    // At least one failure has happened since the last genuine success —
    // one continuously-tappable indicator for loading, retrying and failed.
    // Opens a dialog with the error details and an optional report
    // action instead, matching the OTA rollback notice's own pattern
    // (App.tsx) — same shared reporting mechanism, same Dialog.tsx
    // component, closes immediately after reporting rather than staying
    // open with a "reported" confirmation, since there's no content
    // behind it worth returning to mid-failure either way.
    return (
      <>
        <button
          type="button"
          onClick={() => setErrorDialogOpen(true)}
          // Failed: the shared notice (.i360-banner), as the hub pages' errors; retrying: plain status text.
          className={loading
            ? 'flex w-full items-center justify-center gap-sm p-md text-center text-base'
            : 'i360-banner m-md flex w-[calc(100%-2*var(--i360-space-md,1rem))] items-center justify-center gap-sm text-center'}
        >
          {loading && <ICON.loading className="animate-spin text-brand-muted" />}
          <span className={loading ? 'text-brand-muted' : undefined}>
            {loading ? (isRetrying ? 'يُعاد المحاولة...' : 'جارٍ التحميل...') : lastFailure.message}
          </span>
        </button>
        <ReportNotice
          open={errorDialogOpen}
          title={LOAD_ERROR}
          message={lastFailure.message}
          subject={REPORT_SUBJECTS.dataLoad}
          details={`${lastFailure.message}\n\n${lastFailure.detail}`}
          onClose={() => setErrorDialogOpen(false)}
        />
      </>
    )
  }

  return (
    <Fragment>
      {checking && <StatusPill busy text="جارٍ التحقق من الموقع..." />}
      {checkFlash && <StatusPill text="الموقع متاح" />}
      <Dialog
        open={!!unreachableUrl}
        title="تعذر الوصول إلى الموقع"
        message="يبدو أن هذا الموقع غير متاح حاليًا."
        onClose={() => setUnreachableUrl(null)}
        // Native: the check is reliable, so "OK" stays the default. Web: CapacitorHttp
        // falls back to fetch, so CORS often makes this a false positive (§14q) —
        // "continue anyway" is emphasized there.
        emphasizeSecondary={!Capacitor.isNativePlatform()}
        secondaryAction={{
          label: 'المتابعة على أي حال',
          onClick: () => {
            const url = unreachableUrl
            setUnreachableUrl(null)
            if (url) void open(url) // never rejects
          },
        }}
      />
      <Dialog
        open={!!blockedUrl}
        title="تعذّر فتح الرابط تلقائيًا"
        message="اضغط «فتح» لفتح الرابط."
        onClose={() => setBlockedUrl(null)}
        emphasizeSecondary
        secondaryAction={{
          label: 'فتح',
          onClick: () => {
            const url = blockedUrl
            setBlockedUrl(null)
            if (url) void open(url) // a fresh tap; never rejects
          },
        }}
      />
      <div className="divide-y divide-brand-divider">
      {groups.map(group => (
        <DisclosureRow
          key={group.majorId}
          level="major"
          label={group.major}
          icon={group.majorIcon}
          expanded={openMajorId === group.majorId}
          panelId={`sci-major-${group.majorId}`}
          onToggle={() => {
            setOpenMajorId(openMajorId === group.majorId ? null : group.majorId)
            setOpenIntermediateId(null)
          }}
        >
          {group.children.map(child =>
            child.kind === 'intermediate' ? (
              <DisclosureRow
                key={`int-${child.intermediateId}`}
                level="intermediate"
                label={child.intermediate}
                icon={child.intermediateIcon}
                expanded={openIntermediateId === child.intermediateId}
                panelId={`sci-int-${group.majorId}-${child.intermediateId}`}
                onToggle={() => setOpenIntermediateId(openIntermediateId === child.intermediateId ? null : child.intermediateId)}
              >
                {child.items.map(({ science }) => (
                  <MinorButton
                    key={science.ScienceMinorId}
                    science={science}
                    indent="nested"
                    onTap={handleMinorTap}
                    onAppendixTap={handleAppendixTap}
                  />
                ))}
              </DisclosureRow>
            ) : (
              <MinorButton
                key={`minor-${child.science.ScienceMinorId}`}
                science={child.science}
                indent="direct"
                onTap={handleMinorTap}
                onAppendixTap={handleAppendixTap}
              />
            )
          )}
        </DisclosureRow>
      ))}
      </div>
    </Fragment>
  )
}
