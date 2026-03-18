// API service for fetching buyback data from Sentio indexer

import { BuybackStats, BuybackTransaction, ChartDataPoint, APIResponse } from "@/types";

/**
 * Fetch buyback statistics from Sentio
 */
export async function fetchBuybackStats(): Promise<APIResponse<BuybackStats>> {
  try {
    const response = await fetch("/api/sentio/buybacks?type=stats");
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Calculate percentage changes (comparing 24h to previous period)
    // SECURITY FIX: Handle divide-by-zero when all activity is in last 24h
    const safePercentChange = (current: number, total: number): number => {
      const previous = total - current;
      if (previous <= 0) {
        // All activity in current period - show 100% if there's activity, 0 otherwise
        return current > 0 ? 100 : 0;
      }
      const change = (current / previous) * 100;
      // Cap at reasonable values and handle Infinity/NaN
      if (!isFinite(change)) return current > 0 ? 100 : 0;
      return Math.min(Math.max(change, -100), 1000); // Cap between -100% and 1000%
    };

    const percentageChange24h = {
      buybacks: safePercentChange(data.change24h?.usdcAmount || 0, data.totalBuybacksUSD || 0),
      tokens: safePercentChange(data.change24h?.moveAmount || 0, data.totalTokens || 0),
      transactions: safePercentChange(data.change24h?.count || 0, data.transactionCount || 0),
    };

    // Handle lastBuyback - it can be an object with timestamp or null
    let lastBuybackTime: Date;
    let lastBuybackAmount = 0;
    
    if (data.lastBuyback && data.lastBuyback.timestamp) {
      // timestamp is in seconds, convert to milliseconds
      lastBuybackTime = new Date(data.lastBuyback.timestamp * 1000);
      lastBuybackAmount = data.lastBuyback.moveAmount || 0;
    } else {
      // No buybacks yet - set to a far past date so "NaN" doesn't show
      lastBuybackTime = new Date(0);
      lastBuybackAmount = 0;
    }

    return {
      data: {
        totalBuybacksUSD: data.totalBuybacksUSD || 0,
        totalTokens: data.totalTokens || 0,
        transactionCount: data.transactionCount || 0,
        lastBuybackTime,
        lastBuybackAmount,
        percentageChange24h,
      },
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to fetch buyback stats:", error);
    return {
      data: {
        totalBuybacksUSD: 0,
        totalTokens: 0,
        transactionCount: 0,
        lastBuybackTime: new Date(),
        lastBuybackAmount: 0,
        percentageChange24h: {
          buybacks: 0,
          tokens: 0,
          transactions: 0,
        },
      },
      error: error instanceof Error ? error.message : "Failed to fetch stats",
      timestamp: Date.now(),
    };
  }
}

/**
 * Fetch chart data from Sentio
 */
export async function fetchChartData(
  timeframe: "24h" | "7d" | "30d" | "all" = "7d"
): Promise<APIResponse<ChartDataPoint[]>> {
  try {
    const response = await fetch(`/api/sentio/buybacks?type=chart&timeframe=${timeframe}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      data: (data.data || []).map((point: any) => ({
        date: point.date,
        amount: point.amount || 0,
        value: point.value || 0,
      })),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to fetch chart data:", error);
    return {
      data: [],
      error: error instanceof Error ? error.message : "Failed to fetch chart data",
      timestamp: Date.now(),
    };
  }
}

/**
 * Fetch transactions from Sentio
 */
export async function fetchTransactions(
  page: number = 1,
  limit: number = 10
): Promise<APIResponse<BuybackTransaction[]>> {
  try {
    const response = await fetch(`/api/sentio/buybacks?type=transactions&page=${page}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      data: (data.transactions || []).map((tx: any) => ({
        hash: tx.hash,
        timestamp: new Date(tx.timestamp),
        tokens: tx.tokens || 0,
        value: tx.value || 0,
        price: tx.price || 0,
        status: tx.status || "confirmed",
        wallet: tx.wallet,
        source: tx.source || "manual",
      })),
      timestamp: Date.now(),
    };
  } catch (error) {
    console.error("Failed to fetch transactions:", error);
    return {
      data: [],
      error: error instanceof Error ? error.message : "Failed to fetch transactions",
      timestamp: Date.now(),
    };
  }
}

/**
 * Subscribe to real-time updates (placeholder for future WebSocket implementation)
 */
export async function subscribeToUpdates(callback: (data: any) => void) {
  // TODO: Implement WebSocket or SSE connection for real-time updates
  // Sentio supports webhooks that could be used for this
  // For now, we'll use polling in the components
  return () => {};
}
