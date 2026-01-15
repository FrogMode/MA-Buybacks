"use client";

import { useState, useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { 
  Play, 
  Square, 
  Clock, 
  Zap, 
  RefreshCw, 
  Send, 
  CheckCircle2, 
  Loader2,
  Copy,
  ExternalLink,
  Wallet
} from "lucide-react";
import type { TWAPStatus, TradeExecution } from "@/types/twap";
import { TOKENS, TOKEN_DECIMALS, toRawAmount } from "@/lib/mosaic";

interface TWAPConfigProps {
  onStatusChange: (status: TWAPStatus) => void;
  onTradeExecuted: (trade: TradeExecution) => void;
}

interface SessionData {
  id: string;
  userAddress: string;
  depositTxHash: string | null;
  depositedAmount: number;
  depositConfirmed: boolean;
  totalAmount: number;
  amountPerTrade: number;
  numTrades: number;
  tradesCompleted: number;
  intervalMinutes: number;
  slippageBps: number;
  status: string;
  createdAt: number;
  startedAt: number | null;
  nextTradeAt: number | null;
  expiresAt: number;
  totalMoveReceived: number;
  trades: TradeExecution[];
  lastError: string | null;
}

// Movement Network RPC
const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";

// USDC token address for transfers
const USDC_FA_ADDRESS = "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39";

export function TWAPConfig({
  onStatusChange,
  onTradeExecuted,
}: TWAPConfigProps) {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [totalAmount, setTotalAmount] = useState("5");
  const [numTrades, setNumTrades] = useState("5");
  const [intervalMinutes, setIntervalMinutes] = useState("1");
  const [slippageBps, setSlippageBps] = useState("100");
  
  // Session state
  const [session, setSession] = useState<SessionData | null>(null);
  const [executorAddress, setExecutorAddress] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  
  // Polling for session updates
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aptosClientRef = useRef<Aptos | null>(null);

  const totalTradesNum = parseInt(numTrades, 10) || 0;
  const amountPerTrade = parseFloat(totalAmount) / totalTradesNum || 0;
  const progress = session 
    ? (session.tradesCompleted / session.numTrades) * 100 
    : 0;

  // Initialize Aptos client
  useEffect(() => {
    if (!aptosClientRef.current) {
      const aptosConfig = new AptosConfig({
        network: Network.CUSTOM,
        fullnode: MOVEMENT_RPC,
      });
      aptosClientRef.current = new Aptos(aptosConfig);
    }
  }, []);

  // Check for executor wallet on mount
  useEffect(() => {
    checkExecutorWallet();
  }, []);

  // Check for existing active session on mount
  useEffect(() => {
    if (connected && account?.address) {
      checkExistingSession();
    }
  }, [connected, account?.address]);

  // Poll for session updates when active
  useEffect(() => {
    if (session?.status === "active" || session?.status === "awaiting_deposit") {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [session?.status, session?.id]);

  const checkExecutorWallet = async () => {
    try {
      const response = await fetch("/api/session?executor=true");
      const data = await response.json();
      if (data.configured) {
        setExecutorAddress(data.address);
      }
    } catch (err) {
      console.error("Failed to check executor wallet:", err);
    }
  };

  const startPolling = () => {
    if (pollIntervalRef.current) return;
    
    pollIntervalRef.current = setInterval(async () => {
      if (session?.id) {
        await refreshSession(session.id);
      }
    }, 5000); // Poll every 5 seconds
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  };

  const checkExistingSession = async () => {
    if (!account?.address) return;
    
    try {
      const response = await fetch(`/api/session?userAddress=${account.address.toString()}`);
      const data = await response.json();
      
      if (data.sessions && data.sessions.length > 0) {
        // Find active or awaiting_deposit session
        const activeSession = data.sessions.find(
          (s: SessionData) => s.status === "active" || s.status === "awaiting_deposit"
        );
        if (activeSession) {
          setSession(activeSession);
          updateStatusFromSession(activeSession);
        }
      }
    } catch (err) {
      console.error("Failed to check existing session:", err);
    }
  };

  const refreshSession = async (sessionId: string) => {
    try {
      const response = await fetch(`/api/session?id=${sessionId}`);
      const data = await response.json();
      
      if (data.session) {
        setSession(data.session);
        updateStatusFromSession(data.session);
        
        // Update trade history
        if (data.session.trades) {
          data.session.trades.forEach((trade: any) => {
            onTradeExecuted({
              id: trade.id,
              timestamp: trade.timestamp,
              amountIn: trade.amountIn,
              amountOut: trade.amountOut,
              txHash: trade.swapTxHash,
              status: trade.status,
              error: trade.error,
            });
          });
        }
        
        // Check if completed
        if (data.session.status === "completed" || data.session.status === "failed") {
          stopPolling();
        }
      }
    } catch (err) {
      console.error("Failed to refresh session:", err);
    }
  };

  const updateStatusFromSession = (sessionData: SessionData) => {
    onStatusChange({
      isActive: sessionData.status === "active",
      config: {
        totalAmount: sessionData.totalAmount,
        intervalMs: sessionData.intervalMinutes * 60 * 1000,
        numTrades: sessionData.numTrades,
        slippageBps: sessionData.slippageBps,
        tokenIn: TOKENS.USDC,
        tokenOut: TOKENS.MOVE,
      },
      tradesCompleted: sessionData.tradesCompleted,
      totalTrades: sessionData.numTrades,
      nextTradeAt: sessionData.nextTradeAt,
      startedAt: sessionData.startedAt,
    });
  };

  const handleCreateSession = async () => {
    if (!connected || !account?.address) {
      setError("Please connect your wallet first");
      return;
    }

    if (!executorAddress) {
      setError("Executor wallet not configured. Please contact administrator.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create session on backend
      const createResponse = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userAddress: account.address.toString(),
          totalAmount,
          numTrades,
          intervalMinutes,
          slippageBps,
        }),
      });

      if (!createResponse.ok) {
        const errorData = await createResponse.json();
        throw new Error(errorData.error || "Failed to create session");
      }

      const { session: newSession } = await createResponse.json();
      setSession(newSession);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    } finally {
      setLoading(false);
    }
  };

  const handleDeposit = async () => {
    if (!session || !executorAddress || !account?.address) return;

    setDepositing(true);
    setError(null);

    try {
      // Transfer USDC to executor wallet using fungible asset transfer
      const rawAmount = toRawAmount(session.totalAmount, TOKEN_DECIMALS.USDC);
      
      const txPayload = {
        function: "0x1::primary_fungible_store::transfer" as `${string}::${string}::${string}`,
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [
          USDC_FA_ADDRESS, // metadata object
          executorAddress,  // recipient
          rawAmount,        // amount
        ],
      };

      const response = await signAndSubmitTransaction({
        data: txPayload,
      });

      // Wait for confirmation
      if (aptosClientRef.current) {
        await aptosClientRef.current.waitForTransaction({
          transactionHash: response.hash,
        });
      }

      // Confirm deposit with backend
      const confirmResponse = await fetch("/api/session", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: session.id,
          action: "confirm_deposit",
          txHash: response.hash,
          amount: session.totalAmount,
          userAddress: account.address.toString(),
        }),
      });

      if (!confirmResponse.ok) {
        const errorData = await confirmResponse.json();
        // If session not found, it may have been lost due to serverless cold start
        // Create a new session and confirm it
        if (errorData.error === "Session not found") {
          // Re-create session and confirm deposit
          const recreateResponse = await fetch("/api/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userAddress: account.address.toString(),
              totalAmount: session.totalAmount.toString(),
              numTrades: session.numTrades.toString(),
              intervalMinutes: session.intervalMinutes.toString(),
              slippageBps: session.slippageBps.toString(),
            }),
          });

          if (!recreateResponse.ok) {
            throw new Error("Failed to recreate session after deposit");
          }

          const { session: newSession } = await recreateResponse.json();
          
          // Now confirm the deposit on the new session
          const reconfirmResponse = await fetch("/api/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId: newSession.id,
              action: "confirm_deposit",
              txHash: response.hash,
              amount: session.totalAmount,
              userAddress: account.address.toString(),
            }),
          });

          if (!reconfirmResponse.ok) {
            throw new Error("Failed to confirm deposit on recreated session");
          }

          const { session: confirmedSession } = await reconfirmResponse.json();
          setSession(confirmedSession);
          updateStatusFromSession(confirmedSession);
          return;
        }
        throw new Error(errorData.error || "Failed to confirm deposit");
      }

      const { session: updatedSession } = await confirmResponse.json();
      setSession(updatedSession);
      updateStatusFromSession(updatedSession);

    } catch (err) {
      setError(err instanceof Error ? err.message : "Deposit failed");
    } finally {
      setDepositing(false);
    }
  };

  const handleStop = async () => {
    if (!session?.id) return;

    try {
      await fetch(`/api/session?id=${session.id}`, { method: "DELETE" });
      setSession(null);
      stopPolling();
      
      onStatusChange({
        isActive: false,
        config: null,
        tradesCompleted: session.tradesCompleted,
        totalTrades: 0,
        nextTradeAt: null,
        startedAt: null,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop TWAP");
    }
  };

  const copyAddress = () => {
    if (executorAddress) {
      navigator.clipboard.writeText(executorAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const isAwaitingDeposit = session?.status === "awaiting_deposit";
  const isActive = session?.status === "active";
  const isCompleted = session?.status === "completed";

  // No active session - show configuration form
  if (!session) {
    return (
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gradient mb-4">
          TWAP Configuration
        </h2>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Total Amount (USDC)
            </label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="5"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="0"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Number of Trades
            </label>
            <input
              type="number"
              value={numTrades}
              onChange={(e) => setNumTrades(e.target.value)}
              placeholder="5"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="1"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              <Clock className="w-4 h-4 inline mr-1" />
              Interval (minutes)
            </label>
            <input
              type="number"
              value={intervalMinutes}
              onChange={(e) => setIntervalMinutes(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="1"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              <Zap className="w-4 h-4 inline mr-1" />
              Slippage Tolerance (bps)
            </label>
            <input
              type="number"
              value={slippageBps}
              onChange={(e) => setSlippageBps(e.target.value)}
              placeholder="100"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="1"
              max="1000"
              step="1"
            />
            <p className="text-white/40 text-xs mt-1">
              {(parseInt(slippageBps, 10) / 100).toFixed(2)}% slippage
            </p>
          </div>

          <div className="glass-subtle rounded-lg p-3">
            <p className="text-sm text-white/70">
              <span className="font-medium text-movement-yellow">
                {amountPerTrade.toFixed(2)} USDC
              </span>{" "}
              per trade,{" "}
              <span className="font-medium text-white">{numTrades}</span> trades
              over{" "}
              <span className="font-medium text-white">
                {(() => {
                  const totalMinutes = parseFloat(intervalMinutes) * parseInt(numTrades, 10);
                  if (totalMinutes >= 60) {
                    return `${(totalMinutes / 60).toFixed(1)} hours`;
                  }
                  return `${totalMinutes.toFixed(0)} minutes`;
                })()}
              </span>
            </p>
          </div>

          <div className="glass-subtle rounded-lg p-3 border border-movement-yellow/10">
            <div className="flex items-start gap-2">
              <Wallet className="w-4 h-4 text-movement-yellow mt-0.5" />
              <div>
                <p className="text-sm font-medium text-movement-yellow">
                  Automated Execution
                </p>
                <p className="text-xs text-white/50 mt-1">
                  Deposit USDC once, and trades execute automatically. MOVE tokens are sent directly to your wallet after each swap.
                </p>
              </div>
            </div>
          </div>

          <button
            onClick={handleCreateSession}
            disabled={loading || !connected || !executorAddress}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-movement-yellow text-black hover:bg-movement-yellow-light hover:shadow-lg hover:shadow-movement-yellow/30"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Creating...
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Create TWAP Session
              </>
            )}
          </button>

          {!connected && (
            <p className="text-movement-yellow/70 text-sm text-center">
              Connect your wallet to start TWAP
            </p>
          )}

          {!executorAddress && connected && (
            <p className="text-red-400/70 text-sm text-center">
              Executor wallet not configured
            </p>
          )}
        </div>

        {error && (
          <div className="mt-4 glass-subtle border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Awaiting deposit
  if (isAwaitingDeposit) {
    return (
      <div className="glass rounded-xl p-6">
        <h2 className="text-lg font-semibold text-gradient mb-4">
          Deposit USDC to Start
        </h2>

        <div className="space-y-4">
          <div className="glass-subtle rounded-xl p-4 border border-movement-yellow/20">
            <div className="flex items-center gap-2 mb-3">
              <Send className="w-5 h-5 text-movement-yellow" />
              <span className="font-semibold text-movement-yellow">
                Step 1: Deposit USDC
              </span>
            </div>
            
            <p className="text-sm text-white/70 mb-4">
              Send <span className="font-bold text-white">{session.totalAmount} USDC</span> to the executor wallet to begin automated trading.
            </p>

            {executorAddress && (
              <div className="glass rounded-lg p-3 mb-4">
                <p className="text-xs text-white/50 mb-1">Executor Wallet Address</p>
                <div className="flex items-center gap-2">
                  <code className="text-xs text-white font-mono flex-1 break-all">
                    {executorAddress}
                  </code>
                  <button
                    onClick={copyAddress}
                    className="p-1.5 rounded hover:bg-white/10 transition-colors"
                  >
                    {copied ? (
                      <CheckCircle2 className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4 text-white/50" />
                    )}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={handleDeposit}
              disabled={depositing}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 bg-movement-yellow text-black hover:bg-movement-yellow-light"
            >
              {depositing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Depositing...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Deposit {session.totalAmount} USDC
                </>
              )}
            </button>
          </div>

          <div className="glass-subtle rounded-lg p-3">
            <p className="text-xs text-white/50">
              <strong className="text-white/70">Session Details:</strong><br />
              {session.numTrades} trades × {session.amountPerTrade.toFixed(2)} USDC every {session.intervalMinutes} min
            </p>
          </div>

          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-lg text-sm transition-all duration-200 text-white/50 hover:text-white/70 hover:bg-white/5"
          >
            Cancel Session
          </button>
        </div>

        {error && (
          <div className="mt-4 glass-subtle border border-red-500/30 rounded-lg p-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
      </div>
    );
  }

  // Active or completed session
  return (
    <div className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gradient mb-4">
        TWAP {isCompleted ? "Completed" : "In Progress"}
      </h2>

      <div className="space-y-4">
        <div className={`glass-subtle rounded-xl p-4 border ${
          isCompleted ? "border-green-500/20" : "border-movement-yellow/20"
        }`}>
          <div className="flex items-center gap-2 mb-3">
            {isCompleted ? (
              <>
                <CheckCircle2 className="w-5 h-5 text-green-400" />
                <span className="font-semibold text-green-400">
                  TWAP Complete
                </span>
              </>
            ) : (
              <>
                <div className="w-2.5 h-2.5 bg-movement-yellow rounded-full animate-pulse"></div>
                <span className="font-semibold text-movement-yellow">
                  TWAP Active
                </span>
              </>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/50">Progress</p>
              <p className="font-medium text-white">
                {session.tradesCompleted} / {session.numTrades} trades
              </p>
            </div>
            <div>
              <p className="text-white/50">MOVE Received</p>
              <p className="font-medium text-green-400">
                {session.totalMoveReceived.toFixed(4)} MOVE
              </p>
            </div>
            {session.nextTradeAt && !isCompleted && (
              <div className="col-span-2">
                <p className="text-white/50">Next Trade</p>
                <p className="font-medium text-white">
                  {new Date(session.nextTradeAt).toLocaleTimeString()}
                </p>
              </div>
            )}
          </div>

          {session.lastError && (
            <div className="mt-3 p-2 rounded-lg bg-red-500/10 border border-red-500/20">
              <p className="text-red-400 text-xs">{session.lastError}</p>
            </div>
          )}
        </div>

        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
          <div
            className={`h-2 rounded-full transition-all duration-500 ${
              isCompleted ? "bg-green-400" : "bg-movement-yellow"
            }`}
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        {/* Recent trades */}
        {session.trades.length > 0 && (
          <div className="glass-subtle rounded-lg p-3">
            <p className="text-xs text-white/50 mb-2">Recent Trades</p>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {session.trades.slice(-3).reverse().map((trade: any) => (
                <div key={trade.id} className="flex items-center justify-between text-xs">
                  <span className="text-white/70">
                    {trade.amountIn} USDC → {trade.amountOut?.toFixed(4) || "?"} MOVE
                  </span>
                  {trade.swapTxHash && (
                    <a
                      href={`https://explorer.movementnetwork.xyz/txn/${trade.swapTxHash}?network=mainnet`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-movement-yellow hover:underline flex items-center gap-1"
                    >
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {!isCompleted && (
          <button
            onClick={handleStop}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
          >
            <Square className="w-4 h-4" />
            Stop TWAP
          </button>
        )}

        {isCompleted && (
          <button
            onClick={() => setSession(null)}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 bg-movement-yellow text-black hover:bg-movement-yellow-light"
          >
            <RefreshCw className="w-4 h-4" />
            Start New TWAP
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 glass-subtle border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
