/**
 * Mosaic DEX Aggregator API Client
 * https://docs.mosaic.ag/swap-integration/api
 */

// Movement Mainnet token addresses
export const TOKENS = {
  MOVE: "0x1::aptos_coin::AptosCoin",
  USDC: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b::usdc::USDC",
} as const;

// Token decimals
export const TOKEN_DECIMALS = {
  MOVE: 8,
  USDC: 6,
} as const;

export interface MosaicQuoteParams {
  srcAsset: string;
  dstAsset: string;
  amount: string; // Raw amount (in smallest units)
  sender?: string;
  receiver?: string;
  slippage?: number; // In basis points (100 = 1%)
  isFeeIn?: boolean;
  feeInBps?: number;
  feeReceiver?: string;
}

export interface MosaicQuoteResponse {
  code: number;
  message: string;
  requestId: string;
  data: {
    srcAsset: string;
    dstAsset: string;
    srcAmount: number;
    dstAmount: number;
    feeAmount: number;
    isFeeIn: boolean;
    paths: Array<{
      source: string;
      srcAsset: string;
      dstAsset: string;
      srcAmount: number;
      dstAmount: number;
    }>;
    tx: {
      function: string;
      typeArguments: string[];
      functionArguments: (string | string[] | boolean | number)[];
    };
  };
}

export interface MosaicToken {
  id: string;
  decimals: number;
  name: string;
  symbol: string;
}

const MOSAIC_API_URL = "https://api.mosaic.ag/v1";

// API key should be stored securely - this will be passed from environment
let mosaicApiKey: string | null = null;

export function setMosaicApiKey(key: string) {
  mosaicApiKey = key;
}

export function getMosaicApiKey(): string | null {
  return mosaicApiKey;
}

/**
 * Get swap quote from Mosaic API
 */
export async function getQuote(params: MosaicQuoteParams): Promise<MosaicQuoteResponse> {
  if (!mosaicApiKey) {
    throw new Error("Mosaic API key not configured");
  }

  const url = new URL(`${MOSAIC_API_URL}/quote`);
  url.searchParams.set("srcAsset", params.srcAsset);
  url.searchParams.set("dstAsset", params.dstAsset);
  url.searchParams.set("amount", params.amount);
  
  if (params.sender) {
    url.searchParams.set("sender", params.sender);
  }
  if (params.receiver) {
    url.searchParams.set("receiver", params.receiver);
  }
  if (params.slippage !== undefined) {
    url.searchParams.set("slippage", params.slippage.toString());
  }
  if (params.isFeeIn !== undefined) {
    url.searchParams.set("isFeeIn", params.isFeeIn.toString());
  }
  if (params.feeInBps !== undefined) {
    url.searchParams.set("feeInBps", params.feeInBps.toString());
  }
  if (params.feeReceiver) {
    url.searchParams.set("feeReceiver", params.feeReceiver);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-API-Key": mosaicApiKey,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Mosaic API error: ${response.status} - ${errorText}`);
  }

  const data: MosaicQuoteResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`Mosaic API error: ${data.message}`);
  }

  return data;
}

/**
 * Get list of supported tokens
 */
export async function getTokens(): Promise<Record<string, MosaicToken>> {
  if (!mosaicApiKey) {
    // Return default tokens if API key not configured
    return {
      [TOKENS.MOVE]: { id: TOKENS.MOVE, decimals: 8, name: "Movement", symbol: "MOVE" },
      [TOKENS.USDC]: { id: TOKENS.USDC, decimals: 6, name: "USD Coin", symbol: "USDC" },
    };
  }

  const response = await fetch(`${MOSAIC_API_URL}/tokens`, {
    method: "GET",
    headers: {
      "X-API-Key": mosaicApiKey,
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch tokens: ${response.status}`);
  }

  const data = await response.json();
  return data.tokenById || {};
}

/**
 * Convert human-readable amount to raw amount (smallest units)
 */
export function toRawAmount(amount: number, decimals: number): string {
  return Math.floor(amount * Math.pow(10, decimals)).toString();
}

/**
 * Convert raw amount to human-readable amount
 */
export function fromRawAmount(rawAmount: number | string, decimals: number): number {
  const raw = typeof rawAmount === "string" ? parseInt(rawAmount, 10) : rawAmount;
  return raw / Math.pow(10, decimals);
}

/**
 * Format a swap quote for display
 */
export function formatQuote(quote: MosaicQuoteResponse, srcDecimals: number, dstDecimals: number) {
  const srcAmount = fromRawAmount(quote.data.srcAmount, srcDecimals);
  const dstAmount = fromRawAmount(quote.data.dstAmount, dstDecimals);
  const rate = dstAmount / srcAmount;
  
  return {
    srcAmount,
    dstAmount,
    rate,
    paths: quote.data.paths.map(p => p.source),
    tx: quote.data.tx,
  };
}
