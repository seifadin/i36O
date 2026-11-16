import type { BundleInfo } from '@otakit/capacitor-updater'
import { deviceStore } from '@/lib/deviceStorage'

// OtaKit keeps its last failed update for good (it is cleared only by a new native version) and
// the app reads it at every start, so the rollback notice would repeat on every launch. A failure
// is shown once: closing the notice remembers it here, as JSON like every stored value (§15ba).
export const OTA_FAILURE_SEEN_KEY = 'i360OtaFailureSeen'

// Each downloaded bundle has its own id, so a later failure (even of the same version) is new.
const identity = (failure: BundleInfo) => failure.id

/** A failure the notice hasn't been closed for yet. */
export function isNewFailure(failure: BundleInfo | null | undefined): failure is BundleInfo {
  return !!failure && deviceStore.get(OTA_FAILURE_SEEN_KEY, null) !== identity(failure)
}

/** Remembers that this failure's notice was closed. */
export function markFailureSeen(failure: BundleInfo): void {
  deviceStore.set(OTA_FAILURE_SEEN_KEY, identity(failure))
}
