#!/usr/bin/env bash
# The one OTA release path, shared by its three callers: pre-push-hook.sh, ios/fastlane/Fastfile
# (deploy_apple) and ios/App/ci_scripts/ci_post_xcodebuild.sh (§14, §12 rule 12).
# Run from the repo root (dist/, package.json, capacitor.config.ts): each caller cd's there.
# No set -e at the top: its job is to survive a failure and retry once.
# Exit code: 0 on success or when skipped as not web-relevant (callers treat both as "done"),
# 1 on failure after the retry; it never aborts a caller itself.

set +e

# Skips when nothing web-relevant changed since the last release — here, not in each caller,
# so all three are covered (deploy_apple and Xcode Cloud call it after every iOS submission;
# a scripts/-only release once reached phones, §14m). The reference is the movable tag
# last-ota-release, moved and pushed after each release: the one state the Codespace, the Mac
# VM and Xcode Cloud share. Best-effort: any git failure releases rather than skips (an extra
# release is harmless, a missed one is not).
REPO_ROOT="$(git rev-parse --show-toplevel)"
source "$REPO_ROOT/scripts/ota-relevant-pattern.sh"
LAST_OTA_RELEASE_TAG="last-ota-release"

git fetch origin "refs/tags/$LAST_OTA_RELEASE_TAG:refs/tags/$LAST_OTA_RELEASE_TAG" >/dev/null 2>&1

if git rev-parse "$LAST_OTA_RELEASE_TAG" >/dev/null 2>&1; then
  CHANGED_SINCE_LAST_RELEASE=$(git diff --name-only "$LAST_OTA_RELEASE_TAG" HEAD 2>&1)
  DIFF_STATUS=$?
  if [ $DIFF_STATUS -ne 0 ]; then
    echo "  ⚠ Could not diff against $LAST_OTA_RELEASE_TAG ($CHANGED_SINCE_LAST_RELEASE)"
    echo "    — proceeding with the release rather than risk silently skipping"
    echo "    one that's genuinely needed."
  elif ! any_file_outside "$OTA_UNAFFECTED_PATTERN" "$CHANGED_SINCE_LAST_RELEASE"; then
    echo "→ Nothing web-bundle-relevant changed since the last OTA release ($LAST_OTA_RELEASE_TAG) — skipping."
    exit 0
  fi
else
  echo "→ No $LAST_OTA_RELEASE_TAG tag found yet (or unreachable from here) — treating this as the baseline release."
fi

unset OTA_CHANNEL
otakit upload --release
STATUS=$?

if [ $STATUS -ne 0 ]; then
  echo "  (OtaKit release failed, retrying once...)"
  sleep 3
  unset OTA_CHANNEL
  otakit upload --release
  STATUS=$?
fi
set -e

if [ $STATUS -eq 0 ]; then
  echo "✓ OtaKit release published, tagged with the current runtimeVersion."
  # Move the reference tag to this release and push it. Best-effort: an environment that can't
  # push (read-only CI) still released; the Codespace re-syncs the tag at its next release.
  if ! TAG_ERROR=$(git tag -f "$LAST_OTA_RELEASE_TAG" HEAD 2>&1); then
    echo "  ⚠ Could not create/move the local $LAST_OTA_RELEASE_TAG tag ($TAG_ERROR)"
    echo "    — the release above still succeeded, but this environment's copy"
    echo "    of the tag may now be stale until a future release corrects it."
  elif [ -n "${I360_DEFER_TAG_PUSH_UNTIL_PID:-}" ]; then
    # From pre-push-hook.sh, git's own push is still running: a push from inside it races it
    # (§15j), so the tag goes once that process has exited — detached, so git doesn't wait;
    # --no-verify, as a tag needs no hook. If the shell closes first, the tag waits for the
    # next release (fail-safe: at worst one redundant release).
    # shellcheck disable=SC2016  # $0/$1 expand in the inner shell, on purpose
    nohup bash -c 'while kill -0 "$0" 2>/dev/null; do sleep 1; done
      git push --no-verify origin "refs/tags/$1" --force' \
      "$I360_DEFER_TAG_PUSH_UNTIL_PID" "$LAST_OTA_RELEASE_TAG" >/dev/null 2>&1 </dev/null &
    echo "  ($LAST_OTA_RELEASE_TAG tag will be pushed once this push has finished.)"
  elif ! git push origin "refs/tags/$LAST_OTA_RELEASE_TAG" --force >/dev/null 2>&1; then
    echo "  (Could not push the $LAST_OTA_RELEASE_TAG tag from this environment —"
    echo "   the release above still succeeded. A future release from an"
    echo "   environment with push access will re-sync it.)"
  fi
else
  echo "⚠ OtaKit release failed after retry. Retry manually when ready:"
  echo "    unset OTA_CHANNEL && otakit upload --release"
fi

exit $STATUS
