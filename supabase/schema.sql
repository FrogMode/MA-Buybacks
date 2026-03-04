-- MA-Buybacks Database Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TWAP Sessions Table
-- ============================================
CREATE TABLE IF NOT EXISTS twap_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_address VARCHAR(255) NOT NULL,
  
  -- Deposit tracking
  deposit_tx_hash VARCHAR(255),
  deposited_amount DECIMAL(20, 6) DEFAULT 0,
  deposit_confirmed BOOLEAN DEFAULT FALSE,
  
  -- TWAP Configuration
  total_amount DECIMAL(20, 6) NOT NULL,
  amount_per_trade DECIMAL(20, 6) NOT NULL,
  num_trades INTEGER NOT NULL,
  trades_completed INTEGER DEFAULT 0,
  interval_minutes INTEGER NOT NULL,
  slippage_bps INTEGER DEFAULT 100,
  
  -- Session state
  status VARCHAR(50) DEFAULT 'awaiting_deposit',
  created_at BIGINT NOT NULL,
  started_at BIGINT,
  next_trade_at BIGINT,
  expires_at BIGINT NOT NULL,
  
  -- Results tracking
  total_move_received DECIMAL(20, 8) DEFAULT 0,
  trades JSONB DEFAULT '[]'::jsonb,
  last_error TEXT,
  
  -- Timestamps
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_twap_sessions_user ON twap_sessions(user_address);
CREATE INDEX idx_twap_sessions_status ON twap_sessions(status);
CREATE INDEX idx_twap_sessions_deposit_tx ON twap_sessions(deposit_tx_hash);
CREATE INDEX idx_twap_sessions_active ON twap_sessions(status, deposit_confirmed, next_trade_at) 
  WHERE status = 'active' AND deposit_confirmed = TRUE;

-- ============================================
-- Cron Locks Table (for distributed locking)
-- ============================================
CREATE TABLE IF NOT EXISTS cron_locks (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  lock_name VARCHAR(255) UNIQUE NOT NULL,
  locked_by VARCHAR(255) NOT NULL,
  locked_at BIGINT NOT NULL,
  expires_at BIGINT NOT NULL
);

CREATE INDEX idx_cron_locks_name ON cron_locks(lock_name);

-- ============================================
-- Deposit Registry (prevent double-spending)
-- ============================================
CREATE TABLE IF NOT EXISTS deposit_registry (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tx_hash VARCHAR(255) UNIQUE NOT NULL,
  session_id UUID NOT NULL REFERENCES twap_sessions(id),
  amount DECIMAL(20, 6) NOT NULL,
  sender_address VARCHAR(255) NOT NULL,
  verified_at BIGINT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deposit_registry_tx ON deposit_registry(tx_hash);
CREATE INDEX idx_deposit_registry_session ON deposit_registry(session_id);

-- ============================================
-- Row Level Security (RLS) Policies
-- ============================================

-- Enable RLS
ALTER TABLE twap_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE cron_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE deposit_registry ENABLE ROW LEVEL SECURITY;

-- Service role has full access (for backend)
CREATE POLICY "Service role full access to sessions" ON twap_sessions
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to locks" ON cron_locks
  FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role full access to deposits" ON deposit_registry
  FOR ALL
  USING (auth.role() = 'service_role');

-- ============================================
-- Helper Functions
-- ============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update updated_at
CREATE TRIGGER update_twap_sessions_updated_at
    BEFORE UPDATE ON twap_sessions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- Monitoring Views
-- ============================================

-- Active sessions view
CREATE OR REPLACE VIEW active_sessions_summary AS
SELECT 
  COUNT(*) as total_active,
  SUM(total_amount - (trades_completed * amount_per_trade)) as pending_usdc,
  SUM(total_move_received) as total_move_distributed,
  MIN(created_at) as oldest_session,
  MAX(next_trade_at) as next_scheduled_trade
FROM twap_sessions
WHERE status = 'active' AND deposit_confirmed = TRUE;

-- Session statistics view
CREATE OR REPLACE VIEW session_statistics AS
SELECT 
  status,
  COUNT(*) as count,
  SUM(total_amount) as total_usdc,
  SUM(total_move_received) as total_move,
  AVG(trades_completed::float / num_trades) as avg_completion_rate
FROM twap_sessions
GROUP BY status;

-- ============================================
-- Comments
-- ============================================
COMMENT ON TABLE twap_sessions IS 'TWAP buyback sessions for automated trading';
COMMENT ON TABLE cron_locks IS 'Distributed locks for cron job coordination';
COMMENT ON TABLE deposit_registry IS 'Registry of verified deposits to prevent double-spending';
