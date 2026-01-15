/**
 * Mosaic DEX Aggregator Client
 * Uses server-side API route to proxy requests (API key stored securely on server)
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

/**
 * Get swap quote via our API route (which handles the Mosaic API key server-side)
 */
export async function getQuote(params: MosaicQuoteParams): Promise<MosaicQuoteResponse> {
  const url = new URL("/api/mosaic/quote", window.location.origin);
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

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(errorData.error || `API error: ${response.status}`);
  }

  const data: MosaicQuoteResponse = await response.json();

  if (data.code !== 0) {
    throw new Error(`Mosaic error: ${data.message}`);
  }

  return data;
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
