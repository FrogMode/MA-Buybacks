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
    // For now, we'll show the 24h values as the change
    const percentageChange24h = {
      buybacks: data.change24h?.usdcAmount > 0 ? 
        ((data.change24h.usdcAmount / (data.totalBuybacksUSD - data.change24h.usdcAmount)) * 100) || 0 : 0,
      tokens: data.change24h?.moveAmount > 0 ?
        ((data.change24h.moveAmount / (data.totalTokens - data.change24h.moveAmount)) * 100) || 0 : 0,
      transactions: data.change24h?.count > 0 ?
        ((data.change24h.count / (data.transactionCount - data.change24h.count)) * 100) || 0 : 0,
    };

    return {
      data: {
        totalBuybacksUSD: data.totalBuybacksUSD || 0,
        totalTokens: data.totalTokens || 0,
        transactionCount: data.transactionCount || 0,
        lastBuybackTime: data.lastBuyback ? new Date(data.lastBuyback.timestamp * 1000) : new Date(),
        lastBuybackAmount: data.lastBuyback?.moveAmount || 0,
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
