// Service for fetching $MOVE token market data from various sources

import { TokenMarketData, APIResponse } from "@/types";

const COINGECKO_API = "https://api.coingecko.com/api/v3";
const CMC_API = "https://pro-api.coinmarketcap.com/v2";

// CoinGecko uses "movement-evm" as the ID for MOVE token
const COINGECKO_TOKEN_ID = "movement";

/**
 * Fetches token data from CoinGecko (free, no API key required)
 */
async function fetchFromCoinGecko(): Promise<TokenMarketData | null> {
  try {
    const response = await fetch(
      `${COINGECKO_API}/coins/${COINGECKO_TOKEN_ID}?localization=false&tickers=false&community_data=false&developer_data=false`,
      {
        headers: {
          Accept: "application/json",
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = await response.json();

    return {
      symbol: data.symbol?.toUpperCase() || "MOVE",
      name: data.name || "Movement",
      price: data.market_data?.current_price?.usd || 0,
      priceChange24h: data.market_data?.price_change_24h || 0,
      priceChangePercentage24h: data.market_data?.price_change_percentage_24h || 0,
      marketCap: data.market_data?.market_cap?.usd || 0,
      marketCapRank: data.market_cap_rank,
      volume24h: data.market_data?.total_volume?.usd || 0,
      circulatingSupply: data.market_data?.circulating_supply || 0,
      totalSupply: data.market_data?.total_supply,
      maxSupply: data.market_data?.max_supply,
      logoUrl: data.image?.large || data.image?.small,
      lastUpdated: new Date(data.last_updated),
    };
  } catch (error) {
    console.error("Error fetching from CoinGecko:", error);
    return null;
  }
}

/**
 * Fetches token data from CoinMarketCap (requires API key)
 */
async function fetchFromCoinMarketCap(): Promise<TokenMarketData | null> {
  const apiKey = process.env.COINMARKETCAP_API_KEY;

  if (!apiKey) {
    console.warn("CoinMarketCap API key not configured");
    return null;
  }

  try {
    // MOVE token slug on CoinMarketCap
    const response = await fetch(
      `${CMC_API}/cryptocurrency/quotes/latest?slug=movement`,
      {
        headers: {
          Accept: "application/json",
          "X-CMC_PRO_API_KEY": apiKey,
        },
        next: { revalidate: 60 }, // Cache for 60 seconds
      }
    );

    if (!response.ok) {
      throw new Error(`CoinMarketCap API error: ${response.status}`);
    }

    const result = await response.json();
    const data = Object.values(result.data)[0] as any;

    if (!data) {
      throw new Error("No data returned from CoinMarketCap");
    }

    const quote = data.quote?.USD;

    return {
      symbol: data.symbol || "MOVE",
      name: data.name || "Movement",
      price: quote?.price || 0,
      priceChange24h: quote?.price_change_24h || 0,
      priceChangePercentage24h: quote?.percent_change_24h || 0,
      marketCap: quote?.market_cap || 0,
      marketCapRank: data.cmc_rank,
      volume24h: quote?.volume_24h || 0,
      circulatingSupply: data.circulating_supply || 0,
      totalSupply: data.total_supply,
      maxSupply: data.max_supply,
      logoUrl: `https://s2.coinmarketcap.com/static/img/coins/64x64/${data.id}.png`,
      lastUpdated: new Date(quote?.last_updated || Date.now()),
    };
  } catch (error) {
    console.error("Error fetching from CoinMarketCap:", error);
    return null;
  }
}

/**
 * Fetches token market data from available sources
 * Tries CoinMarketCap first (if API key available), falls back to CoinGecko
 */
export async function fetchTokenData(): Promise<APIResponse<TokenMarketData>> {
  try {
    // Try CoinMarketCap first if API key is available
    if (process.env.COINMARKETCAP_API_KEY) {
      const cmcData = await fetchFromCoinMarketCap();
      if (cmcData) {
        return {
          data: cmcData,
          timestamp: Date.now(),
        };
      }
    }

    // Fall back to CoinGecko
    const cgData = await fetchFromCoinGecko();
    if (cgData) {
      return {
        data: cgData,
        timestamp: Date.now(),
      };
    }

    throw new Error("Failed to fetch from all sources");
  } catch (error) {
    console.error("Error fetching token data:", error);
    return {
      data: {
        symbol: "MOVE",
        name: "Movement",
        price: 0,
        priceChange24h: 0,
        priceChangePercentage24h: 0,
        marketCap: 0,
        volume24h: 0,
        circulatingSupply: 0,
        lastUpdated: new Date(),
      },
      error: error instanceof Error ? error.message : "Failed to fetch token data",
      timestamp: Date.now(),
    };
  }
}

/**
 * Format price with appropriate decimal places
 */
export function formatPrice(price: number): string {
  if (price === 0) return "$0.00";
  if (price < 0.01) return `$${price.toFixed(6)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

/**
 * Format market cap with K, M, B suffixes
 */
export function formatMarketCap(value: number): string {
  if (value === 0) return "$0";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return `$${value.toFixed(2)}`;
}

/**
 * Format percentage change with color
 */
export function formatPercentageChange(change: number): {
  text: string;
  color: "green" | "red" | "gray";
} {
  if (change === 0) return { text: "0.00%", color: "gray" };
  const text = `${change > 0 ? "+" : ""}${change.toFixed(2)}%`;
  const color = change > 0 ? "green" : "red";
  return { text, color };
}
