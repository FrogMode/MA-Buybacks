import { NextRequest, NextResponse } from "next/server";
import { 
  getActiveSessionsForExecution, 
  recordTrade,
  cleanupExpiredSessions,
  type TradeRecord,
  type TWAPSession
} from "@/lib/sessionKey";
import { 
  executeSwap, 
  isExecutorConfigured,
  getExecutorBalances 
} from "@/lib/executorWallet";

const CRON_SECRET = process.env.CRON_SECRET;

// Security: Track last execution to prevent rapid-fire calls
let lastExecutionTime = 0;
const MIN_EXECUTION_INTERVAL_MS = 30000; // 30 seconds minimum between executions

/**
 * Verify the request is from Vercel Cron or has valid secret
 */
function isAuthorizedCronRequest(request: NextRequest): boolean {
  // Check for Vercel's cron header (set automatically by Vercel Cron)
  const vercelCronHeader = request.headers.get("x-vercel-cron");
  if (vercelCronHeader === "true") {
    return true;
  }

  // Check for manual authorization with secret
  if (CRON_SECRET) {
    const authHeader = request.headers.get("authorization");
    if (authHeader === `Bearer ${CRON_SECRET}`) {
      return true;
    }
  }

  // In development, allow without auth
  if (process.env.NODE_ENV !== "production") {
    return true;
  }

  return false;
}

/**
 * GET /api/cron/twap - Cron job endpoint for executing TWAP trades
 * 
 * This endpoint is called by Vercel Cron every minute to execute
 * pending trades for all active sessions using the executor wallet.
 * 
 * Security:
 * - Only accepts requests from Vercel Cron or with valid CRON_SECRET
 * - Rate limited to prevent abuse
 * - All sensitive operations are logged
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  const requestId = `cron-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  try {
    // Security: Verify authorization
    if (!isAuthorizedCronRequest(request)) {
      console.warn(`[${requestId}] Unauthorized cron request from ${request.headers.get("x-forwarded-for") || "unknown"}`);
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Security: Rate limiting
    const timeSinceLastExecution = Date.now() - lastExecutionTime;
    if (timeSinceLastExecution < MIN_EXECUTION_INTERVAL_MS) {
      console.warn(`[${requestId}] Rate limited - last execution was ${timeSinceLastExecution}ms ago`);
      return NextResponse.json({
        success: false,
        error: "Rate limited",
        retryAfter: Math.ceil((MIN_EXECUTION_INTERVAL_MS - timeSinceLastExecution) / 1000),
      }, { status: 429 });
    }
    lastExecutionTime = Date.now();

    // Check if executor is configured
    if (!isExecutorConfigured()) {
      console.error(`[${requestId}] Executor wallet not configured`);
      return NextResponse.json({
        success: false,
        error: "Service unavailable",
      }, { status: 503 });
    }

    console.log(`[${requestId}] Starting TWAP cron execution`);

    // Clean up expired sessions first
    const cleaned = cleanupExpiredSessions();
    if (cleaned > 0) {
      console.log(`[${requestId}] Cleaned up ${cleaned} expired sessions`);
    }

    // Get sessions that need trade execution
    const sessionsToExecute = getActiveSessionsForExecution();

    if (sessionsToExecute.length === 0) {
      return NextResponse.json({
        success: true,
        message: "No trades to execute",
        executed: 0,
        cleaned,
        duration: Date.now() - startTime,
      });
    }

    console.log(`[${requestId}] Found ${sessionsToExecute.length} sessions with pending trades`);

    // Check executor balance (for logging only)
    const balances = await getExecutorBalances();
    console.log(`[${requestId}] Executor balances - USDC: ${balances.usdc.toFixed(2)}, MOVE: ${balances.move.toFixed(4)}`);

    const results: { 
      sessionId: string; 
      success: boolean; 
      error?: string; 
      swapTxHash?: string;
      transferTxHash?: string;
      amountIn?: number;
      amountOut?: number;
    }[] = [];

    // Execute trades for each session
    for (const session of sessionsToExecute) {
      try {
        console.log(`[${requestId}] Executing trade for session ${session.id.substring(0, 8)}... (${session.tradesCompleted + 1}/${session.numTrades})`);
        
        const result = await executeTrade(session, requestId);
        
        results.push({
          sessionId: session.id,
          success: result.success,
          swapTxHash: result.swapTxHash,
          transferTxHash: result.transferTxHash,
          amountIn: result.amountIn,
          amountOut: result.amountOut,
          error: result.error,
        });
        
        if (result.success) {
          console.log(`[${requestId}] Trade SUCCESS - ${result.amountIn} USDC -> ${result.amountOut?.toFixed(4)} MOVE`);
        } else {
          console.error(`[${requestId}] Trade FAILED - ${result.error}`);
        }
      } catch (error) {
        console.error(`[${requestId}] Trade execution error for session ${session.id}:`, error);
        results.push({
          sessionId: session.id,
          success: false,
          error: "Execution error",
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`[${requestId}] Execution complete - Success: ${successCount}, Failed: ${failCount}, Duration: ${Date.now() - startTime}ms`);

    // Return minimal info (don't expose internal details)
    return NextResponse.json({
      success: true,
      executed: results.length,
      successful: successCount,
      failed: failCount,
      duration: Date.now() - startTime,
    });
  } catch (error) {
    console.error(`[${requestId}] Cron job error:`, error);
    return NextResponse.json(
      { 
        success: false,
        error: "Execution failed",
      },
      { status: 500 }
    );
  }
}

/**
 * Execute a single trade for a session using the executor wallet
 */
async function executeTrade(session: TWAPSession, requestId: string): Promise<{
  success: boolean;
  swapTxHash?: string;
  transferTxHash?: string;
  amountIn?: number;
  amountOut?: number;
  error?: string;
}> {
  const tradeId = `trade-${session.id}-${session.tradesCompleted + 1}`;
  const trade: TradeRecord = {
    id: tradeId,
    timestamp: Date.now(),
    amountIn: session.amountPerTrade,
    amountOut: 0,
    swapTxHash: "",
    status: "pending",
  };

  try {
    // Execute swap via executor wallet (uses Shinami Gas Station)
    const result = await executeSwap(
      session.amountPerTrade,
      session.userAddress,
      session.slippageBps
    );

    // Record successful trade
    trade.swapTxHash = result.swapTxHash;
    trade.transferTxHash = result.transferTxHash;
    trade.amountOut = result.moveReceived;
    trade.status = "success";
    recordTrade(session.id, trade);

    return {
      success: true,
      swapTxHash: result.swapTxHash,
      transferTxHash: result.transferTxHash,
      amountIn: session.amountPerTrade,
      amountOut: result.moveReceived,
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Trade execution failed";
    
    trade.status = "failed";
    trade.error = errorMessage;
    recordTrade(session.id, trade);

    return { success: false, error: errorMessage };
  }
}

// POST is not allowed - only GET from Vercel Cron
export async function POST(request: NextRequest) {
  // Only allow POST with proper authorization (for manual testing)
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Method not allowed" }, { status: 405 });
  }
  return GET(request);
}
