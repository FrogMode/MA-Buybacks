/**
 * TWAP Session Management with Supabase persistence
 * 
 * This module manages TWAP sessions for the delegated execution model.
 * Users deposit USDC to the executor wallet, and the backend executes
 * trades on their behalf, returning MOVE to their wallet.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";
import crypto from "crypto";

// Supabase client (lazy initialized)
let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn("[DB] Supabase not configured - sessions will not persist");
    return null;
  }
  
  supabase = createClient(url, key);
  return supabase;
}

export interface TradeRecord {
  id: string;
  timestamp: number;
  amountIn: number;  // USDC spent
  amountOut: number; // MOVE received
  swapTxHash: string;
  transferTxHash?: string; // MOVE transfer to user
  status: "pending" | "success" | "failed";
  error?: string;
}

export interface TWAPSession {
  id: string;
  userAddress: string;
  
  // Deposit tracking
  depositTxHash: string | null;  // User's deposit transaction
  depositedAmount: number;       // USDC deposited
  depositConfirmed: boolean;     // Whether deposit is confirmed
  
  // TWAP Configuration
  totalAmount: number;       // Total USDC to swap
  amountPerTrade: number;    // USDC per trade
  numTrades: number;         // Total number of trades
  tradesCompleted: number;   // Trades executed so far
  intervalMinutes: number;   // Minutes between trades
  slippageBps: number;       // Slippage tolerance in basis points
  
  // Session state
  status: "awaiting_deposit" | "active" | "paused" | "completed" | "failed" | "cancelled";
  createdAt: number;
  startedAt: number | null;
  nextTradeAt: number | null;
  expiresAt: number;         // Session expiration timestamp
  
  // Results tracking
  totalMoveReceived: number; // Total MOVE received across all trades
  trades: TradeRecord[];
  lastError: string | null;
}

export interface CreateSessionParams {
  userAddress: string;
  totalAmount: number;
  numTrades: number;
  intervalMinutes: number;
  slippageBps?: number;
}

// Database row type (snake_case for Postgres)
interface SessionRow {
  id: string;
  user_address: string;
  deposit_tx_hash: string | null;
  deposited_amount: number;
  deposit_confirmed: boolean;
  total_amount: number;
  amount_per_trade: number;
  num_trades: number;
  trades_completed: number;
  interval_minutes: number;
  slippage_bps: number;
  status: string;
  created_at: number;
  started_at: number | null;
  next_trade_at: number | null;
  expires_at: number;
  total_move_received: number;
  trades: TradeRecord[];
  last_error: string | null;
}

// Convert DB row to session object
function rowToSession(row: SessionRow): TWAPSession {
  return {
    id: row.id,
    userAddress: row.user_address,
    depositTxHash: row.deposit_tx_hash,
    depositedAmount: row.deposited_amount,
    depositConfirmed: row.deposit_confirmed,
    totalAmount: row.total_amount,
    amountPerTrade: row.amount_per_trade,
    numTrades: row.num_trades,
    tradesCompleted: row.trades_completed,
    intervalMinutes: row.interval_minutes,
    slippageBps: row.slippage_bps,
    status: row.status as TWAPSession["status"],
    createdAt: row.created_at,
    startedAt: row.started_at,
    nextTradeAt: row.next_trade_at,
    expiresAt: row.expires_at,
    totalMoveReceived: row.total_move_received,
    trades: row.trades || [],
    lastError: row.last_error,
  };
}

// Convert session to DB row
function sessionToRow(session: TWAPSession): SessionRow {
  return {
    id: session.id,
    user_address: session.userAddress,
    deposit_tx_hash: session.depositTxHash,
    deposited_amount: session.depositedAmount,
    deposit_confirmed: session.depositConfirmed,
    total_amount: session.totalAmount,
    amount_per_trade: session.amountPerTrade,
    num_trades: session.numTrades,
    trades_completed: session.tradesCompleted,
    interval_minutes: session.intervalMinutes,
    slippage_bps: session.slippageBps,
    status: session.status,
    created_at: session.createdAt,
    started_at: session.startedAt,
    next_trade_at: session.nextTradeAt,
    expires_at: session.expiresAt,
    total_move_received: session.totalMoveReceived,
    trades: session.trades,
    last_error: session.lastError,
  };
}

/**
 * Create a new TWAP session
 */
