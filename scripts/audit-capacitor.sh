#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# audit-capacitor.sh — Solvr Capacitor Stability Audit
#
# Detects violations of the 5 non-negotiable Capacitor rules documented in
# AGENTS.md. Must pass (exit 0) before every commit.
#
# Usage:  ./scripts/audit-capacitor.sh
# ─────────────────────────────────────────────────────────────────────────────

set -uo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

VIOLATIONS=0
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CLIENT_SRC="$PROJECT_ROOT/client/src"

echo ""
echo "═══════════════════════════════════════════════════════════"
echo "  Solvr Capacitor Stability Audit"
echo "═══════════════════════════════════════════════════════════"
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 1 + Rule 4: Hooks must be called BEFORE any early return / isNativeApp()
#
# Strategy: Use awk to find .tsx files where a top-level "return" appears
# before any hook call inside the same function component.
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}Rule 1 + 4: Hooks before early returns / isNativeApp() guards${NC}"

rule1_violations=0

# Create a temporary awk script for speed
cat > /tmp/audit-hooks.awk << 'AWKSCRIPT'
# Detect hook calls after early returns in React components
# Tracks brace depth to stay within the top-level function body

/^(export )?(default )?(function |const )\w+.*[({]/ {
  if (match($0, /function |const /)) {
    in_component = 1
    brace_depth = 0
    saw_return = 0
    saw_return_line = 0
    saw_hook = 0
    # Count opening braces on this line
    n = split($0, chars, "")
    for (i = 1; i <= n; i++) {
      if (chars[i] == "{") brace_depth++
      if (chars[i] == "}") brace_depth--
    }
  }
}

in_component && brace_depth >= 1 {
  line = $0
  # Strip leading whitespace
  gsub(/^[[:space:]]+/, "", line)
  
  # Skip comments
  if (line ~ /^\/\/|^\*|^\/\*/) next
  
  # Count braces to track depth
  n = split($0, chars, "")
  opens = 0
  closes = 0
  for (i = 1; i <= n; i++) {
    if (chars[i] == "{") opens++
    if (chars[i] == "}") closes++
  }
  
  # Detect hook calls (only at reasonable brace depth — component body level)
  if (line ~ /use(State|Effect|Callback|Memo|Ref|Query|Mutation|Swipe|PullToRefresh|OfflineMutation|Auth|RevenueCat|Theme|Location|Route|Params|Search)[[:space:]]*[(<]/) {
    if (saw_return && !saw_hook) {
      # Hook AFTER an early return — violation!
      printf "  \033[0;31mVIOLATION\033[0m %s:%d\n", FILENAME, NR
      printf "    Hook call after early return at line %d\n", saw_return_line
      printf "    > %s\n", line
      violations++
    }
    saw_hook = 1
  }
  
  # Detect early return (before hooks)
  if (!saw_hook && !saw_return && line ~ /^return[[:space:](;]/) {
    saw_return = 1
    saw_return_line = NR
  }
  
  # Also detect isNativeApp() return pattern before hooks
  if (!saw_hook && !saw_return && line ~ /isNativeApp\(\)/) {
    # Check if this line or context suggests a return
    if (line ~ /return/) {
      saw_return = 1
      saw_return_line = NR
    }
  }
  
  brace_depth += opens - closes
  
  # Reset when we exit the component function
  if (brace_depth <= 0) {
    in_component = 0
    saw_return = 0
    saw_hook = 0
  }
}

END {
  exit (violations > 0) ? 1 : 0
}
AWKSCRIPT

# Run awk across all tsx files
find "$CLIENT_SRC" -name "*.tsx" -type f -print0 | xargs -0 awk -f /tmp/audit-hooks.awk 2>/dev/null
rule1_result=$?

if [[ $rule1_result -ne 0 ]]; then
  # Count violations from output
  rule1_violations=$(find "$CLIENT_SRC" -name "*.tsx" -type f -print0 | xargs -0 awk -f /tmp/audit-hooks.awk 2>/dev/null | grep -c "VIOLATION" || true)
  VIOLATIONS=$((VIOLATIONS + rule1_violations))
else
  echo -e "  ${GREEN}✓ No hook-after-return violations found${NC}"
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 2: Never use window.location.origin directly
# Exceptions: const.ts (defines getSolvrOrigin), main.tsx (OAuth redirect)
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}Rule 2: No window.location.origin${NC}"

rule2_violations=0

while IFS= read -r result; do
  [[ -z "$result" ]] && continue
  
  file="$(echo "$result" | cut -d: -f1)"
  line_num="$(echo "$result" | cut -d: -f2)"
  content="$(echo "$result" | cut -d: -f3-)"
  
  basename="$(basename "$file")"
  # Allow const.ts and main.tsx
  if [[ "$basename" == "const.ts" ]] || [[ "$basename" == "main.tsx" ]]; then
    continue
  fi
  
  # Skip comments
  trimmed="$(echo "$content" | sed 's/^[[:space:]]*//')"
  if [[ "$trimmed" == //* ]] || [[ "$trimmed" == \** ]]; then
    continue
  fi
  
  rel_path="${file#$PROJECT_ROOT/}"
  echo -e "  ${RED}VIOLATION${NC} $rel_path:$line_num"
  echo "    Use getSolvrOrigin() instead of window.location.origin"
  echo "    > $trimmed"
  rule2_violations=$((rule2_violations + 1))
done < <(grep -rn 'window\.location\.origin' "$CLIENT_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null || true)

if [[ $rule2_violations -eq 0 ]]; then
  echo -e "  ${GREEN}✓ No window.location.origin violations found${NC}"
else
  VIOLATIONS=$((VIOLATIONS + rule2_violations))
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Rule 3: Never use relative fetch URLs
# ─────────────────────────────────────────────────────────────────────────────
echo -e "${YELLOW}Rule 3: No relative fetch URLs${NC}"

rule3_violations=0

while IFS= read -r result; do
  [[ -z "$result" ]] && continue
  
  file="$(echo "$result" | cut -d: -f1)"
  line_num="$(echo "$result" | cut -d: -f2)"
  content="$(echo "$result" | cut -d: -f3-)"
  
  basename="$(basename "$file")"
  # Allow main.tsx (tRPC httpBatchLink uses relative URL by design)
  if [[ "$basename" == "main.tsx" ]]; then
    continue
  fi
  
  # Skip comments
  trimmed="$(echo "$content" | sed 's/^[[:space:]]*//')"
  if [[ "$trimmed" == //* ]] || [[ "$trimmed" == \** ]]; then
    continue
  fi
  
  rel_path="${file#$PROJECT_ROOT/}"
  echo -e "  ${RED}VIOLATION${NC} $rel_path:$line_num"
  echo "    Use fetch(\`\${getSolvrOrigin()}/api/...\`) instead of relative URL"
  echo "    > $trimmed"
  rule3_violations=$((rule3_violations + 1))
done < <(grep -rn -E "fetch\s*\(\s*['\"\`]\s*/" "$CLIENT_SRC" --include="*.tsx" --include="*.ts" 2>/dev/null || true)

if [[ $rule3_violations -eq 0 ]]; then
  echo -e "  ${GREEN}✓ No relative fetch URL violations found${NC}"
else
  VIOLATIONS=$((VIOLATIONS + rule3_violations))
fi
echo ""

# ─────────────────────────────────────────────────────────────────────────────
# Summary
# ─────────────────────────────────────────────────────────────────────────────
echo "═══════════════════════════════════════════════════════════"
if [[ $VIOLATIONS -eq 0 ]]; then
  echo -e "  ${GREEN}✓ ALL CLEAR — 0 Capacitor violations found${NC}"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  exit 0
else
  echo -e "  ${RED}✗ FAILED — $VIOLATIONS Capacitor violation(s) found${NC}"
  echo "═══════════════════════════════════════════════════════════"
  echo ""
  echo "Fix all violations before committing. See AGENTS.md for details."
  echo ""
  exit 1
fi
