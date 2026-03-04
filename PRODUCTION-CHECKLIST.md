# Production Deployment Checklist

## Pre-Deployment

### 1. Environment Variables
- [ ] `EXECUTOR_PRIVATE_KEY` - **CRITICAL** - Store in Vercel encrypted secrets
- [ ] `SUPABASE_URL` - Your Supabase project URL
- [ ] `SUPABASE_SERVICE_KEY` - Service role key (NOT anon key)
- [ ] `MOSAIC_API_KEY` - DEX integration key
- [ ] `SHINAMI_GAS_STATION_API_KEY` - Gas sponsorship
- [ ] `CRON_SECRET` - Random string for cron auth
- [ ] `COINMARKETCAP_API_KEY` - Optional, for token prices

### 2. Database Setup
- [ ] Run `supabase/schema.sql` in Supabase SQL editor
- [ ] Verify all tables created: `twap_sessions`, `cron_locks`, `deposit_registry`
- [ ] Test RLS policies are working
- [ ] Enable connection pooling (Supavisor)

### 3. Executor Wallet
- [ ] Generate new executor wallet (don't reuse test wallet)
- [ ] Fund with MOVE for gas (if not using Shinami)
- [ ] Fund with USDC for initial liquidity testing
- [ ] Record address: `___________________________`
- [ ] Verify private key is stored securely

### 4. Shinami Gas Station
- [ ] Create account at shinami.com
- [ ] Set up gas fund with sufficient MOVE
- [ ] Get API key and add to env
- [ ] Test sponsored transaction

### 5. Mosaic DEX
- [ ] Get API key from Mosaic
- [ ] Verify USDC/MOVE pool liquidity is sufficient
- [ ] Test quote endpoint

### 6. Vercel Configuration
- [ ] Create Vercel project
- [ ] Add all environment variables
- [ ] Configure cron job in `vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/twap",
      "schedule": "* * * * *"
    }
  ]
}
```
- [ ] Set production domain

---

## Security Checklist

### Critical
- [ ] Deposit verification is enabled (check `lib/depositVerification.ts` is imported)
- [ ] Cron locking is enabled (check `lib/cronLock.ts` is imported)
- [ ] Rate limiting is working
- [ ] RLS policies are active in Supabase

### High Priority
- [ ] Logging doesn't expose sensitive data
- [ ] Error messages don't leak internal details
- [ ] CORS is properly configured
- [ ] HTTPS only (Vercel handles this)

### Monitoring
- [ ] Set up error alerting (Sentry, etc.)
- [ ] Monitor executor wallet balance
- [ ] Set up balance low alerts
- [ ] Create dashboard for session statistics

---

## Testing Checklist

### Unit Tests
- [ ] Deposit verification with real transactions
- [ ] Session creation validation
- [ ] Slippage calculations
- [ ] Amount rounding

### Integration Tests
- [ ] Full flow: create session → deposit → verify → execute → complete
- [ ] Error handling: invalid deposit, expired session
- [ ] Concurrent execution handling (lock testing)

### Load Testing
- [ ] Simulate 50+ concurrent sessions
- [ ] Verify no race conditions
- [ ] Check database performance

---

## Post-Deployment

### Immediate (First Hour)
- [ ] Verify cron job is running (check Vercel logs)
- [ ] Test session creation from frontend
- [ ] Execute one small test trade ($10 USDC)
- [ ] Verify MOVE received in test wallet

### First Day
- [ ] Monitor all active sessions
- [ ] Check for any failed trades
- [ ] Review logs for anomalies
- [ ] Verify gas sponsorship is working

### Ongoing
- [ ] Daily: Check executor balance
- [ ] Weekly: Review session statistics
- [ ] Monthly: Security audit of logs
- [ ] Quarterly: Full security review

---

## Emergency Procedures

### If Executor Wallet Compromised
1. Immediately pause cron job (disable in Vercel)
2. Generate new executor wallet
3. Transfer any remaining funds to new wallet
4. Update EXECUTOR_PRIVATE_KEY in Vercel
5. Redeploy
6. Review all sessions - may need manual intervention

### If Funds Drained
1. Pause cron job
2. Document all affected sessions
3. Investigate attack vector
4. Fix vulnerability
5. Consider reimbursement plan

### If Cron Stuck
1. Check Vercel logs for errors
2. Manually release lock: DELETE FROM cron_locks WHERE lock_name = 'twap_cron_execution';
3. Check for database issues
4. Redeploy if needed

---

## Contact Information

- **Supabase Support:** support@supabase.io
- **Shinami Support:** support@shinami.com
- **Vercel Support:** support@vercel.com
- **Movement RPC Issues:** [Movement Discord]

---

Last updated: March 4, 2026
