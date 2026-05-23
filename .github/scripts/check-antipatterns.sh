#!/usr/bin/env bash
# .github/scripts/check-antipatterns.sh
#
# Repo-bundled subset of the completion-gate anti-pattern scanner so it can
# run in CI without depending on the user's local plugin install. Reads
# `.completion-gate.yml` at the repo root and greps every `forbidden_patterns:`
# entry against the listed path.
#
# Uses Python + PyYAML for parsing so YAML escapes (e.g. `"...['\"]..."`) are
# handled correctly. An earlier hand-rolled bash regex parser silently
# truncated any pattern containing `\"`, making rules like the
# `constructor.name === 'Prisma...'` blocker a no-op. The Python parser
# is the canonical answer; we no longer have any bash regex fallback.
#
# Exit code:
#   0  — no anti-pattern hits OR no config present (nothing to enforce)
#   1  — at least one anti-pattern matched
#   2  — environment is missing Python/PyYAML

set -uo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || echo "$PWD")"
cd "$REPO_ROOT"

CONFIG="$REPO_ROOT/.completion-gate.yml"
if [ ! -f "$CONFIG" ]; then
    echo "ℹ️  No .completion-gate.yml at $CONFIG — nothing to scan."
    exit 0
fi

if ! command -v python3 >/dev/null 2>&1; then
    echo "❌ python3 not on PATH — required to parse .completion-gate.yml" >&2
    exit 2
fi
if ! python3 -c "import yaml" 2>/dev/null; then
    echo "❌ PyYAML not installed. Run: pip3 install pyyaml" >&2
    exit 2
fi

# Emit one tab-separated row per forbidden_pattern entry. PyYAML handles
# every quoting style (double-quoted with `\"` escapes, single-quoted,
# block scalars) correctly so we never truncate the pattern.
PARSED=$(python3 - "$CONFIG" <<'PY'
import sys, yaml
try:
    with open(sys.argv[1]) as f:
        config = yaml.safe_load(f) or {}
except Exception as e:
    sys.stderr.write(f"YAML parse error: {e}\n")
    sys.exit(2)

for entry in (config.get('forbidden_patterns') or []):
    if not isinstance(entry, dict):
        continue
    # Field values cannot contain literal tabs/newlines or our TSV
    # boundary breaks. None of our use cases need them so we sanitise.
    def clean(v: str) -> str:
        return (v or '').replace('\t', ' ').replace('\n', ' ').replace('\r', ' ')
    pat = clean(entry.get('pattern'))
    pth = clean(entry.get('path') or '.')
    rsn = clean(entry.get('reason'))
    if pat:
        print(f"{pat}\t{pth}\t{rsn}")
PY
)
PARSE_RC=$?
if [ "$PARSE_RC" -ne 0 ]; then
    echo "❌ Failed to parse $CONFIG (rc=$PARSE_RC)" >&2
    exit 2
fi

FAIL_COUNT=0
PASS_COUNT=0
SKIP_COUNT=0

while IFS=$'\t' read -r pattern path reason; do
    [ -z "$pattern" ] && continue
    target="$REPO_ROOT/$path"
    if [ ! -e "$target" ]; then
        echo "⏭️  skip — target missing: $path  (pattern: /$pattern/)"
        SKIP_COUNT=$((SKIP_COUNT + 1))
        continue
    fi

    hits=$(grep -rnE \
        --exclude-dir=node_modules \
        --exclude-dir=.git \
        --exclude-dir=dist \
        --exclude-dir=build \
        --exclude-dir=.next \
        --exclude-dir=migrations \
        --exclude-dir=.turbo \
        "$pattern" "$target" 2>/dev/null | head -10)
    if [ -n "$hits" ]; then
        echo "❌ MATCHED — /$pattern/ in $path${reason:+ — $reason}"
        echo "$hits" | sed 's/^/    /'
        FAIL_COUNT=$((FAIL_COUNT + 1))
    else
        echo "✅ clean — /$pattern/ in $path"
        PASS_COUNT=$((PASS_COUNT + 1))
    fi
done <<< "$PARSED"

echo ""
echo "──────────────────────────────────────────────────────────"
printf "Passed: %s   Failed: %s   Skipped: %s\n" \
    "$PASS_COUNT" "$FAIL_COUNT" "$SKIP_COUNT"
echo "──────────────────────────────────────────────────────────"

if [ "$FAIL_COUNT" -gt 0 ]; then
    exit 1
fi
exit 0
