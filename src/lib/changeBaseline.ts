import { deviceStore } from '@/lib/deviceStorage'

// ─── "value changed since last seen" ──────────────────────────────────────────
// Two-phase: read here; the baseline is written only after the data it gates has
// actually loaded (commitBaseline, in dataCache.tsx's init()). Reading and writing in
// one call would let an attempt that fails after the check hide the change from every
// retry and every later launch — stale content indefinitely (§15h).
export function hasChanged(itemKey: string, value: string | null | undefined): boolean {
  if (!value) return false
  const stored = deviceStore.get<string | null>(itemKey, null)
  return stored !== null && String(stored) !== String(value)
}

export function commitBaseline(itemKey: string, value: string | null | undefined): void {
  if (value) deviceStore.set(itemKey, String(value))
}
