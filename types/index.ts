// Types for API integration

export interface BuybackTransaction {
  hash: string;
  timestamp: Date;
  tokens: number;
  value: number;
  price: number;
  status: "confirmed" | "pending";
}

export interface BuybackStats {
  totalBuybacksUSD: number;
  totalTokens: number;
  transactionCount: number;
  lastBuybackTime: Date;
  lastBuybackAmount: number;
  percentageChange24h: {
    buybacks: number;
    tokens: number;
    transactions: number;
  };
}

export interface ChartDataPoint {
  date: string;
  amount: number;
  value: number;
}

export interface APIResponse<T> {
  data: T;
  error?: string;
  timestamp: number;
}
