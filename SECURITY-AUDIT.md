# MA-Buybacks Security Audit

**Last Updated:** 2026-03-18
**Status:** In Progress

---

## Executive Summary

External security audit identified 6 vulnerabilities. This document tracks findings and remediation.

---

## Findings

### CRITICAL-1: Wallet Ownership Not Authenticated ⚠️ PARTIAL FIX

**Status:** ⚠️ Backend fixed, frontend integration needed

**Description:**
PATCH and DELETE endpoints trust `userAddress` from request body and compare strings. Attackers can spoof any address to cancel/update sessions they don't own.

**Location:** `app/api/session/route.ts` L297, L373, L397

**Fix:**
- Created `lib/walletAuth.ts` with cryptographic signature verification
- Requires wallet to sign a message proving ownership
- **TODO:** Frontend needs to integrate wallet signing

**Mitigation (temporary):** Rate limiting + logging of suspicious activity

---

### CRITICAL-2: Deposit Replay Attack ✅ FIXED

**Status:** ✅ Fixed

**Description:**
`isDepositAlreadyUsed()` function existed but was NOT called in the confirmation flow. Same transaction could be reused across multiple sessions, causing incorrect accounting.

**Location:** `app/api/session/route.ts` PATCH handler

**Fix:**
- Added `getSessionByDepositTx()` to check if tx already used
- Added replay check before confirming deposits
- Returns error if tx hash is already associated with another session

---

### CRITICAL-3: Asset Type Mismatch ✅ FIXED

**Status:** ✅ Fixed

**Description:**
Non-USDC deposits only logged a warning but still returned `valid: true`. This could lead to sessions being marked funded with wrong assets, causing executor fund exposure.

**Location:** `lib/depositVerification.ts`

**Fix:**
- Changed from `console.warn()` to `return { valid: false, error: "Wrong asset type" }`
- Strictly enforces USDC-only deposits

---

### HIGH-1: Mosaic Proxy Unauthenticated ✅ FIXED

**Status:** ✅ Fixed

**Description:**
The `/api/mosaic/quote` endpoint:
1. Forwarded ALL user-supplied query params to Mosaic
2. Injected private `MOSAIC_API_KEY` in requests
3. Had no authentication or rate limiting

This allowed external attackers to drain API quota.

**Location:** `app/api/mosaic/quote/route.ts`

**Fix:**
- Added parameter allowlist (only `srcAsset`, `dstAsset`, `amount`, `sender`, `slippage`, `recipient`)
- Added rate limiting (30 req/min per IP)
- Added parameter format validation
- Blocks and logs disallowed parameters

---

### HIGH-2: Non-Atomic Swap/Transfer ✅ FIXED

**Status:** ✅ Fixed

**Description:**
If swap succeeds but transfer fails:
1. System recorded failed trade
2. `tradesCompleted` didn't increment
3. Cron retried and executed another swap
4. `moveReceived` used quoted value, not actual on-chain output

This caused accounting errors and potential double-swaps.

**Location:** `lib/executorWallet.ts` `executeSwap()`

**Fix:**
- Read actual MOVE received from on-chain events after swap
- Better error handling when transfer fails (logs stuck funds)
- Return actual amount, not quoted amount
- Explicit error with swap tx hash for support recovery

---

### MEDIUM-1: Divide by Zero ✅ FIXED

**Status:** ✅ Fixed

**Description:**
Percentage change metrics return Infinity in first 24 hours when all buybacks are recent (denominator becomes 0).

**Locations fixed:**
- `lib/api.ts` - percentageChange24h calculations
- `components/twap/TWAPConfig.tsx` - amountPerTrade, progress calculations
- `lib/mosaic.ts` - rate calculation

**Fix:**
- Added `safePercentChange()` helper that handles 0 denominators
- Added explicit `> 0` checks before all divisions
- Returns 100% when all activity is in current period, 0 when no activity

---

## Remaining Work

1. **Frontend wallet signing** — Integrate wallet signature verification for PATCH/DELETE
2. ~~**Divide by zero** — Find and fix the percentage calculation~~ ✅ Done
3. **Production testing** — Test all fixes in staging environment
4. **Redis for nonces** — Replace in-memory nonce tracking with Redis

---

## Testing Checklist

- [ ] Attempt to cancel another user's session (should fail)
- [ ] Attempt to reuse deposit tx for two sessions (should fail)
- [ ] Deposit non-USDC token (should fail)
- [ ] Call Mosaic proxy with disallowed params (should be blocked)
- [ ] Execute swap and verify actual vs quoted amounts match
- [ ] Check percentage metrics in first 24 hours

---

## Commit History

- **2026-03-04:** Initial security audit, deposit verification, cron locking
- **2026-03-18:** Fixed CRITICAL-2, CRITICAL-3, HIGH-1, HIGH-2 based on external audit