export async function createSession(params: CreateSessionParams): Promise<TWAPSession> {
  const { userAddress, totalAmount, numTrades, intervalMinutes, slippageBps = 100 } = params;
  
  // Calculate session duration with buffer (extra 30 minutes)
  const totalDurationMs = (numTrades * intervalMinutes + 30) * 60 * 1000;
  const expiresAt = Date.now() + totalDurationMs;
  
  // Generate unique session ID
  const sessionId = crypto.randomUUID();
  
  const session: TWAPSession = {
    id: sessionId,
    userAddress,
    depositTxHash: null,
    depositedAmount: 0,
    depositConfirmed: false,
    totalAmount,
    amountPerTrade: totalAmount / numTrades,
    numTrades,
    tradesCompleted: 0,
    intervalMinutes,
    slippageBps,
    status: "awaiting_deposit",
    createdAt: Date.now(),
    startedAt: null,
    nextTradeAt: null,
    expiresAt,
    totalMoveReceived: 0,
    trades: [],
    lastError: null,
  };
  
  const db = getSupabase();
  if (db) {
    try {
      const { error } = await db
        .from("twap_sessions")
        .insert(sessionToRow(session));
      
      if (error) throw error;
      console.log(`[DB] Created session ${sessionId} for user ${userAddress}`);
    } catch (error) {
      console.error("[DB] Failed to store session:", error);
      throw new Error("Failed to create session - storage error");
    }
  }
  
  return session;
}

/**
 * Confirm a deposit and activate the session
 */
