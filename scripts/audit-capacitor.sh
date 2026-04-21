#!/bin/bash
# audit-capacitor.sh — Static analysis for Capacitor-breaking patterns
# Run this after every Manus merge BEFORE committing or building.
# Exits non-zero if any blockers are found.

set -u
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

RED='\033[0;31m'
YELLOW='\033[0;33m'
GREEN='\033[0;32m'
NC='\033[0m'

EXIT_CODE=0

echo "═══════════════════════════════════════════════════════════════"
echo "  CAPACITOR COMPATIBILITY AUDIT"
echo "═══════════════════════════════════════════════════════════════"

# ── 1. Hooks called after conditional early returns (CRITICAL - error #310) ──
echo ""
echo "[1/6] Checking for hooks after conditional returns..."
VIOLATIONS=$(python3 - <<'PYEOF'
import os, re, sys
violations = []
HOOK_NAMES = r'use[A-Z]\w*|useState|useEffect|useCallback|useMemo|useRef|useSwipe|usePullToRefresh|useOfflineMutation|useMutation|useQuery|useAuth'

for root, _, files in os.walk('client/src'):
    for f in files:
        if not (f.endswith('.tsx') or f.endswith('.ts')): continue
        path = os.path.join(root, f)
        try:
            with open(path) as fh: src = fh.read()
        except: continue
        # Find each function component (export default function X / function X)
        lines = src.split('\n')
        func_starts = []
        for i, line in enumerate(lines):
            if re.match(r'^(export\s+default\s+)?function\s+[A-Z]\w*\s*\(', line):
                func_starts.append(i)
        for idx, start in enumerate(func_starts):
            end = func_starts[idx+1] if idx+1 < len(func_starts) else len(lines)
            block = lines[start:end]
            # Find first early return line (return with ( on same or next line, at top indent)
            early_return_idx = None
            for j, ln in enumerate(block):
                # Only top-level 2-space indent returns (not nested in handlers)
                if re.match(r'^  (if\s*\(|return\s*\()', ln):
                    if j > 2:  # Skip the main return at end
                        # Must be an EARLY return (conditional)
                        if 'if' in ln and '{' in ln:
                            early_return_idx = j
                            break
            if early_return_idx is None: continue
            # Check if any hook appears AFTER the early return
            for j in range(early_return_idx, len(block)):
                ln = block[j]
                m = re.search(r'\b(' + HOOK_NAMES + r')\s*\(', ln)
                if m and not ln.strip().startswith('//') and not ln.strip().startswith('*'):
                    # Found a hook after the early return
                    hook_name = m.group(1)
                    violations.append(f"{path}:{start+j+1} — {hook_name}() called after early return at line {start+early_return_idx+1}")
                    break

for v in violations: print(v)
PYEOF
)

if [ -n "$VIOLATIONS" ]; then
  echo -e "${RED}✗ FAIL: Hooks ordering violations (will cause React error #310 on Capacitor):${NC}"
  echo "$VIOLATIONS"
  EXIT_CODE=1
else
  echo -e "${GREEN}✓ PASS: No hooks-after-returns violations${NC}"
fi

# ── 2. window.location.origin outside const.ts ──
echo ""
echo "[2/6] Checking for window.location.origin (breaks on capacitor://)..."
BAD=$(grep -rn "window\.location\.origin" client/src --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v 'const\.ts' | grep -v 'node_modules' | grep -v '// .*window\.location' | grep -v '\.origin returns' || true)
if [ -n "$BAD" ]; then
  echo -e "${RED}✗ FAIL: window.location.origin used outside const.ts (use getSolvrOrigin() instead):${NC}"
  echo "$BAD"
  EXIT_CODE=1
else
  echo -e "${GREEN}✓ PASS: No rogue window.location.origin${NC}"
fi

