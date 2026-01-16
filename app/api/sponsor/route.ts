import { NextRequest, NextResponse } from "next/server";
import { Aptos, AptosConfig, Network, AccountAuthenticator, Serializer, Deserializer, Hex } from "@aptos-labs/ts-sdk";
import { getGasStationClient, isGasStationConfigured, MOVEMENT_RPC } from "@/lib/shinami";

// Initialize Aptos client for Movement mainnet
const aptosConfig = new AptosConfig({
  network: Network.CUSTOM,
  fullnode: MOVEMENT_RPC,
});
const aptos = new Aptos(aptosConfig);

// Rate limiting for gas sponsorship (prevent abuse)
const sponsorRateLimitMap = new Map<string, { count: number; resetAt: number }>();
const SPONSOR_RATE_LIMIT_WINDOW_MS = 60000; // 1 minute
const SPONSOR_RATE_LIMIT_MAX = 5; // 5 sponsored transactions per minute per address

function isSponsorRateLimited(address: string): boolean {
  const now = Date.now();
  const key = address.toLowerCase();
  const record = sponsorRateLimitMap.get(key);
  
  if (!record || now > record.resetAt) {
    sponsorRateLimitMap.set(key, { count: 1, resetAt: now + SPONSOR_RATE_LIMIT_WINDOW_MS });
    return false;
  }
  
  record.count++;
  return record.count > SPONSOR_RATE_LIMIT_MAX;
}

// Allowed functions for sponsorship (whitelist)
const ALLOWED_SPONSOR_FUNCTIONS = [
  "0x1::primary_fungible_store::transfer",
  "0x1::aptos_account::transfer",
];

function isAllowedFunction(fn: string): boolean {
  return ALLOWED_SPONSOR_FUNCTIONS.some(allowed => fn.startsWith(allowed));
}

/**
 * POST /api/sponsor
 * 
 * Handles two actions:
 * 1. action=sponsor: Build and sponsor a transaction, return for user signing
 * 2. action=submit: Submit a fully signed sponsored transaction
 */
export async function POST(request: NextRequest) {
  if (!isGasStationConfigured()) {
    return NextResponse.json(
      { error: "Gas Station not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case "sponsor":
        return handleSponsor(body);
      case "submit":
        return handleSubmit(body);
      default:
        return NextResponse.json(
          { error: "Invalid action. Use 'sponsor' or 'submit'" },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error("Sponsor API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal error" },
      { status: 500 }
    );
  }
}

/**
 * Build a transaction with fee payer and get Shinami sponsorship
 */
async function handleSponsor(body: {
  senderAddress: string;
  txFunction: string;
  typeArguments: string[];
  functionArguments: any[];
}) {
  const { senderAddress, txFunction, typeArguments, functionArguments } = body;

  if (!senderAddress || !txFunction) {
    return NextResponse.json(
      { error: "Missing required fields: senderAddress, txFunction" },
      { status: 400 }
    );
  }

  // SECURITY: Validate address format
  if (!/^0x[a-fA-F0-9]{1,64}$/.test(senderAddress)) {
    return NextResponse.json(
      { error: "Invalid sender address format" },
      { status: 400 }
    );
  }

  // SECURITY: Rate limit per sender address
  if (isSponsorRateLimited(senderAddress)) {
    console.warn(`[SPONSOR] Rate limited: ${senderAddress}`);
    return NextResponse.json(
      { error: "Too many sponsorship requests. Please wait." },
      { status: 429 }
    );
  }

  // SECURITY: Only allow whitelisted functions
  if (!isAllowedFunction(txFunction)) {
    console.warn(`[SPONSOR] Blocked non-whitelisted function: ${txFunction} from ${senderAddress}`);
    return NextResponse.json(
      { error: "Function not allowed for sponsorship" },
      { status: 403 }
    );
  }

  try {
    // Build the transaction with fee payer support
    const transaction = await aptos.transaction.build.simple({
      sender: senderAddress,
      withFeePayer: true,
      data: {
        function: txFunction as `${string}::${string}::${string}`,
        typeArguments: typeArguments || [],
        functionArguments: functionArguments || [],
      },
    });

    // Get sponsorship from Shinami Gas Station
    // This updates transaction.feePayerAddress in-place and returns the fee payer signature
    const gasStationClient = getGasStationClient();
    const feePayerAuth = await gasStationClient.sponsorTransaction(transaction);

    // Serialize the transaction and fee payer signature for the frontend
    const serializer = new Serializer();
    transaction.rawTransaction.serialize(serializer);
    const rawTxBytes = Hex.fromHexInput(serializer.toUint8Array()).toString();

    // Serialize fee payer authenticator
    const feePayerSerializer = new Serializer();
    feePayerAuth.serialize(feePayerSerializer);
    const feePayerAuthBytes = Hex.fromHexInput(feePayerSerializer.toUint8Array()).toString();

    // Return the transaction and sponsorship data
    return NextResponse.json({
      success: true,
      rawTransaction: rawTxBytes,
      feePayerAddress: transaction.feePayerAddress?.toString() || "",
      feePayerAuthenticator: feePayerAuthBytes,
    });
  } catch (error) {
    console.error("Sponsorship error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sponsor transaction" },
      { status: 500 }
    );
  }
}

/**
 * Submit a fully signed sponsored transaction
 */
async function handleSubmit(body: {
  rawTransaction: string;
  senderAuthenticator: string;
  feePayerAddress: string;
  feePayerAuthenticator: string;
}) {
  const { rawTransaction, senderAuthenticator, feePayerAddress, feePayerAuthenticator } = body;

  if (!rawTransaction || !senderAuthenticator || !feePayerAuthenticator) {
    return NextResponse.json(
      { error: "Missing required fields: rawTransaction, senderAuthenticator, feePayerAuthenticator" },
      { status: 400 }
    );
  }

  try {
    // Deserialize the sender authenticator
    const senderAuthBytes = Hex.fromHexString(senderAuthenticator).toUint8Array();
    const senderAuthDeserializer = new Deserializer(senderAuthBytes);
    const senderAuth = AccountAuthenticator.deserialize(senderAuthDeserializer);

    // Deserialize the fee payer authenticator
    const feePayerAuthBytes = Hex.fromHexString(feePayerAuthenticator).toUint8Array();
    const feePayerAuthDeserializer = new Deserializer(feePayerAuthBytes);
    const feePayerAuth = AccountAuthenticator.deserialize(feePayerAuthDeserializer);

    // Build the transaction again to get the proper structure
    // This is needed because we can't easily deserialize the full SimpleTransaction
    const rawTxBytes = Hex.fromHexString(rawTransaction).toUint8Array();
    
    // Submit using the raw submission method
    const pendingTx = await aptos.transaction.submit.simple({
      transaction: {
        rawTransaction: rawTxBytes,
        feePayerAddress: feePayerAddress,
      } as any,
      senderAuthenticator: senderAuth,
      feePayerAuthenticator: feePayerAuth,
    });

    // Wait for transaction confirmation
    const committedTx = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    return NextResponse.json({
      success: true,
      hash: pendingTx.hash,
      status: committedTx.success ? "success" : "failed",
      vmStatus: committedTx.vm_status,
    });
  } catch (error) {
    console.error("Submit error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to submit transaction" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/sponsor
 * Check if gas station is configured and get status
 */
export async function GET() {
  return NextResponse.json({
    configured: isGasStationConfigured(),
    network: "movement_mainnet",
  });
}
