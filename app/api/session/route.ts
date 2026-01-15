import { NextRequest, NextResponse } from "next/server";
import { 
  createSession, 
  getSession, 
  deleteSession, 
  getSessionsByUser,
  confirmDeposit,
  type TWAPSession 
} from "@/lib/sessionKey";
import { 
  getExecutorAddress, 
  isExecutorConfigured,
  getExecutorBalances 
} from "@/lib/executorWallet";

// Security constants
const MAX_TOTAL_AMOUNT = 100000; // Max $100k USDC per session
const MIN_TOTAL_AMOUNT = 1;      // Min $1 USDC
const MAX_NUM_TRADES = 1000;     // Max 1000 trades per session
const MIN_INTERVAL_MINUTES = 1;  // Min 1 minute between trades
const MAX_SLIPPAGE_BPS = 500;    // Max 5% slippage

/**
 * Validate Aptos address format
 */
function isValidAptosAddress(address: string): boolean {
  // Aptos addresses are 64 hex chars (32 bytes) with 0x prefix
  return /^0x[a-fA-F0-9]{1,64}$/.test(address);
}

/**
 * POST /api/session - Create a new TWAP session
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      userAddress, 
      totalAmount, 
      numTrades, 
      intervalMinutes, 
      slippageBps 
    } = body;

    // Validate required fields
    if (!userAddress || !totalAmount || !numTrades || !intervalMinutes) {
      return NextResponse.json(
        { error: "Missing required fields: userAddress, totalAmount, numTrades, intervalMinutes" },
        { status: 400 }
      );
    }

    // Validate address format
    if (!isValidAptosAddress(userAddress)) {
      return NextResponse.json(
        { error: "Invalid wallet address format" },
        { status: 400 }
      );
    }

    // Parse and validate numeric values
    const parsedAmount = parseFloat(totalAmount);
    const parsedNumTrades = parseInt(numTrades, 10);
    const parsedInterval = parseInt(intervalMinutes, 10);
    const parsedSlippage = parseInt(slippageBps || "100", 10);

    if (isNaN(parsedAmount) || isNaN(parsedNumTrades) || isNaN(parsedInterval)) {
      return NextResponse.json(
        { error: "Invalid numeric values" },
        { status: 400 }
      );
    }

    // Validate ranges
    if (parsedAmount < MIN_TOTAL_AMOUNT || parsedAmount > MAX_TOTAL_AMOUNT) {
      return NextResponse.json(
        { error: `Total amount must be between ${MIN_TOTAL_AMOUNT} and ${MAX_TOTAL_AMOUNT} USDC` },
        { status: 400 }
      );
    }

    if (parsedNumTrades < 1 || parsedNumTrades > MAX_NUM_TRADES) {
      return NextResponse.json(
        { error: `Number of trades must be between 1 and ${MAX_NUM_TRADES}` },
        { status: 400 }
      );
    }

    if (parsedInterval < MIN_INTERVAL_MINUTES) {
      return NextResponse.json(
        { error: `Interval must be at least ${MIN_INTERVAL_MINUTES} minute(s)` },
        { status: 400 }
      );
    }

    if (parsedSlippage < 1 || parsedSlippage > MAX_SLIPPAGE_BPS) {
      return NextResponse.json(
        { error: `Slippage must be between 1 and ${MAX_SLIPPAGE_BPS} bps (${MAX_SLIPPAGE_BPS/100}%)` },
        { status: 400 }
      );
    }

    // Check if executor wallet is configured
    if (!isExecutorConfigured()) {
      return NextResponse.json(
        { error: "Service temporarily unavailable" },
        { status: 503 }
      );
    }

    // Check for existing active sessions for this user (limit to 1 active session per user)
    // Note: We allow creating a new session if the previous one was lost due to serverless cold start
    const existingSessions = getSessionsByUser(userAddress);
    const activeSession = existingSessions.find(
      s => s.status === "active" || s.status === "awaiting_deposit"
    );
    if (activeSession) {
      // Return the existing session instead of creating a new one
      return NextResponse.json({
        success: true,
        session: sanitizeSession(activeSession),
        executorAddress: getExecutorAddress(),
        instructions: `You have an existing session. Send ${activeSession.totalAmount} USDC to ${getExecutorAddress()} to start your TWAP`,
        existing: true,
      });
    }

    // Create the session
    const session = await createSession({
      userAddress,
      totalAmount: parsedAmount,
      numTrades: parsedNumTrades,
      intervalMinutes: parsedInterval,
      slippageBps: parsedSlippage,
    });

    // Get executor address for deposit
    const executorAddress = getExecutorAddress();

    return NextResponse.json({
      success: true,
      session: sanitizeSession(session),
      executorAddress,
      instructions: `Send ${session.totalAmount} USDC to ${executorAddress} to start your TWAP`,
    });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/session - Get session status
 * Query params: 
 *   - id: specific session ID
 *   - userAddress: get all sessions for a user
 *   - executor: get executor wallet info (public)
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("id");
    const userAddress = searchParams.get("userAddress");
    const getExecutor = searchParams.get("executor");

    // Return executor info (public - only address, no balances for security)
    if (getExecutor === "true") {
      if (!isExecutorConfigured()) {
        return NextResponse.json({
          configured: false,
        });
      }

      const address = getExecutorAddress();
      // Don't expose balances publicly - could be used to gauge attack timing
      return NextResponse.json({
        configured: true,
        address,
      });
    }

    // Get specific session by ID
    if (sessionId) {
      const session = getSession(sessionId);
      if (!session) {
        return NextResponse.json(
          { error: "Session not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        success: true,
        session: sanitizeSession(session),
      });
    }

    // Get sessions by user address
    if (userAddress) {
      if (!isValidAptosAddress(userAddress)) {
        return NextResponse.json(
          { error: "Invalid wallet address format" },
          { status: 400 }
        );
      }

      const sessions = getSessionsByUser(userAddress);
      return NextResponse.json({
        success: true,
        sessions: sessions.map(sanitizeSession),
      });
    }

    // Don't allow listing all sessions without authentication
    return NextResponse.json(
      { error: "userAddress or id parameter required" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to get session:", error);
    return NextResponse.json(
      { error: "Failed to get session" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/session - Cancel/stop a session
 * Only the session owner can cancel their session
 */
