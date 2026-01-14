"use client";

import { useState, useCallback } from "react";
import { TWAPConfig } from "./TWAPConfig";
import { BalanceDisplay } from "./BalanceDisplay";
import { TradeHistory } from "./TradeHistory";
import { StatusDisplay } from "./StatusDisplay";
import { WalletProvider } from "./WalletProvider";
import type { TokenBalances, TWAPStatus, TradeExecution } from "@/types/twap";

function TWAPContent() {
  const [, setBalances] = useState<TokenBalances | null>(null);
  const [, setTwapStatus] = useState<TWAPStatus | null>(null);
  const [trades, setTrades] = useState<TradeExecution[]>([]);

  const handleTradeExecuted = useCallback((trade: TradeExecution) => {
    setTrades((prev) => {
      const existing = prev.findIndex((t) => t.id === trade.id);
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = trade;
        return updated;
      }
      return [...prev, trade];
    });
  }, []);

  const handleStatusChange = useCallback((status: TWAPStatus) => {
    setTwapStatus(status);
  }, []);

  const handleBalanceUpdate = useCallback((newBalances: TokenBalances) => {
    setBalances(newBalances);
  }, []);

  return (
    <>
      <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-1 text-gradient">
            TWAP Buyback Bot
          </h1>
          <p className="text-white/50">
            Automated time-weighted average price execution for $MOVE buybacks
          </p>
        </div>
        <StatusDisplay />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <TWAPConfig
            onStatusChange={handleStatusChange}
            onTradeExecuted={handleTradeExecuted}
          />
        </div>

        <div className="space-y-6">
          <BalanceDisplay onBalanceUpdate={handleBalanceUpdate} />
          <TradeHistory trades={trades} onRefresh={setTrades} />
        </div>
      </div>
    </>
  );
}

export function TWAPClientContent() {
  return (
    <WalletProvider>
      <TWAPContent />
    </WalletProvider>
  );
}
