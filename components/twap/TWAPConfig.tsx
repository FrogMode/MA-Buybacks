"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { Play, Square, Clock, Zap, AlertCircle, ExternalLink } from "lucide-react";
import type { TWAPStatus, TradeExecution } from "@/types/twap";
import {
  getQuote,
  setMosaicApiKey,
  getMosaicApiKey,
  TOKENS,
  TOKEN_DECIMALS,
  toRawAmount,
  fromRawAmount,
} from "@/lib/mosaic";

interface TWAPConfigProps {
  onStatusChange: (status: TWAPStatus) => void;
  onTradeExecuted: (trade: TradeExecution) => void;
}

// Movement Network RPC
const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";

export function TWAPConfig({
  onStatusChange,
  onTradeExecuted,
}: TWAPConfigProps) {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [totalAmount, setTotalAmount] = useState("1000");
  const [numTrades, setNumTrades] = useState("10");
  const [intervalHours, setIntervalHours] = useState("1");
  const [slippageBps, setSlippageBps] = useState("50");
  const [isActive, setIsActive] = useState(false);
  const [tradesCompleted, setTradesCompleted] = useState(0);
  const [nextTradeAt, setNextTradeAt] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState("");
  const [isApiKeySet, setIsApiKeySet] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const aptosClientRef = useRef<Aptos | null>(null);

  const totalTradesNum = parseInt(numTrades, 10) || 0;
  const amountPerTrade = parseFloat(totalAmount) / totalTradesNum || 0;
  const progress =
    totalTradesNum > 0 ? (tradesCompleted / totalTradesNum) * 100 : 0;

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

  // Check if API key is already set (from localStorage)
  useEffect(() => {
    const savedKey = localStorage.getItem("mosaic_api_key");
    if (savedKey) {
      setMosaicApiKey(savedKey);
      setIsApiKeySet(true);
    }
  }, []);

  const handleSetApiKey = () => {
    if (apiKeyInput.trim()) {
      setMosaicApiKey(apiKeyInput.trim());
      localStorage.setItem("mosaic_api_key", apiKeyInput.trim());
      setIsApiKeySet(true);
      setApiKeyInput("");
    }
  };

  const handleClearApiKey = () => {
    setMosaicApiKey("");
    localStorage.removeItem("mosaic_api_key");
    setIsApiKeySet(false);
  };

  const executeTrade = useCallback(async () => {
    if (!connected || !account?.address) {
      setError("Wallet not connected");
      return;
    }

    if (!getMosaicApiKey()) {
      setError("Mosaic API key not configured");
      return;
    }

    const tradeId = `trade-${Date.now()}-${tradesCompleted + 1}`;
    const trade: TradeExecution = {
      id: tradeId,
      timestamp: Date.now(),
      amountIn: amountPerTrade,
      amountOut: 0,
      txHash: "",
      status: "pending",
    };

    onTradeExecuted({ ...trade });

    try {
      // Get quote from Mosaic
      const rawAmount = toRawAmount(amountPerTrade, TOKEN_DECIMALS.USDC);
      
      const quoteResponse = await getQuote({
        srcAsset: TOKENS.USDC,
        dstAsset: TOKENS.MOVE,
        amount: rawAmount,
        sender: account.address.toString(),
        slippage: parseInt(slippageBps, 10),
      });

      const expectedOut = fromRawAmount(quoteResponse.data.dstAmount, TOKEN_DECIMALS.MOVE);
      trade.amountOut = expectedOut;

      // Build and submit transaction using wallet adapter
      const txPayload = {
        function: quoteResponse.data.tx.function as `${string}::${string}::${string}`,
        typeArguments: quoteResponse.data.tx.typeArguments,
        functionArguments: quoteResponse.data.tx.functionArguments,
      };

      const response = await signAndSubmitTransaction({
        data: txPayload,
      });

      trade.txHash = response.hash;

      // Wait for transaction confirmation
      if (aptosClientRef.current) {
        const result = await aptosClientRef.current.waitForTransaction({
          transactionHash: response.hash,
        });

        if (!result.success) {
          throw new Error(`Transaction failed: ${result.vm_status}`);
        }
      }

      trade.status = "success";
      onTradeExecuted(trade);
      setTradesCompleted((prev) => prev + 1);
      setError(null);

    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Trade failed";
      setError(errorMessage);
      trade.status = "failed";
      trade.error = errorMessage;
      onTradeExecuted(trade);
    }
  }, [connected, account, amountPerTrade, tradesCompleted, slippageBps, onTradeExecuted, signAndSubmitTransaction]);

  const handleStart = async () => {
    if (!connected) {
      setError("Please connect your wallet first");
      return;
    }

    if (!getMosaicApiKey()) {
      setError("Please configure your Mosaic API key first");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      setIsActive(true);
      setTradesCompleted(0);

      const intervalMs = parseFloat(intervalHours) * 60 * 60 * 1000;

      await executeTrade();

      if (totalTradesNum > 1) {
        setNextTradeAt(Date.now() + intervalMs);
        intervalRef.current = setInterval(async () => {
          await executeTrade();
          setNextTradeAt(Date.now() + intervalMs);
        }, intervalMs);
      }

      onStatusChange({
        isActive: true,
        config: {
          totalAmount: parseFloat(totalAmount),
          intervalMs,
          numTrades: totalTradesNum,
          slippageBps: parseInt(slippageBps, 10),
          tokenIn: TOKENS.USDC,
          tokenOut: TOKENS.MOVE,
        },
        tradesCompleted: 0,
        totalTrades: totalTradesNum,
        nextTradeAt: totalTradesNum > 1 ? Date.now() + intervalMs : null,
        startedAt: Date.now(),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start TWAP");
      setIsActive(false);
    } finally {
      setLoading(false);
    }
  };

  const handleStop = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    setIsActive(false);
    setNextTradeAt(null);

    onStatusChange({
      isActive: false,
      config: null,
      tradesCompleted,
      totalTrades: 0,
      nextTradeAt: null,
      startedAt: null,
    });
  };

  useEffect(() => {
    if (isActive && tradesCompleted >= totalTradesNum && totalTradesNum > 0) {
      handleStop();
    }
  }, [tradesCompleted, totalTradesNum, isActive]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return (
    <div className="glass rounded-xl p-6">
      <h2 className="text-lg font-semibold text-gradient mb-4">
        TWAP Configuration
      </h2>

      {/* API Key Configuration */}
      {!isApiKeySet && (
        <div className="mb-6 glass-subtle rounded-xl p-4 border border-movement-yellow/20">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-5 h-5 text-movement-yellow" />
            <span className="font-medium text-movement-yellow">Mosaic API Key Required</span>
          </div>
          <p className="text-white/60 text-sm mb-3">
            Enter your Mosaic API key to enable swaps. Get one from{" "}
            <a
              href="https://docs.mosaic.ag/swap-integration/api"
              target="_blank"
              rel="noopener noreferrer"
              className="text-movement-yellow hover:underline inline-flex items-center gap-1"
            >
              Mosaic <ExternalLink className="w-3 h-3" />
            </a>
          </p>
          <div className="flex gap-2">
            <input
              type="password"
              value={apiKeyInput}
              onChange={(e) => setApiKeyInput(e.target.value)}
              placeholder="Enter API key..."
              className="flex-1 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50"
            />
            <button
              onClick={handleSetApiKey}
              className="px-4 py-2 rounded-lg bg-movement-yellow text-black font-medium hover:bg-movement-yellow-light transition-colors"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {isApiKeySet && !isActive && (
        <div className="mb-4 flex items-center justify-between text-sm">
          <span className="text-emerald-400 flex items-center gap-2">
            <div className="w-2 h-2 bg-emerald-400 rounded-full"></div>
            Mosaic API configured
          </span>
          <button
            onClick={handleClearApiKey}
            className="text-white/50 hover:text-white/70 text-xs"
          >
            Clear API Key
          </button>
        </div>
      )}

      {isActive ? (
        <div className="space-y-4">
          <div className="glass-subtle rounded-xl p-4 border border-movement-yellow/20">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2.5 h-2.5 bg-movement-yellow rounded-full animate-pulse"></div>
              <span className="font-semibold text-movement-yellow">
                TWAP Active
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-white/50">Progress</p>
                <p className="font-medium text-white">
                  {tradesCompleted} / {totalTradesNum} trades
                </p>
              </div>
              <div>
                <p className="text-white/50">Amount per Trade</p>
                <p className="font-medium text-white">
                  {amountPerTrade.toFixed(2)} USDC
                </p>
              </div>
              {nextTradeAt && (
                <div className="col-span-2">
                  <p className="text-white/50">Next Trade</p>
                  <p className="font-medium text-white">
                    {new Date(nextTradeAt).toLocaleTimeString()}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
            <div
              className="bg-movement-yellow h-2 rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <button
            onClick={handleStop}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 bg-red-500/20 text-red-400 border border-red-500/30 hover:bg-red-500/30"
          >
            <Square className="w-4 h-4" />
            Stop TWAP
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              Total Amount (USDC)
            </label>
            <input
              type="number"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
              placeholder="1000"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="0"
              step="100"
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
              placeholder="10"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="1"
              step="1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/70 mb-1.5">
              <Clock className="w-4 h-4 inline mr-1" />
              Interval (hours)
            </label>
            <input
              type="number"
              value={intervalHours}
              onChange={(e) => setIntervalHours(e.target.value)}
              placeholder="1"
              className="w-full px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:border-movement-yellow/50 focus:ring-2 focus:ring-movement-yellow/10 transition-all"
              min="0.01"
              step="0.5"
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
              placeholder="50"
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
                {(
                  parseFloat(intervalHours) * parseInt(numTrades, 10)
                ).toFixed(1)}{" "}
                hours
              </span>
            </p>
          </div>

          <button
            onClick={handleStart}
            disabled={loading || !connected || !isApiKeySet}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-semibold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed bg-movement-yellow text-black hover:bg-movement-yellow-light hover:shadow-lg hover:shadow-movement-yellow/30"
          >
            <Play className="w-4 h-4" />
            {loading ? "Starting..." : "Start TWAP"}
          </button>

          {!connected && (
            <p className="text-movement-yellow/70 text-sm text-center">
              Connect your wallet to start TWAP
            </p>
          )}
        </div>
      )}

      {error && (
        <div className="mt-4 glass-subtle border border-red-500/30 rounded-lg p-3">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}
    </div>
  );
}
