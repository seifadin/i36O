#!/usr/bin/env bash
set -e -x

# Each Xcode Cloud build starts fresh: Node (the project's LTS line, 24) is installed every time.
export HOMEBREW_NO_INSTALL_CLEANUP=TRUE
brew install node@24
brew link node@24 --force

# The script runs in its own folder (ios/App/ci_scripts/): the repo root is three levels up.
cd ../../..

npm ci
npm run build

# The PWA-only screenshots (the web manifest's store listing, never shown in the app) are
# stripped before cap sync, as pre-push-hook.sh does (§15b); ci_post_xcodebuild.sh releases
# this same dist/, so once here covers both the app and the OTA release.
if [ -d dist/assets/screenshots ]; then
  echo "Stripping PWA-only screenshots from dist/ before native sync/OTA..."
  rm -rf dist/assets/screenshots
fi

npx cap sync ios

# No CocoaPods: the project is pure SPM (§13); add `brew install cocoapods` only if a plugin
# ever needs it (every build counts against Xcode Cloud's free hours).
