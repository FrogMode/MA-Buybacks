/**
 * Sentio API Client
 * Fetches indexed buyback data from Sentio's GraphQL/SQL API
 */

const SENTIO_API_URL = "https://app.sentio.xyz/api/v1";

export interface BuybackEvent {
  txHash: string;
  wallet: string;
  timestamp: number;
  usdcAmount: number;
  moveAmount: number;
  pricePerMove: number;
  version: string;
  success: boolean;
}

export interface BuybackStats {
  totalUsdcSpent: number;
  totalMoveReceived: number;
  transactionCount: number;
  averagePrice: number;
  lastBuyback: BuybackEvent | null;
}

export interface SentioQueryResponse<T> {
  result: {
    rows: T[];
  };
}

/**
 * Execute a SQL query against Sentio's API
 */
export async function querySentio<T>(
  sql: string,
  apiKey: string,
  projectId: string
): Promise<T[]> {
  const response = await fetch(
    `${SENTIO_API_URL}/analytics/${projectId}/sql/execute`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        sqlQuery: {
          sql,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Sentio API error:", response.status, errorText);
    throw new Error(`Sentio API error: ${response.status}`);
  }

  const data: SentioQueryResponse<T> = await response.json();
  return data.result?.rows || [];
}

/**
 * Fetch recent buyback events
 */
export async function fetchBuybackEvents(
  apiKey: string,
  projectId: string,
  limit: number = 50,
  offset: number = 0
): Promise<BuybackEvent[]> {
  const sql = `
    SELECT 
      txHash,
      wallet,
      timestamp,
      usdcAmount,
      moveAmount,
      pricePerMove,
      version,
      success
    FROM buyback
    ORDER BY timestamp DESC
    LIMIT ${limit}
    OFFSET ${offset}
  `;

  return querySentio<BuybackEvent>(sql, apiKey, projectId);
}

/**
 * Fetch aggregated buyback statistics
 */
export async function fetchBuybackStatistics(
  apiKey: string,
  projectId: string
): Promise<BuybackStats> {
  const sql = `
    SELECT 
      SUM(usdcAmount) as totalUsdcSpent,
      SUM(moveAmount) as totalMoveReceived,
      COUNT(*) as transactionCount,
      AVG(pricePerMove) as averagePrice
    FROM buyback
    WHERE success = true
  `;

  const rows = await querySentio<{
    totalUsdcSpent: number;
    totalMoveReceived: number;
    transactionCount: number;
    averagePrice: number;
  }>(sql, apiKey, projectId);

  const stats = rows[0] || {
    totalUsdcSpent: 0,
    totalMoveReceived: 0,
    transactionCount: 0,
    averagePrice: 0,
  };

  // Get the last buyback
  const lastBuybackRows = await fetchBuybackEvents(apiKey, projectId, 1, 0);
  const lastBuyback = lastBuybackRows[0] || null;

  return {
    ...stats,
    lastBuyback,
  };
}

/**
 * Fetch buyback data for charts (time series)
 */
export async function fetchBuybackChartData(
  apiKey: string,
  projectId: string,
  timeframe: "24h" | "7d" | "30d" | "all" = "7d"
): Promise<{ date: string; usdcAmount: number; moveAmount: number; count: number }[]> {
  // Calculate the start timestamp based on timeframe
  const now = Date.now() / 1000;
  let startTimestamp: number;
  let groupBy: string;

  switch (timeframe) {
    case "24h":
      startTimestamp = now - 24 * 60 * 60;
      groupBy = "hour";
      break;
    case "7d":
      startTimestamp = now - 7 * 24 * 60 * 60;
      groupBy = "day";
      break;
    case "30d":
      startTimestamp = now - 30 * 24 * 60 * 60;
      groupBy = "day";
      break;
    case "all":
    default:
      startTimestamp = 0;
      groupBy = "day";
      break;
  }

  const sql = `
    SELECT 
      DATE_TRUNC('${groupBy}', FROM_UNIXTIME(timestamp)) as date,
      SUM(usdcAmount) as usdcAmount,
      SUM(moveAmount) as moveAmount,
      COUNT(*) as count
    FROM buyback
    WHERE timestamp >= ${startTimestamp} AND success = true
    GROUP BY DATE_TRUNC('${groupBy}', FROM_UNIXTIME(timestamp))
    ORDER BY date ASC
  `;

  return querySentio<{
    date: string;
    usdcAmount: number;
    moveAmount: number;
    count: number;
  }>(sql, apiKey, projectId);
}

/**
 * Fetch 24h statistics for percentage changes
 */
export async function fetch24hStats(
  apiKey: string,
  projectId: string
): Promise<{ usdcAmount: number; moveAmount: number; count: number }> {
  const oneDayAgo = Date.now() / 1000 - 24 * 60 * 60;
  
  const sql = `
    SELECT 
      SUM(usdcAmount) as usdcAmount,
      SUM(moveAmount) as moveAmount,
      COUNT(*) as count
    FROM buyback
    WHERE timestamp >= ${oneDayAgo} AND success = true
  `;

  const rows = await querySentio<{
    usdcAmount: number;
    moveAmount: number;
    count: number;
  }>(sql, apiKey, projectId);

  return rows[0] || { usdcAmount: 0, moveAmount: 0, count: 0 };
}
