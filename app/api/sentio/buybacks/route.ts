import { NextRequest, NextResponse } from "next/server";
import {
  fetchBuybackEvents,
  fetchBuybackStatistics,
  fetchBuybackChartData,
  fetch24hStats,
} from "@/lib/sentio";

const SENTIO_API_KEY = process.env.SENTIO_API_KEY;
const SENTIO_PROJECT_ID = process.env.SENTIO_PROJECT_ID || "ma_buybacks";

// TWAP Bot executor wallet address
const TWAP_EXECUTOR_WALLET = "0x28b57594e3c48fd4303887482a0667127fc761a20f5c3bd9401c5841904e322a";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "transactions";

  // If Sentio is not configured, return empty/default data
  if (!SENTIO_API_KEY) {
    console.warn("Sentio API not configured - returning placeholder data");
    return getPlaceholderResponse(type);
  }

  try {
    switch (type) {
      case "stats": {
        const [stats, stats24h] = await Promise.all([
          fetchBuybackStatistics(SENTIO_API_KEY, SENTIO_PROJECT_ID),
          fetch24hStats(SENTIO_API_KEY, SENTIO_PROJECT_ID),
        ]);

        return NextResponse.json({
          totalBuybacksUSD: stats.totalUsdcSpent || 0,
          totalTokens: stats.totalMoveReceived || 0,
          transactionCount: stats.transactionCount || 0,
          averagePrice: stats.averagePrice || 0,
          lastBuyback: stats.lastBuyback,
          change24h: {
            usdcAmount: stats24h.usdcAmount || 0,
            moveAmount: stats24h.moveAmount || 0,
            count: stats24h.count || 0,
          },
        });
      }

      case "transactions": {
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const offset = (page - 1) * limit;

        const transactions = await fetchBuybackEvents(
          SENTIO_API_KEY,
          SENTIO_PROJECT_ID,
          limit,
          offset
        );

        return NextResponse.json({
          transactions: transactions.map((tx) => ({
            hash: tx.txHash,
            timestamp: new Date(tx.timestamp * 1000).toISOString(),
            tokens: tx.moveAmount,
            value: tx.usdcAmount,
            price: tx.pricePerMove,
            status: tx.success ? "confirmed" : "failed",
            wallet: tx.wallet,
            source: tx.wallet?.toLowerCase() === TWAP_EXECUTOR_WALLET.toLowerCase() ? "twap" : "manual",
          })),
          page,
          limit,
        });
      }

      case "chart": {
        const timeframe = (searchParams.get("timeframe") || "7d") as
          | "24h"
          | "7d"
          | "30d"
          | "all";

        const chartData = await fetchBuybackChartData(
          SENTIO_API_KEY,
          SENTIO_PROJECT_ID,
          timeframe
        );

        return NextResponse.json({
          data: chartData.map((point) => ({
            date: point.date,
            amount: point.moveAmount,
            value: point.usdcAmount,
            count: point.count,
          })),
          timeframe,
        });
      }

      default:
        return NextResponse.json(
          { error: "Invalid type parameter" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Sentio API error:", error);
    // Return placeholder data on error instead of failing
    return getPlaceholderResponse(type);
  }
}

/**
 * Return placeholder/empty data when Sentio is unavailable
 * This prevents the UI from breaking
 */
function getPlaceholderResponse(type: string) {
  switch (type) {
    case "stats":
      return NextResponse.json({
        totalBuybacksUSD: 0,
        totalTokens: 0,
        transactionCount: 0,
        averagePrice: 0,
        lastBuyback: null,
        change24h: {
          usdcAmount: 0,
          moveAmount: 0,
          count: 0,
        },
        _placeholder: true,
        _message: "Indexer data not yet available. Deploy the Sentio processor to start tracking buybacks.",
      });

    case "transactions":
      return NextResponse.json({
        transactions: [],
        page: 1,
        limit: 10,
        _placeholder: true,
        _message: "No transactions indexed yet. Deploy the Sentio processor to start tracking.",
      });

    case "chart":
      return NextResponse.json({
        data: [],
        timeframe: "7d",
        _placeholder: true,
        _message: "Chart data not available. Deploy the Sentio processor to start tracking.",
      });

    default:
      return NextResponse.json({
        _placeholder: true,
        _message: "Data not available",
      });
  }
}
