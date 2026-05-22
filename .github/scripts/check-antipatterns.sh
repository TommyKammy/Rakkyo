#!/usr/bin/env bash
# .github/scripts/check-antipatterns.sh
#
# Repo-bundled subset of the completion-gate anti-pattern scanner so it can
# run in CI without depending on the user's local plugin install. Reads
# `.completion-gate.yml` at the repo root and greps every `forbidden_patterns:`
# entry against the listed path.
#
# Exit code:
#   0  — no anti-pattern hits OR no config present (nothing to enforce)
#   1  — at least one anti-pattern matched
#
# Phase 1: the CI wraps this in `continue-on-error: true` so first-pass
# offenders surface as warnings without blocking PRs. Flip the wrapping to
# blocking once the existing hits are cleaned up.

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
cd "$REPO_ROOT"

CONFIG="$REPO_ROOT/.completion-gate.yml"
if [ ! -f "$CONFIG" ]; then
    echo "ℹ️  No .completion-gate.yml at $CONFIG — nothing to scan."
    exit 0
fi

FAIL_COUNT=0
PASS_COUNT=0
SKIP_COUNT=0

in_block=0
entry_pattern=""
entry_path=""
entry_reason=""

flush_entry() {
    [ -z "$entry_pattern" ] && return
    local p_path="${entry_path:-.}"
    local target="$REPO_ROOT/$p_path"
    if [ ! -e "$target" ]; then
        echo "⏭️  skip — target missing: $p_path  (pattern: /$entry_pattern/)"
        SKIP_COUNT=$((SKIP_COUNT + 1))
    else
        local hits
        hits=$(grep -rnE \
            --exclude-dir=node_modules \
            --exclude-dir=.git \
            --exclude-dir=dist \
            --exclude-dir=build \
            --exclude-dir=.next \
            --exclude-dir=migrations \
            --exclude-dir=.turbo \
            "$entry_pattern" "$target" 2>/dev/null | head -10)
        if [ -n "$hits" ]; then
            echo "❌ MATCHED — /$entry_pattern/ in $p_path${entry_reason:+ — $entry_reason}"
            echo "$hits" | sed 's/^/    /'
            FAIL_COUNT=$((FAIL_COUNT + 1))
        else
            echo "✅ clean — /$entry_pattern/ in $p_path"
            PASS_COUNT=$((PASS_COUNT + 1))
        fi
    fi
    entry_pattern=""
    entry_path=""
    entry_reason=""
}

while IFS= read -r line || [ -n "$line" ]; do
    if [[ "$line" =~ ^forbidden_patterns:[[:space:]]*$ ]]; then
        flush_entry
        in_block=1
        continue
    fi
    if [[ "$line" =~ ^[A-Za-z] ]] && [ "$in_block" -eq 1 ]; then
        flush_entry
        in_block=0
        continue
    fi
    [ "$in_block" -ne 1 ] && continue

    if [[ "$line" =~ ^[[:space:]]+-[[:space:]]+pattern:[[:space:]]*\"([^\"]+)\" ]]; then
        flush_entry
        entry_pattern="${BASH_REMATCH[1]}"
        continue
    fi
    if [[ "$line" =~ pattern:[[:space:]]*\"([^\"]+)\" ]] && [ -z "$entry_pattern" ]; then
        entry_pattern="${BASH_REMATCH[1]}"
        continue
    fi
    if [[ "$line" =~ path:[[:space:]]*\"([^\"]+)\" ]]; then
        entry_path="${BASH_REMATCH[1]}"
        continue
    fi
    if [[ "$line" =~ reason:[[:space:]]*\"([^\"]+)\" ]]; then
        entry_reason="${BASH_REMATCH[1]}"
        continue
    fi
done < "$CONFIG"
flush_entry

echo ""
echo "──────────────────────────────────────────────────────────"
printf "Passed: %s   Failed: %s   Skipped: %s\n" \
    "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT"
echo "──────────────────────────────────────────────────────────"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
