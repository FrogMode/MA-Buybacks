import { NextRequest, NextResponse } from "next/server";

const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";

// Tracked buyback wallet addresses
const BUYBACK_WALLETS = [
  // Manual buyback wallet
  "0x682330a16592406f9f4fd5b4822cbe01af2f227825b9711d166fcea5e0ca4838",
  // TWAP Bot executor wallet
  "0x28b57594e3c48fd4303887482a0667127fc761a20f5c3bd9401c5841904e322a",
];

// TWAP Bot executor wallet address
const TWAP_EXECUTOR_WALLET = "0x28b57594e3c48fd4303887482a0667127fc761a20f5c3bd9401c5841904e322a";

// Mosaic router address
const MOSAIC_ROUTER = "0x3f7399a0d3d646ce94ee0badf16c4c3f3c656fe3a5e142e83b5ebc011aa8b3d";

// USDC address
const USDC_ADDRESS = "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39";

// Token decimals
const TOKEN_DECIMALS = {
  MOVE: 8,
  USDC: 6,
};

interface SwapEventData {
  sender: string;
  receiver: string;
  input_asset: string;
  output_asset: string;
  input_amount: string;
  output_amount: string;
  timestamp: string;
  extra_data?: string;
}

interface Transaction {
  hash: string;
  version: string;
  success: boolean;
  timestamp: string;
  events: Array<{
    type: string;
    data: SwapEventData;
  }>;
}

/**
 * Fetch transactions from a wallet and filter for Mosaic swaps
 */
async function fetchWalletSwaps(walletAddress: string, limit: number = 50): Promise<Transaction[]> {
  try {
    const response = await fetch(
      `${MOVEMENT_RPC}/accounts/${walletAddress}/transactions?limit=${limit}`,
      { next: { revalidate: 60 } } // Cache for 60 seconds
    );

    if (!response.ok) {
      console.error(`Failed to fetch transactions for ${walletAddress}: ${response.status}`);
      return [];
    }

    const transactions = await response.json();
    
    // Filter for successful Mosaic router swap transactions
    return transactions.filter((tx: any) => {
      if (!tx.success) return false;
      if (!tx.payload?.function) return false;
      return tx.payload.function.includes(`${MOSAIC_ROUTER}::router::swap`);
    });
  } catch (error) {
    console.error(`Error fetching transactions for ${walletAddress}:`, error);
    return [];
  }
}

/**
 * Extract buyback data from a swap transaction
 */
