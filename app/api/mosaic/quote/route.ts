import { NextRequest, NextResponse } from "next/server";

const MOSAIC_API_URL = "https://api.mosaic.ag/v1";
const MOSAIC_API_KEY = process.env.MOSAIC_API_KEY;

export async function GET(request: NextRequest) {
  if (!MOSAIC_API_KEY) {
    return NextResponse.json(
      { error: "Mosaic API not configured" },
      { status: 500 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  
  // Forward all query parameters to Mosaic
  const url = new URL(`${MOSAIC_API_URL}/quote`);
  searchParams.forEach((value, key) => {
    url.searchParams.set(key, value);
  });

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
