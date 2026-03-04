# Security Audit Report — MA-Buybacks

**Auditor:** Perseus  
**Date:** March 4, 2026  
**Severity Levels:** 🔴 Critical | 🟠 High | 🟡 Medium | 🟢 Low | ℹ️ Info

---

## Executive Summary

This TWAP bot handles user funds (USDC deposits → MOVE returns). The architecture uses a **custodial executor wallet** model, which introduces significant trust and security requirements.

**Overall Assessment:** The codebase has decent security foundations but needs hardening before handling significant volume.

---

## Critical Issues (🔴)

### 1. No Deposit Verification — Users Can Claim Fake Deposits
**Location:** `/app/api/session/route.ts` PATCH handler  
**Issue:** The `confirmDeposit` action trusts the user-provided `txHash` without verifying:
- That the transaction actually exists
- That it sent the correct amount to the executor wallet
- That it was from the claiming user

**Attack Vector:**
1. User creates session for 1000 USDC
2. User calls PATCH with a random/fake txHash
3. System activates session without actual deposit
4. Executor swaps USDC (from other users' deposits) and sends MOVE to attacker

**Fix Required:**
```typescript
// In confirmDeposit handler:
// 1. Fetch transaction from RPC
const tx = await aptos.getTransactionByHash({ transactionHash: txHash });

// 2. Verify it's a transfer TO the executor wallet
// 3. Verify the amount matches session.totalAmount
// 4. Verify sender matches session.userAddress
```

---

### 2. No Deposit Amount Tracking Per Session
**Location:** `lib/executorWallet.ts`  
**Issue:** The executor wallet holds pooled USDC from all users. There's no verification that:
- The executor has enough balance for a specific session
- Funds from Session A aren't being used for Session B

**Attack Vector:**
1. User A deposits 1000 USDC, session created
2. User B deposits nothing, claims fake deposit
3. Cron executes User B's session using User A's funds
4. User A's funds are stolen

**Fix Required:**
- Verify executor USDC balance before each swap
- Track per-session balances or implement accounting
- Consider separate deposit addresses per session (more complex)

---

### 3. Race Condition in Cron Execution
**Location:** `/app/api/cron/twap/route.ts`  
**Issue:** Multiple cron executions could run simultaneously (e.g., Vercel cold starts, network delays), potentially:
- Executing the same trade multiple times
- Draining the executor wallet faster than expected

**Current Mitigation:** In-memory `lastExecutionTime` check  
**Problem:** This resets on cold starts and doesn't work across multiple instances

**Fix Required:**
- Use database-level locking (Supabase row lock or Redis)
- Add trade idempotency keys
- Verify session state before executing trade

---

## High Issues (🟠)

### 4. Supabase Anon Key Usage
**Location:** `lib/sessionKey.ts`  
**Issue:** Falls back to `SUPABASE_ANON_KEY` which may have broader permissions than needed.

**Fix:** Always use `SUPABASE_SERVICE_KEY` for backend operations, configure RLS policies.

---

### 5. No Maximum Session Limits (Global)
**Location:** `/app/api/session/route.ts`  
**Issue:** While there's a per-user limit (5 sessions), there's no global limit. An attacker could:
1. Create thousands of sessions from different addresses
2. Overwhelm the cron executor
3. Cause DoS for legitimate users

**Fix:** Add global limits, require wallet signature for session creation.

---

### 6. Slippage Tolerance Up to 5%
**Location:** Session creation validation  
**Issue:** 5% slippage on large orders could result in significant value loss, especially if an attacker can manipulate the pool.

**Fix:** Consider lower default (1%) with user override, add minimum output checks.

---

### 7. No Monitoring/Alerting
**Issue:** No alerts for:
- Failed trades
- Balance anomalies
- Unusual activity patterns
- Executor wallet balance running low

**Fix:** Implement monitoring (Sentry, PagerDuty, or custom alerts).

---

## Medium Issues (🟡)

### 8. Transaction Hash Validation
**Location:** `/app/api/session/route.ts`  
**Issue:** Only validates format (`/^0x[a-fA-F0-9]{64}$/`), not existence or content.

---

### 9. Rate Limits Are In-Memory
**Location:** All API routes  
**Issue:** Rate limits reset on cold starts, don't work across instances.

**Fix:** Use Redis or Upstash for distributed rate limiting.

---

### 10. Logging Contains Sensitive Info
**Location:** Multiple files  
**Issue:** Logs include wallet addresses, amounts, transaction hashes. In production, these should be redacted or stored securely.

---

### 11. No Admin Authentication
**Issue:** No protected admin endpoints for:
- Viewing all sessions
- Manual intervention
- Emergency pause

---

### 12. Session Expiry Doesn't Refund
**Location:** `cleanupExpiredSessions`  
**Issue:** When sessions expire, status is set to "failed" but no automatic refund of unused USDC.

---

## Low Issues (🟢)

### 13. Hardcoded RPC Endpoint
**Location:** Multiple files  
**Issue:** `https://mainnet.movementnetwork.xyz/v1` is hardcoded. Should be configurable.

---

### 14. No Request ID in Logs
**Issue:** Hard to trace requests across log entries. Some endpoints have it, some don't.

---

### 15. TypeScript `any` Types
**Location:** Various  
**Issue:** Several `as any` casts reduce type safety.

---

## Informational (ℹ️)

### 16. Executor Wallet is Single Point of Failure
If the private key is compromised, all user funds are at risk. Consider:
- Multi-sig
- HSM/secure enclave
- Threshold signatures

### 17. No Audit Trail
Changes to sessions aren't logged with timestamps/actors. Important for dispute resolution.

### 18. Frontend Exposes Session Details
The sanitizeSession function is good, but ensure no sensitive data leaks through other endpoints.

---

## Recommendations Summary

### Before Production (Must Have):
1. ✅ Implement deposit verification (Critical #1)
2. ✅ Add database-level cron locking (Critical #3)
3. ✅ Verify executor balance before trades
4. ✅ Add monitoring and alerting
5. ✅ Use distributed rate limiting
6. ✅ Add admin authentication for sensitive ops

### Production Hardening (Should Have):
1. Lower default slippage
2. Add global session limits
3. Implement automatic refunds
4. Add request tracing
5. Configure RLS policies

### Long-term (Nice to Have):
1. Multi-sig executor
2. Per-session deposit addresses
3. Insurance fund
4. Formal smart contract audit

---

## Required Environment Variables

```env
# CRITICAL - Must be set
EXECUTOR_PRIVATE_KEY=      # 🔐 Guard with your life
SUPABASE_URL=              # Database URL
SUPABASE_SERVICE_KEY=      # NOT anon key
MOSAIC_API_KEY=            # DEX integration
SHINAMI_GAS_STATION_API_KEY= # Gas sponsorship
CRON_SECRET=               # Vercel cron auth

# OPTIONAL
COINMARKETCAP_API_KEY=     # Token price data
```

---

## Next Steps

1. I will implement fixes for Critical issues #1 and #3
2. Set up the project locally with test credentials
3. Run integration tests
4. Create production deployment checklist
