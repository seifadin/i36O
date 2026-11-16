# shellcheck shell=bash disable=SC2034
# (sourced, not executed: the variables below are used by the scripts that source it)
# Which changed files can affect what users get — sourced by pre-push-hook.sh and
# release-to-otakit.sh, so the two always agree (§15f, §14m).
#
# Exclusion lists, not inclusion lists: a file nobody has classified counts as relevant,
# costing at most one redundant deploy or release, never a missed one (§15f).
#
#   HOSTING_UNAFFECTED_PATTERN — files that can never change what Firebase Hosting serves.
#   OTA_UNAFFECTED_PATTERN — files that can never change the built bundle (dist/): the
#   hosting list plus hosting config (firebase.json, .firebaserc), tsconfig*.json (the type
#   check emits nothing) and package.json / package-lock.json / capacitor.config.ts, which go
#   through NATIVE_PATTERN's store flow instead (package.json still feeds __APP_VERSION__).
#   The OTA list contains the hosting list, so "OTA relevant" implies "hosting relevant":
#   pre-push-hook.sh relies on it (a skipped build never leaves an OTA release without dist/).
#
# Root-anchored: [^/]+\.md$ excludes root docs, not public/*.md (which would ship).
# hub/: only the parts the app's build can't read are excluded — the hub's Workers, indexer,
# books, scripts, tests and tools, its forwarders, its own config and docs, the theme's font
# tools, fonts, botpress.css and theme.css (read live from the theme site, never bundled).
# Everything else in hub/ counts (the theme loader, early.js, page-chrome.css and the shared
# files the app imports, and any new folder); test/release-checks.test.js fails if one of the
# app's inputs is ever excluded (§15au).
_HUB_UNAFFECTED='hub/(hijri|indexer|library|scripts|test|tools|forward)/|hub/(package\.json|package-lock\.json|eslint\.config\.js|firebase\.json|\.firebaserc|\.gitignore|[^/]+\.md)$|hub/theme/(fonts\.js|woff2\.js|fallbacks\.js|wrangler\.jsonc)$|hub/theme/site/(fonts/|botpress\.css$|theme\.css$|_headers$)'
_UNAFFECTED_COMMON="scripts/|android/|ios/|${_HUB_UNAFFECTED}|\\.github/|[^/]+\\.md\$|\\.gitignore\$|\\.env\\.example\$|eslint\\.config\\.js\$"
HOSTING_UNAFFECTED_PATTERN="^(${_UNAFFECTED_COMMON})"
OTA_UNAFFECTED_PATTERN="^(${_UNAFFECTED_COMMON}|firebase\.json\$|\.firebaserc\$|tsconfig[^/]*\.json\$|package\.json\$|package-lock\.json\$|capacitor\.config\.ts\$)"

# any_file_outside "<unaffected pattern>" "<newline-separated file list>"
# Succeeds if at least one listed file does NOT match the pattern (something relevant changed).
# An empty list fails: nothing changed (release-to-otakit.sh's normal "already released" case);
# a caller with an unknown list handles that itself (DIFF_UNKNOWN in pre-push-hook.sh). Call it
# inside `if`: its exit 1 would trip `set -e`.
any_file_outside() {
  local pattern="$1" files="$2"
  printf '%s\n' "$files" | grep -v '^$' | grep -qvE "$pattern"
}
