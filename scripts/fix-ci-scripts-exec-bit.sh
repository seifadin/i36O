# shellcheck shell=bash
# Restores the executable bit of Xcode Cloud's ci_scripts — sourced by pre-commit-hook.sh and
# pre-push-hook.sh, so both run the same fix (§15c). pre-commit is where it counts (the fix
# joins the same commit); pre-push catches a bit lost with no new commit. Checks the file on
# disk as well as git's index: either can be wrong while the other looks right.
fix_ci_scripts_exec_bit() {
  local needs_fix=false
  for f in ios/App/ci_scripts/*.sh; do
    if [ ! -x "$f" ]; then
      needs_fix=true
    fi
  done
  if [ "$needs_fix" = true ] || git ls-files -s ios/App/ci_scripts/ | grep -q '^100644'; then
    echo "⚠ ci_scripts lost exec bit — restoring on disk and in the index:"
    chmod +x ios/App/ci_scripts/*.sh
    git add ios/App/ci_scripts/*.sh
    git ls-files -s ios/App/ci_scripts/
    return 0
  fi
  return 1
}
