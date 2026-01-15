import { NextRequest, NextResponse } from "next/server";
import { 
  Aptos, 
  AptosConfig, 
  Network,
} from "@aptos-labs/ts-sdk";
import { 
  getExecutorAccount, 
  isExecutorConfigured,
  getExecutorBalances,
  getAptosClient
} from "@/lib/executorWallet";
import { getGasStationClient, isGasStationConfigured } from "@/lib/shinami";

// Admin secret for authorization
const ADMIN_SECRET = process.env.ADMIN_SECRET || process.env.CRON_SECRET;

// USDC token address
const USDC_FA_ADDRESS = "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39";

/**
 * POST /api/admin/withdraw - Withdraw USDC from executor wallet to a user
 * 
 * Requires ADMIN_SECRET for authorization
 */
export async function POST(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get("authorization");
    if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isExecutorConfigured()) {
      return NextResponse.json({ error: "Executor not configured" }, { status: 503 });
    }

    const body = await request.json();
    const { recipientAddress, amount } = body;

    if (!recipientAddress) {
      return NextResponse.json({ error: "recipientAddress required" }, { status: 400 });
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{1,64}$/.test(recipientAddress)) {
      return NextResponse.json({ error: "Invalid address format" }, { status: 400 });
    }

    const aptos = getAptosClient();
    const executor = getExecutorAccount();

    // Get current USDC balance
    const balances = await getExecutorBalances();
    console.log(`[ADMIN] Current executor USDC balance: ${balances.usdc}`);

    // Determine amount to withdraw (all if not specified)
    const withdrawAmount = amount ? parseFloat(amount) : balances.usdc;
    
    if (withdrawAmount <= 0) {
      return NextResponse.json({ 
        error: "No USDC to withdraw",
        balance: balances.usdc 
      }, { status: 400 });
    }

    if (withdrawAmount > balances.usdc) {
      return NextResponse.json({ 
        error: `Insufficient balance. Available: ${balances.usdc} USDC`,
        balance: balances.usdc 
      }, { status: 400 });
    }

    console.log(`[ADMIN] Withdrawing ${withdrawAmount} USDC to ${recipientAddress}`);

    // Convert to raw amount (USDC has 6 decimals)
    const rawAmount = Math.floor(withdrawAmount * 1e6);

    // Build the transfer transaction
    const useSponsorship = isGasStationConfigured();
    
    const transaction = await aptos.transaction.build.simple({
      sender: executor.accountAddress,
      withFeePayer: useSponsorship,
      data: {
        function: "0x1::primary_fungible_store::transfer",
        typeArguments: ["0x1::fungible_asset::Metadata"],
        functionArguments: [
          USDC_FA_ADDRESS,
          recipientAddress,
          rawAmount.toString(),
        ],
      },
    });

    let txHash: string;

    if (useSponsorship) {
      console.log("[ADMIN] Using Shinami Gas Station for sponsorship");
      const gasStationClient = getGasStationClient();
      const feePayerAuth = await gasStationClient.sponsorTransaction(transaction);
      
      const senderAuth = aptos.transaction.sign({
        signer: executor,
        transaction,
      });

      const pendingTx = await aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator: senderAuth,
        feePayerAuthenticator: feePayerAuth,
      });

      txHash = pendingTx.hash;
    } else {
      const senderAuth = aptos.transaction.sign({
        signer: executor,
        transaction,
      });

      const pendingTx = await aptos.transaction.submit.simple({
        transaction,
        senderAuthenticator: senderAuth,
      });

      txHash = pendingTx.hash;
    }

    // Wait for confirmation
    const result = await aptos.waitForTransaction({
      transactionHash: txHash,
    });

    if (!result.success) {
      throw new Error(`Transaction failed: ${result.vm_status}`);
    }

    console.log(`[ADMIN] Withdrawal complete: ${txHash}`);

    return NextResponse.json({
      success: true,
      txHash,
      amount: withdrawAmount,
      recipient: recipientAddress,
      explorerUrl: `https://explorer.movementnetwork.xyz/txn/${txHash}?network=mainnet`,
    });

  } catch (error) {
    console.error("[ADMIN] Withdrawal failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Withdrawal failed" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/withdraw - Get executor wallet balances
 */
export async function GET(request: NextRequest) {
  try {
    // Verify admin authorization
    const authHeader = request.headers.get("authorization");
    if (!ADMIN_SECRET || authHeader !== `Bearer ${ADMIN_SECRET}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!isExecutorConfigured()) {
      return NextResponse.json({ error: "Executor not configured" }, { status: 503 });
    }

    const balances = await getExecutorBalances();

    return NextResponse.json({
      success: true,
      balances,
      executorAddress: "0x28b57594e3c48fd4303887482a0667127fc761a20f5c3bd9401c5841904e322a",
    });

  } catch (error) {
    console.error("[ADMIN] Balance check failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to get balances" },
      { status: 500 }
    );
  }
}
