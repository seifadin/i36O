# shellcheck shell=bash disable=SC2034
# (sourced, not executed: the variable below is used by the scripts that source it)
# What makes a change native — sourced by pre-commit-hook.sh (the version prompt) and
# pre-push-hook.sh (the store flow), so the two always agree (§14l).
# ota-timing.json is native too: capacitor.config.ts compiles it into the binary, and the
# bundle reads it as well, so new JS must not meet an old binary's timing (§14o).
NATIVE_PATTERN='^(android/|ios/|capacitor\.config\.ts|ota-timing\.json|package\.json|package-lock\.json)'
