// Types for API integration

export interface BuybackTransaction {
  hash: string;
  timestamp: Date;
  tokens: number;
  value: number;
  price: number;
  status: "confirmed" | "pending";
  wallet?: string; // Source wallet address
  source?: "manual" | "twap"; // Buyback source type
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

export interface TokenMarketData {
  symbol: string;
  name: string;
  price: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  marketCap: number;
  marketCapRank?: number;
  volume24h: number;
  circulatingSupply: number;
  totalSupply?: number;
  maxSupply?: number;
  logoUrl?: string;
  lastUpdated: Date;
}