# ── 3. Relative fetch URLs (fetch("/api/...")) ──
echo ""
echo "[3/6] Checking for relative fetch URLs..."
BAD=$(grep -rn 'fetch(\s*"\s*/api/' client/src --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v 'node_modules' || true)
if [ -n "$BAD" ]; then
  echo -e "${RED}✗ FAIL: Relative fetch URLs (go to capacitor://localhost on iOS):${NC}"
  echo "$BAD"
  EXIT_CODE=1
else
  echo -e "${GREEN}✓ PASS: No relative fetch URLs${NC}"
fi

# ── 4. import.meta.env.VITE_* without fallback ──
echo ""
echo "[4/6] Checking for env vars without fallbacks..."
BAD=$(grep -rn 'import\.meta\.env\.VITE_[A-Z_]*' client/src --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v '??\|||' | grep -v 'node_modules' | head -10 || true)
if [ -n "$BAD" ]; then
  echo -e "${YELLOW}⚠ WARN: env vars without fallbacks (may crash on Capacitor):${NC}"
  echo "$BAD"
fi

# ── 5. window.location.href = absolute https:// URL ──
echo ""
echo "[5/6] Checking for absolute URL redirects that kick to Safari..."
BAD=$(grep -rn 'window\.location\.href\s*=\s*`\${getSolvrOrigin()' client/src --include='*.tsx' --include='*.ts' 2>/dev/null | grep -v 'node_modules' || true)
if [ -n "$BAD" ]; then
  echo -e "${RED}✗ FAIL: window.location.href set to absolute solvr.com.au URL (kicks to Safari on iOS):${NC}"
  echo "$BAD"
  EXIT_CODE=1
else
  echo -e "${GREEN}✓ PASS: No Safari-kicking redirects${NC}"
fi

# ── 6. isNativeApp() as early return BEFORE hooks ──
echo ""
echo "[6/6] Checking for isNativeApp() guards before hooks (crash pattern)..."
BAD=$(python3 - <<'PYEOF'
import os, re
violations = []
for root, _, files in os.walk('client/src'):
    for f in files:
        if not (f.endswith('.tsx') or f.endswith('.ts')): continue
        path = os.path.join(root, f)
        try:
            with open(path) as fh: lines = fh.readlines()
        except: continue
        # Find isNativeApp() returns
        native_returns = [i for i, l in enumerate(lines) if re.match(r'^\s+if\s*\(\s*isNativeApp\(\)\s*\)', l)]
        for nr in native_returns:
            # Is there a useState/useCallback/etc AFTER this line in the same function scope?
            # Simple heuristic: find any "const [x, y] = useX(" within 100 lines below
            for j in range(nr+1, min(nr+100, len(lines))):
                m = re.search(r'(const\s+[\w\s,{}\[\]]+=\s*use[A-Z]\w+\s*\()', lines[j])
                if m:
                    # Check we're still in the same component (no 'export default' or blank func start)
                    block = ''.join(lines[nr:j+1])
                    if not re.search(r'^(export\s+default\s+)?function\s+[A-Z]', block[50:], re.MULTILINE):
                        violations.append(f"{path}:{nr+1} — isNativeApp() return at line {nr+1}, hook at line {j+1}")
                        break
for v in violations: print(v)
PYEOF
)
if [ -n "$BAD" ]; then
  echo -e "${RED}✗ FAIL: isNativeApp() early return BEFORE hooks (will crash on Capacitor):${NC}"
  echo "$BAD"
  EXIT_CODE=1
else
  echo -e "${GREEN}✓ PASS: No isNativeApp() returns before hooks${NC}"
fi

echo ""
echo "═══════════════════════════════════════════════════════════════"
if [ $EXIT_CODE -eq 0 ]; then
  echo -e "${GREEN}  AUDIT PASSED — safe to build${NC}"
else
  echo -e "${RED}  AUDIT FAILED — fix the issues above before building${NC}"
fi
echo "═══════════════════════════════════════════════════════════════"

exit $EXIT_CODE