export async function confirmDeposit(sessionId: string, txHash: string, amount: number): Promise<TWAPSession | undefined> {
  const session = await getSession(sessionId);
  if (!session) return undefined;
  
  session.depositTxHash = txHash;
  session.depositedAmount = amount;
  session.depositConfirmed = true;
  session.status = "active";
  session.startedAt = Date.now();
  session.nextTradeAt = Date.now(); // Execute first trade immediately
  
  const db = getSupabase();
  if (db) {
    try {
      const { error } = await db
        .from("twap_sessions")
        .update({
          deposit_tx_hash: txHash,
          deposited_amount: amount,
          deposit_confirmed: true,
          status: "active",
          started_at: session.startedAt,
          next_trade_at: session.nextTradeAt,
        })
        .eq("id", sessionId);
      
      if (error) throw error;
      console.log(`[DB] Confirmed deposit for session ${sessionId}`);
    } catch (error) {
      console.error("[DB] Failed to update session:", error);
    }
  }
  
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<TWAPSession | undefined> {
  const db = getSupabase();
  if (!db) return undefined;
  
  try {
    const { data, error } = await db
      .from("twap_sessions")
      .select("*")
      .eq("id", sessionId)
      .single();
    
    if (error || !data) return undefined;
    return rowToSession(data as SessionRow);
  } catch (error) {
    console.error("[DB] Failed to get session:", error);
    return undefined;
  }
}

/**
 * Get all sessions (for admin/debugging)
 */
export async function getAllSessions(): Promise<TWAPSession[]> {
  const db = getSupabase();
  if (!db) return [];
  
  try {
    const { data, error } = await db
      .from("twap_sessions")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (error || !data) return [];
    return data.map((row: SessionRow) => rowToSession(row));
  } catch (error) {
    console.error("[DB] Failed to get all sessions:", error);
    return [];
  }
}

/**
 * Get active sessions that need trade execution
 */
export async function getActiveSessionsForExecution(): Promise<TWAPSession[]> {
  const db = getSupabase();
  if (!db) return [];
  
  const now = Date.now();
  
  try {
    const { data, error } = await db
      .from("twap_sessions")
      .select("*")
      .eq("status", "active")
      .eq("deposit_confirmed", true)
      .lte("next_trade_at", now)
      .gt("expires_at", now);
    
    if (error || !data) return [];
    
    // Filter sessions that still have trades remaining
    return data
      .map((row: SessionRow) => rowToSession(row))
      .filter(s => s.tradesCompleted < s.numTrades);
  } catch (error) {
    console.error("[DB] Failed to get active sessions:", error);
    return [];
  }
}

/**
 * Get sessions by user address
 */
export async function getSessionsByUser(userAddress: string): Promise<TWAPSession[]> {
  const db = getSupabase();
  if (!db) return [];
  
  try {
    const { data, error } = await db
      .from("twap_sessions")
      .select("*")
      .ilike("user_address", userAddress)
      .order("created_at", { ascending: false });
    
    if (error || !data) return [];
    return data.map((row: SessionRow) => rowToSession(row));
  } catch (error) {
    console.error("[DB] Failed to get user sessions:", error);
    return [];
  }
}

/**
 * Delete/cancel a session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const db = getSupabase();
  if (!db) return false;
  
  try {
    const { error } = await db
      .from("twap_sessions")
      .update({ status: "cancelled" })
      .eq("id", sessionId);
    
    if (error) throw error;
    console.log(`[DB] Cancelled session ${sessionId}`);
    return true;
  } catch (error) {
    console.error("[DB] Failed to delete session:", error);
    return false;
  }
}

/**
 * Update session after a trade
 */
export async function recordTrade(sessionId: string, trade: TradeRecord): Promise<TWAPSession | undefined> {
  const session = await getSession(sessionId);
  if (!session) return undefined;
  
  session.trades.push(trade);
  
  if (trade.status === "success") {
    session.tradesCompleted++;
    session.totalMoveReceived += trade.amountOut;
    session.lastError = null;
    
    // Check if TWAP is complete
    if (session.tradesCompleted >= session.numTrades) {
      session.status = "completed";
      session.nextTradeAt = null;
    } else {
      // Schedule next trade
      session.nextTradeAt = Date.now() + (session.intervalMinutes * 60 * 1000);
    }
  } else if (trade.status === "failed") {
    session.lastError = trade.error || "Trade failed";
    // Still schedule next trade even if one fails
    if (session.tradesCompleted < session.numTrades) {
      session.nextTradeAt = Date.now() + (session.intervalMinutes * 60 * 1000);
    }
  }
  
  const db = getSupabase();
  if (db) {
    try {
      const { error } = await db
        .from("twap_sessions")
        .update({
          trades: session.trades,
          trades_completed: session.tradesCompleted,
          total_move_received: session.totalMoveReceived,
          status: session.status,
          next_trade_at: session.nextTradeAt,
          last_error: session.lastError,
        })
        .eq("id", sessionId);
      
      if (error) throw error;
      console.log(`[DB] Recorded trade for session ${sessionId} - ${session.tradesCompleted}/${session.numTrades}`);
    } catch (error) {
      console.error("[DB] Failed to record trade:", error);
    }
  }
  
  return session;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const db = getSupabase();
  if (!db) return 0;
  
  const now = Date.now();
  
  try {
    const { data, error } = await db
      .from("twap_sessions")
      .update({ status: "failed", last_error: "Session expired" })
      .lt("expires_at", now)
      .neq("status", "completed")
      .neq("status", "failed")
      .neq("status", "cancelled")
      .select();
    
    if (error) throw error;
    return data?.length || 0;
  } catch (error) {
    console.error("[DB] Failed to cleanup sessions:", error);
    return 0;
  }
}

/**
 * Get session statistics
 */
export async function getSessionStats(): Promise<{
  total: number;
  awaitingDeposit: number;
  active: number;
  completed: number;
  failed: number;
}> {
  const allSessions = await getAllSessions();
  return {
    total: allSessions.length,
    awaitingDeposit: allSessions.filter(s => s.status === "awaiting_deposit").length,
    active: allSessions.filter(s => s.status === "active").length,
    completed: allSessions.filter(s => s.status === "completed").length,
    failed: allSessions.filter(s => s.status === "failed" || s.status === "cancelled").length,
  };
}
