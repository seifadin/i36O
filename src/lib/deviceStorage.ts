import { createStore } from '@i360/storage'

// The app's settings and caches on the device: the hub's own store (hub/src/storage.js), so the
// app and the pages keep values the same way — JSON, never throwing (private browsing, full or
// blocked storage just means nothing is remembered). Keys have no prefix, as before. Anything older
// versions saved as plain text is removed before the app starts (hub/theme/early.js).
export const deviceStore = createStore()
