import { NextRequest, NextResponse } from "next/server";

const MOSAIC_API_URL = "https://api.mosaic.ag/v1";
const MOSAIC_API_KEY = process.env.MOSAIC_API_KEY;

// SECURITY: Only allow these parameters to be forwarded to Mosaic
// Prevents attackers from injecting arbitrary parameters
const ALLOWED_PARAMS = new Set([
  "srcAsset",
  "dstAsset", 
  "amount",
  "sender",
  "slippage",
  "recipient",
]);

// Rate limiting (simple in-memory)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const RATE_LIMIT_MAX_REQUESTS = 30; // 30 requests per minute

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const record = rateLimitMap.get(ip);
  
  if (!record || now > record.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  record.count++;
  return record.count > RATE_LIMIT_MAX_REQUESTS;
}

function getClientIP(request: NextRequest): string {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || 
         request.headers.get("x-real-ip") || 
         "unknown";
}

export async function GET(request: NextRequest) {
  // SECURITY: Rate limiting
  const clientIP = getClientIP(request);
  if (isRateLimited(clientIP)) {
    console.warn(`[MOSAIC] Rate limited: ${clientIP}`);
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      { status: 429 }
    );
  }

  if (!MOSAIC_API_KEY) {
    return NextResponse.json(
      { error: "Mosaic API not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  
  // SECURITY: Only forward allowed parameters
  const url = new URL(`${MOSAIC_API_URL}/quote`);
  let hasRequiredParams = false;
  
  searchParams.forEach((value, key) => {
    if (ALLOWED_PARAMS.has(key)) {
      url.searchParams.set(key, value);
      if (key === "srcAsset" || key === "dstAsset" || key === "amount") {
        hasRequiredParams = true;
      }
    } else {
      console.warn(`[MOSAIC] Blocked disallowed param: ${key}`);
    }
  });

  // Validate required params are present
  if (!searchParams.has("srcAsset") || !searchParams.has("dstAsset") || !searchParams.has("amount")) {
    return NextResponse.json(
      { error: "Missing required parameters: srcAsset, dstAsset, amount" },
      { status: 400 }
    );
  }

  // SECURITY: Validate parameter formats
  const amount = searchParams.get("amount");
  if (amount && !/^\d+$/.test(amount)) {
    return NextResponse.json(
      { error: "Invalid amount format" },
      { status: 400 }
    );
  }

  const srcAsset = searchParams.get("srcAsset");
  const dstAsset = searchParams.get("dstAsset");
  if ((srcAsset && !/^0x[a-fA-F0-9]+$/.test(srcAsset)) ||
      (dstAsset && !/^0x[a-fA-F0-9]+$/.test(dstAsset))) {
    return NextResponse.json(
      { error: "Invalid asset address format" },
      { status: 400 }
    );
  }

  try {
    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-API-Key": MOSAIC_API_KEY,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Mosaic API error:", response.status, errorText);
      return NextResponse.json(
        { error: `Mosaic API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch quote from Mosaic:", error);
    return NextResponse.json(
      { error: "Failed to fetch quote" },
      { status: 500 }
    );
  }
}
