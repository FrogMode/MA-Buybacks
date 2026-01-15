import { NextRequest, NextResponse } from "next/server";
import {
  fetchBuybackEvents,
  fetchBuybackStatistics,
  fetchBuybackChartData,
  fetch24hStats,
} from "@/lib/sentio";

const SENTIO_API_KEY = process.env.SENTIO_API_KEY;
const SENTIO_PROJECT_ID = process.env.SENTIO_PROJECT_ID || "ma-buyback-indexer";

export async function GET(request: NextRequest) {
  if (!SENTIO_API_KEY) {
    return NextResponse.json(
      { error: "Sentio API not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "transactions";

  try {
    switch (type) {
      case "stats": {
        const [stats, stats24h] = await Promise.all([
          fetchBuybackStatistics(SENTIO_API_KEY, SENTIO_PROJECT_ID),
          fetch24hStats(SENTIO_API_KEY, SENTIO_PROJECT_ID),
        ]);

        return NextResponse.json({
          totalBuybacksUSD: stats.totalUsdcSpent,
          totalTokens: stats.totalMoveReceived,
          transactionCount: stats.transactionCount,
          averagePrice: stats.averagePrice,
          lastBuyback: stats.lastBuyback,
          change24h: {
            usdcAmount: stats24h.usdcAmount,
            moveAmount: stats24h.moveAmount,
            count: stats24h.count,
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to fetch data" },
      { status: 500 }
    );
  }
}
