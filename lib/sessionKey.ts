/**
 * TWAP Session Management
 * 
 * This module manages TWAP sessions for the delegated execution model.
 * Users deposit USDC to the executor wallet, and the backend executes
 * trades on their behalf, returning MOVE to their wallet.
 */

import crypto from "crypto";

// In-memory session storage (in production, use Redis or a database)
const sessions = new Map<string, TWAPSession>();

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
  
  // Store session
  sessions.set(sessionId, session);
  
  return session;
}

/**
 * Confirm a deposit and activate the session
 */
export function confirmDeposit(sessionId: string, txHash: string, amount: number): TWAPSession | undefined {
  const session = sessions.get(sessionId);
  if (!session) return undefined;
  
  session.depositTxHash = txHash;
  session.depositedAmount = amount;
  session.depositConfirmed = true;
  session.status = "active";
  session.startedAt = Date.now();
  session.nextTradeAt = Date.now(); // Execute first trade immediately
  
  return session;
}

/**
 * Get a session by ID
 */
export function getSession(sessionId: string): TWAPSession | undefined {
  return sessions.get(sessionId);
}

/**
 * Get all sessions
 */
export function getAllSessions(): TWAPSession[] {
  return Array.from(sessions.values());
}

/**
 * Get active sessions that need trade execution
 */
export function getActiveSessionsForExecution(): TWAPSession[] {
  const now = Date.now();
  return Array.from(sessions.values()).filter(session => 
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
export function getSessionsByUser(userAddress: string): TWAPSession[] {
  return Array.from(sessions.values()).filter(
    session => session.userAddress.toLowerCase() === userAddress.toLowerCase()
  );
}

/**
 * Delete/cancel a session
 */
export function deleteSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (session) {
    session.status = "cancelled";
    sessions.delete(sessionId);
    return true;
  }
  return false;
}

/**
 * Update session after a trade
 */
export function recordTrade(sessionId: string, trade: TradeRecord): TWAPSession | undefined {
  const session = sessions.get(sessionId);
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
  
  return session;
}

/**
 * Clean up expired sessions
 */
export function cleanupExpiredSessions(): number {
  const now = Date.now();
  let cleaned = 0;
  
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now && session.status !== "completed") {
      session.status = "failed";
      session.lastError = "Session expired";
      sessions.delete(id);
      cleaned++;
    }
  }
  
  return cleaned;
}

/**
 * Get session statistics
 */
export function getSessionStats(): {
  total: number;
  awaitingDeposit: number;
  active: number;
  completed: number;
  failed: number;
} {
  const allSessions = Array.from(sessions.values());
  return {
    total: allSessions.length,
    awaitingDeposit: allSessions.filter(s => s.status === "awaiting_deposit").length,
    active: allSessions.filter(s => s.status === "active").length,
    completed: allSessions.filter(s => s.status === "completed").length,
    failed: allSessions.filter(s => s.status === "failed" || s.status === "cancelled").length,
  };
}
