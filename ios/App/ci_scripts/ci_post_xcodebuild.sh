#!/usr/bin/env bash
set -x

# This script runs even when xcodebuild failed (Apple's documented behaviour): a failed archive
# must never be released.
if [ "${CI_XCODEBUILD_EXIT_CODE}" != "0" ]; then
  echo "xcodebuild did not succeed (exit ${CI_XCODEBUILD_EXIT_CODE}) — skipping OtaKit release."
  exit 0
fi

# Only the Archive action releases (not Build, Test or Analyze).
if [ "${CI_XCODEBUILD_ACTION}" != "archive" ]; then
  echo "Not an archive action (${CI_XCODEBUILD_ACTION}) — skipping OtaKit release."
  exit 0
fi

# Only a manual Start Build releases — the deliberate "ship this", like the hook's release
# question; an automatic build (a workflow started by a push) never does (§15).
if [ "${CI_START_CONDITION}" != "manual" ]; then
  echo "Automatic build (start condition: ${CI_START_CONDITION}) — skipping OtaKit release. Use a manual Start Build to actually ship."
  exit 0
fi

# The OtaKit CLI, installed fresh each build, pinned to the version the Codespace releases with
# (pre-push-hook.sh); raise both together, deliberately.
npm install -g @otakit/cli@1.4.0

# The repo root, three levels up; dist/ is the one ci_post_clone.sh built in this run (Xcode's
# build only copies it into the app), so nothing is rebuilt here.
cd ../../..

# The one OTA release path (scripts/release-to-otakit.sh, §14m), which also skips when nothing
# web-relevant changed since the last release. || true: a failed release never fails the build.
bash scripts/release-to-otakit.sh || true