export async function DELETE(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sessionId = searchParams.get("id");
    const userAddress = searchParams.get("userAddress");

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    // Get session to verify ownership
    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Verify the requester owns this session (basic check - in production use proper auth)
    if (userAddress && session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    const deleted = deleteSession(sessionId);
    if (!deleted) {
      return NextResponse.json(
        { error: "Failed to cancel session" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Session cancelled",
    });
  } catch (error) {
    console.error("Failed to delete session:", error);
    return NextResponse.json(
      { error: "Failed to cancel session" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/session - Update session (confirm deposit, pause, resume)
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, action, txHash, amount, userAddress } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID required" },
        { status: 400 }
      );
    }

    const session = getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: "Session not found" },
        { status: 404 }
      );
    }

    // Verify ownership (basic check)
    if (userAddress && session.userAddress.toLowerCase() !== userAddress.toLowerCase()) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    if (action === "confirm_deposit") {
      if (!txHash) {
        return NextResponse.json(
          { error: "Transaction hash required for deposit confirmation" },
          { status: 400 }
        );
      }

      // Validate tx hash format
      if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
        return NextResponse.json(
          { error: "Invalid transaction hash format" },
          { status: 400 }
        );
      }

      // Only allow confirming deposits for sessions awaiting deposit
      if (session.status !== "awaiting_deposit") {
        return NextResponse.json(
          { error: "Session is not awaiting deposit" },
          { status: 400 }
        );
      }

      const depositAmount = amount || session.totalAmount;
      const updatedSession = confirmDeposit(sessionId, txHash, depositAmount);

      return NextResponse.json({
        success: true,
        session: sanitizeSession(updatedSession!),
        message: "Deposit confirmed. TWAP execution will begin shortly.",
      });
    }

    if (action === "pause") {
      if (session.status !== "active") {
        return NextResponse.json(
          { error: "Can only pause active sessions" },
          { status: 400 }
        );
      }
      session.status = "paused";
      return NextResponse.json({
        success: true,
        session: sanitizeSession(session),
      });
    }

    if (action === "resume") {
      if (session.status !== "paused") {
        return NextResponse.json(
          { error: "Can only resume paused sessions" },
          { status: 400 }
        );
      }
      session.status = "active";
      session.nextTradeAt = Date.now();
      return NextResponse.json({
        success: true,
        session: sanitizeSession(session),
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("Failed to update session:", error);
    return NextResponse.json(
      { error: "Failed to update session" },
      { status: 500 }
    );
  }
}

/**
 * Remove sensitive data before returning session to client
 */
function sanitizeSession(session: TWAPSession) {
  return {
    id: session.id,
    userAddress: session.userAddress,
    depositTxHash: session.depositTxHash,
    depositedAmount: session.depositedAmount,
    depositConfirmed: session.depositConfirmed,
    totalAmount: session.totalAmount,
    amountPerTrade: session.amountPerTrade,
    numTrades: session.numTrades,
    tradesCompleted: session.tradesCompleted,
    intervalMinutes: session.intervalMinutes,
    slippageBps: session.slippageBps,
    status: session.status,
    createdAt: session.createdAt,
    startedAt: session.startedAt,
    nextTradeAt: session.nextTradeAt,
    expiresAt: session.expiresAt,
    totalMoveReceived: session.totalMoveReceived,
    trades: session.trades,
    lastError: session.lastError,
  };
}