function extractBuybackData(tx: Transaction): {
  txHash: string;
  wallet: string;
  timestamp: number;
  usdcAmount: number;
  moveAmount: number;
  pricePerMove: number;
  success: boolean;
} | null {
  // Find the SwapEvent
  const swapEvent = tx.events?.find((e) => 
    e.type.includes(`${MOSAIC_ROUTER}::router::SwapEvent`)
  );

  if (!swapEvent) return null;

  const eventData = swapEvent.data as SwapEventData;
  
  // Check if this is a USDC -> MOVE swap (buyback)
  const isUsdcToMove = 
    eventData.input_asset.toLowerCase() === USDC_ADDRESS.toLowerCase() &&
    eventData.output_asset.toLowerCase().includes("aptos_coin");

  if (!isUsdcToMove) return null;

  const usdcAmount = parseInt(eventData.input_amount, 10) / Math.pow(10, TOKEN_DECIMALS.USDC);
  const moveAmount = parseInt(eventData.output_amount, 10) / Math.pow(10, TOKEN_DECIMALS.MOVE);
  const pricePerMove = usdcAmount > 0 && moveAmount > 0 ? usdcAmount / moveAmount : 0;

  return {
    txHash: tx.hash,
    wallet: eventData.sender,
    timestamp: parseInt(eventData.timestamp, 10),
    usdcAmount,
    moveAmount,
    pricePerMove,
    success: tx.success,
  };
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const type = searchParams.get("type") || "transactions";

  try {
    // Fetch transactions from all tracked wallets
    const allTransactions = await Promise.all(
      BUYBACK_WALLETS.map((wallet) => fetchWalletSwaps(wallet, 100))
    );

    // Flatten and extract buyback data
    const buybacks = allTransactions
      .flat()
      .map(extractBuybackData)
      .filter((b): b is NonNullable<typeof b> => b !== null)
      .sort((a, b) => b.timestamp - a.timestamp); // Sort by timestamp descending

    switch (type) {
      case "stats": {
        const totalUsdcSpent = buybacks.reduce((sum, b) => sum + b.usdcAmount, 0);
        const totalMoveReceived = buybacks.reduce((sum, b) => sum + b.moveAmount, 0);
        const transactionCount = buybacks.length;
        const averagePrice = totalMoveReceived > 0 ? totalUsdcSpent / totalMoveReceived : 0;
        
        // Get the last buyback with full details
        const lastBuybackData = buybacks[0] || null;

        // Calculate 24h stats
        const now = Date.now() / 1000;
        const oneDayAgo = now - 24 * 60 * 60;
        const last24h = buybacks.filter((b) => b.timestamp > oneDayAgo);
        
        return NextResponse.json({
          totalBuybacksUSD: totalUsdcSpent,
          totalTokens: totalMoveReceived,
          transactionCount,
          averagePrice,
          // Return full lastBuyback object for proper time display
          lastBuyback: lastBuybackData ? {
            timestamp: lastBuybackData.timestamp,
            moveAmount: lastBuybackData.moveAmount,
            usdcAmount: lastBuybackData.usdcAmount,
            txHash: lastBuybackData.txHash,
          } : null,
          change24h: {
            usdcAmount: last24h.reduce((sum, b) => sum + b.usdcAmount, 0),
            moveAmount: last24h.reduce((sum, b) => sum + b.moveAmount, 0),
            count: last24h.length,
          },
        });
      }

      case "transactions": {
        const page = parseInt(searchParams.get("page") || "1", 10);
        const limit = parseInt(searchParams.get("limit") || "10", 10);
        const offset = (page - 1) * limit;

        const paginatedBuybacks = buybacks.slice(offset, offset + limit);

        return NextResponse.json({
          transactions: paginatedBuybacks.map((b) => ({
            hash: b.txHash,
            timestamp: new Date(b.timestamp * 1000).toISOString(),
            tokens: b.moveAmount,
            value: b.usdcAmount,
            price: b.pricePerMove,
            status: b.success ? "confirmed" : "failed",
            wallet: b.wallet,
            source: b.wallet?.toLowerCase() === TWAP_EXECUTOR_WALLET.toLowerCase() ? "twap" : "manual",
          })),
          page,
          limit,
          total: buybacks.length,
        });
      }

      case "chart": {
        const timeframe = (searchParams.get("timeframe") || "7d") as
          | "24h"
          | "7d"
          | "30d"
          | "all";

        // Calculate time range
        const now = Date.now() / 1000;
        let startTime: number;
        switch (timeframe) {
          case "24h":
            startTime = now - 24 * 60 * 60;
            break;
          case "7d":
            startTime = now - 7 * 24 * 60 * 60;
            break;
          case "30d":
            startTime = now - 30 * 24 * 60 * 60;
            break;
          case "all":
          default:
            startTime = 0;
        }

        // Filter buybacks by timeframe
        const filteredBuybacks = buybacks.filter((b) => b.timestamp > startTime);

        // Group by day
        const dailyData = new Map<string, { moveAmount: number; usdcAmount: number; count: number }>();
        
        for (const b of filteredBuybacks) {
          const date = new Date(b.timestamp * 1000).toISOString().split("T")[0];
          const existing = dailyData.get(date) || { moveAmount: 0, usdcAmount: 0, count: 0 };
          dailyData.set(date, {
            moveAmount: existing.moveAmount + b.moveAmount,
            usdcAmount: existing.usdcAmount + b.usdcAmount,
            count: existing.count + 1,
          });
        }

        // Convert to array and sort by date
        const chartData = Array.from(dailyData.entries())
          .map(([date, data]) => ({
            date,
            amount: data.moveAmount,
            value: data.usdcAmount,
            count: data.count,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        return NextResponse.json({
          data: chartData,
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
    console.error("Error fetching buyback data:", error);
    return NextResponse.json(
      { error: "Failed to fetch buyback data" },
      { status: 500 }
    );
  }
}
