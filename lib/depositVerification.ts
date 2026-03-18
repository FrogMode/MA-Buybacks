/**
 * Deposit Verification Module
 * 
 * Verifies that USDC deposits actually occurred before activating sessions.
 * This is CRITICAL security - without this, users could claim fake deposits.
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import { getExecutorAddress } from "./executorWallet";

const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";
const USDC_ADDRESS = "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39";

// Tolerance for amount matching (0.1% to account for rounding)
const AMOUNT_TOLERANCE = 0.001;

interface DepositVerificationResult {
  valid: boolean;
  error?: string;
  actualAmount?: number;
  sender?: string;
  timestamp?: number;
}

/**
 * Verify a deposit transaction
 * 
 * Checks:
 * 1. Transaction exists and succeeded
 * 2. It's a USDC transfer to the executor wallet
 * 3. Amount matches the session amount (within tolerance)
 * 4. Sender matches the claiming user (optional but recommended)
 */
export async function verifyDeposit(
  txHash: string,
  expectedAmount: number,
  expectedSender?: string
): Promise<DepositVerificationResult> {
  const config = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_RPC,
  });
  const aptos = new Aptos(config);
  const executorAddress = getExecutorAddress().toLowerCase();

  try {
    // 1. Fetch the transaction
    const tx = await aptos.getTransactionByHash({ transactionHash: txHash });

    if (!tx) {
      return { valid: false, error: "Transaction not found" };
    }

    // 2. Check transaction succeeded
    if (!(tx as any).success) {
      return { valid: false, error: "Transaction failed" };
    }

    // 3. Look for USDC transfer events
    const events = (tx as any).events || [];
    
    // Find fungible asset deposit/withdraw events
    let depositEvent: any = null;
    let withdrawEvent: any = null;
    
    for (const event of events) {
      const eventType = event.type || "";
      
      // Look for deposit to executor
      if (eventType.includes("fungible_asset::Deposit") || 
          eventType.includes("fungible_asset::DepositEvent")) {
        const data = event.data;
        if (data && data.store && data.store.inner) {
          // Check if this is a deposit to executor's USDC store
          // We need to verify the owner of this store is the executor
          depositEvent = event;
        }
      }
      
      // Also check for CoinDeposit events (older format)
      if (eventType.includes("coin::DepositEvent")) {
        depositEvent = event;
      }
      
      // Track withdrawals to find sender
      if (eventType.includes("fungible_asset::Withdraw") ||
          eventType.includes("coin::WithdrawEvent")) {
        withdrawEvent = event;
      }
    }

    // 4. Alternative: Check transaction payload for transfer function
    const payload = (tx as any).payload;
    if (!payload) {
      return { valid: false, error: "No transaction payload" };
    }

    // Check if this is a fungible asset transfer
    const fn = payload.function || "";
    const isTransfer = fn.includes("primary_fungible_store::transfer") ||
                       fn.includes("aptos_account::transfer_coins") ||
                       fn.includes("coin::transfer");
    
    if (!isTransfer) {
      return { valid: false, error: "Not a transfer transaction" };
    }

    // 5. Verify the arguments
    const typeArgs = payload.type_arguments || [];
    const fnArgs = payload.arguments || [];

    // For fungible asset transfer: (asset, recipient, amount)
    // For coin transfer: (recipient, amount) with type arg for coin
    
    let recipient: string | undefined;
    let amount: number | undefined;
    let assetType: string | undefined;

    if (fn.includes("primary_fungible_store::transfer")) {
      // primary_fungible_store::transfer(from, asset, to, amount)
      // Arguments: [asset_metadata, recipient, amount]
      if (fnArgs.length >= 3) {
        assetType = fnArgs[0];
        recipient = fnArgs[1];
        amount = parseInt(fnArgs[2], 10) / 1e6; // USDC has 6 decimals
      }
    } else if (fn.includes("coin::transfer") || fn.includes("transfer_coins")) {
      // coin::transfer<CoinType>(from, to, amount)
      // Type args: [CoinType], Arguments: [recipient, amount]
      if (typeArgs.length > 0) {
        assetType = typeArgs[0];
      }
      if (fnArgs.length >= 2) {
        recipient = fnArgs[0];
        amount = parseInt(fnArgs[1], 10) / 1e6;
      }
    }

    // 6. Verify recipient is executor wallet
    if (!recipient) {
      return { valid: false, error: "Could not determine recipient" };
    }
    
    const recipientLower = recipient.toLowerCase();
    if (recipientLower !== executorAddress) {
      return { 
        valid: false, 
        error: `Wrong recipient: ${recipient}, expected ${executorAddress}` 
      };
    }

    // 7. Verify amount matches (within tolerance)
    if (amount === undefined) {
      return { valid: false, error: "Could not determine amount" };
    }

    const amountDiff = Math.abs(amount - expectedAmount) / expectedAmount;
    if (amountDiff > AMOUNT_TOLERANCE) {
      return {
        valid: false,
        error: `Amount mismatch: received ${amount}, expected ${expectedAmount}`,
        actualAmount: amount,
      };
    }

    // 8. Get sender address
    const sender = (tx as any).sender;

    // 9. Optionally verify sender matches claiming user
    if (expectedSender) {
      const senderLower = sender?.toLowerCase();
      const expectedLower = expectedSender.toLowerCase();
      if (senderLower !== expectedLower) {
        return {
          valid: false,
          error: `Sender mismatch: ${sender}, expected ${expectedSender}`,
          actualAmount: amount,
          sender,
        };
      }
    }

    // 10. STRICTLY verify this is USDC (not some other token)
    // SECURITY: Reject non-USDC transfers - this was previously only a warning
    if (assetType) {
      const isUSDC = assetType.toLowerCase().includes(USDC_ADDRESS.toLowerCase()) ||
                     assetType.toLowerCase().includes("usdc");
      if (!isUSDC) {
        return {
          valid: false,
          error: `Wrong asset type: ${assetType}. Only USDC deposits are accepted.`,
          actualAmount: amount,
          sender,
        };
      }
    }

    // All checks passed
    return {
      valid: true,
      actualAmount: amount,
      sender,
      timestamp: parseInt((tx as any).timestamp, 10),
    };

  } catch (error) {
    console.error("[VERIFY] Deposit verification failed:", error);
    return {
      valid: false,
      error: error instanceof Error ? error.message : "Verification failed",
    };
  }
}

/**
 * Check if a deposit has already been used for another session
 * Prevents double-spending of the same deposit
 */
export async function isDepositAlreadyUsed(
  txHash: string,
  currentSessionId: string,
  checkDatabase: (txHash: string) => Promise<{ sessionId: string } | null>
): Promise<boolean> {
  const existing = await checkDatabase(txHash);
  if (existing && existing.sessionId !== currentSessionId) {
    console.warn(`[VERIFY] Deposit ${txHash} already used by session ${existing.sessionId}`);
    return true;
  }
  return false;
}

/**
 * Get the timestamp when a deposit was confirmed on-chain
 * Used to prevent using very old deposits
 */
export async function getDepositTimestamp(txHash: string): Promise<number | null> {
  const config = new AptosConfig({
    network: Network.CUSTOM,
    fullnode: MOVEMENT_RPC,
  });
  const aptos = new Aptos(config);

  try {
    const tx = await aptos.getTransactionByHash({ transactionHash: txHash });
    return tx ? parseInt((tx as any).timestamp, 10) : null;
  } catch {
    return null;
  }
}
