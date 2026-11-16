# shellcheck shell=bash disable=SC2034
# (sourced, not executed: the variables below are used by pre-push-hook.sh)
# Which changed files mean a hub Worker must be checked and published again: its own folder, and
# the hub/src files it serves through a link (theme/site/, hijri/site/) or bundles (the Hijri
# Worker's code). test/worker-inputs.test.js in hub/ fails if a file a Worker uses is missing
# here (§15az).
THEME_WORKER_PATTERN='^hub/theme/|^hub/src/(net|digits|storage)\.js$'
HIJRI_WORKER_PATTERN='^hub/hijri/|^hub/src/(net|digits)\.js$'
