#!/usr/bin/env bash
# PermissionRequest: append a `permission` row to <repo>/docs/run/journal.md when the project's
# docs/run/STATE.md says `Journal: on`. Observes only — prints nothing and never returns a
# decision, so Claude Code shows its normal prompt. Costs no model tokens.
command -v jq >/dev/null 2>&1 || exit 0
input="$(cat)"
cwd="$(jq -r '.cwd // empty' <<<"$input")"; cwd="${cwd:-$PWD}"
top="$(git -C "$cwd" rev-parse --show-toplevel 2>/dev/null)" || exit 0
journal="$top/docs/run/journal.md"
state="$top/docs/run/STATE.md"
[ -f "$journal" ] && [ -f "$state" ] || exit 0
grep -Eq '^- Journal: on([[:space:]]*$|[[:space:]]+[^|[:space:]])' "$state" || exit 0

tool="$(jq -r '.tool_name // "unknown"' <<<"$input")"
case "$tool" in
  Bash) detail="$(jq -r '.tool_input.command // ""' <<<"$input")" ;;
  Edit|Write|MultiEdit|NotebookEdit)
    detail="$(jq -r '.tool_input.file_path // .tool_input.notebook_path // ""' <<<"$input")"
    detail="${detail#"$top"/}" ;;
  *) detail="$(jq -c '.tool_input // {}' <<<"$input")" ;;
esac
# One table row: no newlines or pipes, likely secrets masked, at most 120 chars.
detail="$(printf '%s' "$detail" | tr '\n|' '  ' \
  | sed -E 's/((token|secret|password|passwd|api[_-]?key|key)[A-Za-z_]*[=:][[:space:]]*)[^[:space:]]+/\1***/Ig' \
  | cut -c1-120)"
printf '| %s | permission | %s | %s |\n' "$(date '+%Y-%m-%d %H:%M')" "$tool" "$detail" >> "$journal"
exit 0
