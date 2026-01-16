-- =====================================================
-- SUPABASE ROW LEVEL SECURITY (RLS) FOR TWAP SESSIONS
-- =====================================================
-- Run this in your Supabase SQL Editor to enable RLS
-- This protects the database even if the service key is compromised

-- Enable RLS on the table
ALTER TABLE twap_sessions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Service role has full access" ON twap_sessions;
DROP POLICY IF EXISTS "Anon users cannot access" ON twap_sessions;

-- Policy: Service role (backend) has full access
-- This allows the backend to manage all sessions
CREATE POLICY "Service role has full access"
ON twap_sessions
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Policy: Anon users cannot access (if anon key is ever exposed)
CREATE POLICY "Anon users cannot access"
ON twap_sessions
FOR ALL
TO anon
USING (false)
WITH CHECK (false);

-- =====================================================
-- ADDITIONAL SECURITY MEASURES
-- =====================================================

-- Add index for faster lookups (if not already added)
CREATE INDEX IF NOT EXISTS idx_sessions_status ON twap_sessions(status);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON twap_sessions(user_address);
CREATE INDEX IF NOT EXISTS idx_sessions_next_trade ON twap_sessions(next_trade_at) WHERE status = 'active';

-- Add constraint to prevent invalid status values
ALTER TABLE twap_sessions 
DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE twap_sessions 
ADD CONSTRAINT valid_status 
CHECK (status IN ('awaiting_deposit', 'active', 'paused', 'completed', 'failed', 'cancelled'));

-- Add constraint to prevent negative amounts
ALTER TABLE twap_sessions
DROP CONSTRAINT IF EXISTS positive_amounts;

ALTER TABLE twap_sessions
ADD CONSTRAINT positive_amounts
CHECK (total_amount > 0 AND amount_per_trade > 0 AND num_trades > 0);

-- =====================================================
-- AUDIT LOG TABLE (Optional but recommended)
-- =====================================================
-- Uncomment to enable audit logging

-- CREATE TABLE IF NOT EXISTS twap_audit_log (
--   id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
--   session_id UUID REFERENCES twap_sessions(id),
--   action TEXT NOT NULL,
--   old_status TEXT,
--   new_status TEXT,
--   details JSONB,
--   created_at TIMESTAMPTZ DEFAULT NOW()
-- );

-- CREATE INDEX idx_audit_session ON twap_audit_log(session_id);
-- CREATE INDEX idx_audit_created ON twap_audit_log(created_at);

-- ALTER TABLE twap_audit_log ENABLE ROW LEVEL SECURITY;

-- CREATE POLICY "Service role has full access to audit"
-- ON twap_audit_log
-- FOR ALL
-- TO service_role
-- USING (true)
-- WITH CHECK (true);

COMMENT ON TABLE twap_sessions IS 'TWAP trading sessions - RLS enabled, service_role only';
