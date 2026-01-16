/**
 * TWAP Session Management with Vercel KV (Redis) persistence
 * 
 * This module manages TWAP sessions for the delegated execution model.
 * Users deposit USDC to the executor wallet, and the backend executes
 * trades on their behalf, returning MOVE to their wallet.
 */

import { kv } from "@vercel/kv";
import crypto from "crypto";

// Session key prefix for KV storage
const SESSION_PREFIX = "twap:session:";
const USER_SESSIONS_PREFIX = "twap:user:";

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

/**
 * Check if KV is configured
 */
function isKVConfigured(): boolean {
  return !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);
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
  
  // Store session in KV
  if (isKVConfigured()) {
    try {
      // Store session with TTL matching expiration
      const ttlSeconds = Math.ceil(totalDurationMs / 1000) + 3600; // Add 1 hour buffer
      await kv.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: ttlSeconds });
      
      // Add to user's session list
      await kv.sadd(`${USER_SESSIONS_PREFIX}${userAddress.toLowerCase()}`, sessionId);
      
      console.log(`[KV] Created session ${sessionId} for user ${userAddress}`);
    } catch (error) {
      console.error("[KV] Failed to store session:", error);
      throw new Error("Failed to create session - storage error");
    }
  } else {
    console.warn("[KV] Vercel KV not configured - sessions will not persist across function invocations");
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
  
  // Update in KV
  if (isKVConfigured()) {
    try {
      const ttlSeconds = Math.ceil((session.expiresAt - Date.now()) / 1000) + 3600;
      await kv.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: ttlSeconds });
      console.log(`[KV] Confirmed deposit for session ${sessionId}`);
    } catch (error) {
      console.error("[KV] Failed to update session:", error);
    }
  }
  
  return session;
}

/**
 * Get a session by ID
 */
export async function getSession(sessionId: string): Promise<TWAPSession | undefined> {
  if (isKVConfigured()) {
    try {
      const session = await kv.get<TWAPSession>(`${SESSION_PREFIX}${sessionId}`);
      return session || undefined;
    } catch (error) {
      console.error("[KV] Failed to get session:", error);
      return undefined;
    }
  }
  return undefined;
}

/**
 * Get all sessions (for admin/debugging)
 */
export async function getAllSessions(): Promise<TWAPSession[]> {
  if (isKVConfigured()) {
    try {
      const keys = await kv.keys(`${SESSION_PREFIX}*`);
      if (keys.length === 0) return [];
      
      const sessions = await Promise.all(
        keys.map(key => kv.get<TWAPSession>(key))
      );
      return sessions.filter((s): s is TWAPSession => s !== null);
    } catch (error) {
      console.error("[KV] Failed to get all sessions:", error);
      return [];
    }
  }
  return [];
}

/**
 * Get active sessions that need trade execution
 */
export async function getActiveSessionsForExecution(): Promise<TWAPSession[]> {
  const now = Date.now();
  const allSessions = await getAllSessions();
  
  return allSessions.filter(session => 
    session.status === "active" &&
    session.depositConfirmed &&
    session.nextTradeAt !== null &&
    session.nextTradeAt <= now &&
    session.tradesCompleted < session.numTrades &&
    session.expiresAt > now
  );
}

/**
 * Get sessions by user address
 */
export async function getSessionsByUser(userAddress: string): Promise<TWAPSession[]> {
  if (isKVConfigured()) {
    try {
      const sessionIds = await kv.smembers(`${USER_SESSIONS_PREFIX}${userAddress.toLowerCase()}`);
      if (!sessionIds || sessionIds.length === 0) return [];
      
      const sessions = await Promise.all(
        sessionIds.map(id => kv.get<TWAPSession>(`${SESSION_PREFIX}${id}`))
      );
      return sessions.filter((s): s is TWAPSession => s !== null);
    } catch (error) {
      console.error("[KV] Failed to get user sessions:", error);
      return [];
    }
  }
  return [];
}

/**
 * Delete/cancel a session
 */
export async function deleteSession(sessionId: string): Promise<boolean> {
  const session = await getSession(sessionId);
  if (!session) return false;
  
  if (isKVConfigured()) {
    try {
      // Update status to cancelled
      session.status = "cancelled";
      await kv.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: 3600 }); // Keep for 1 hour
      
      // Remove from user's session list
      await kv.srem(`${USER_SESSIONS_PREFIX}${session.userAddress.toLowerCase()}`, sessionId);
      
      console.log(`[KV] Cancelled session ${sessionId}`);
      return true;
    } catch (error) {
      console.error("[KV] Failed to delete session:", error);
      return false;
    }
  }
  return false;
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
  
  // Update in KV
  if (isKVConfigured()) {
    try {
      const ttlSeconds = Math.ceil((session.expiresAt - Date.now()) / 1000) + 3600;
      await kv.set(`${SESSION_PREFIX}${sessionId}`, session, { ex: ttlSeconds });
      console.log(`[KV] Recorded trade for session ${sessionId} - ${session.tradesCompleted}/${session.numTrades}`);
    } catch (error) {
      console.error("[KV] Failed to record trade:", error);
    }
  }
  
  return session;
}

/**
 * Clean up expired sessions
 */
export async function cleanupExpiredSessions(): Promise<number> {
  const now = Date.now();
  let cleaned = 0;
  
  const allSessions = await getAllSessions();
  
  for (const session of allSessions) {
    if (session.expiresAt < now && session.status !== "completed") {
      session.status = "failed";
      session.lastError = "Session expired";
      
      if (isKVConfigured()) {
        try {
          // Keep expired sessions for 1 hour for debugging
          await kv.set(`${SESSION_PREFIX}${session.id}`, session, { ex: 3600 });
          await kv.srem(`${USER_SESSIONS_PREFIX}${session.userAddress.toLowerCase()}`, session.id);
          cleaned++;
        } catch (error) {
          console.error("[KV] Failed to cleanup session:", error);
        }
      }
    }
  }
  
  return cleaned;
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
