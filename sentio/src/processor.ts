import { AptosModulesProcessor, AptosContext, AptosNetwork } from "@sentio/sdk/aptos"
import type { UserTransactionResponse } from "@aptos-labs/ts-sdk";

// Mosaic Router contract address on Movement mainnet
// Note: This is the actual router being used by Mosaic API
const MOSAIC_ROUTER = "0x3f7399a0d3d646ce94ee0badf16c4c3f3c656fe3a5e142e83b5ebc011aa8b3d";

// Token decimals
const TOKEN_DECIMALS = {
  MOVE: 8,
  USDC: 6,
} as const;

// Buyback wallet addresses to track
const BUYBACK_WALLETS: string[] = [
  // Manual buyback wallet
  "0x682330a16592406f9f4fd5b4822cbe01af2f227825b9711d166fcea5e0ca4838",
  // TWAP Bot executor wallet
  "0x28b57594e3c48fd4303887482a0667127fc761a20f5c3bd9401c5841904e322a",
];

/**
 * Convert raw amount to human-readable amount
 */
function fromRawAmount(rawAmount: bigint | number | string, decimals: number): number {
  const raw = typeof rawAmount === "bigint" ? Number(rawAmount) : 
              typeof rawAmount === "string" ? parseInt(rawAmount, 10) : rawAmount;
  return raw / Math.pow(10, decimals);
}

/**
 * Check if an address is a tracked buyback wallet
 */
function isBuybackWallet(address: string): boolean {
  if (BUYBACK_WALLETS.length === 0) {
    return true;
  }
  return BUYBACK_WALLETS.some(
    (wallet) => wallet.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Process Mosaic router swap events
 */
AptosModulesProcessor.bind({
  address: MOSAIC_ROUTER,
  network: AptosNetwork.MOVEMENT_MAIN_NET,
  startVersion: 0n,
}).onTransaction(
  async (tx: UserTransactionResponse, ctx: AptosContext) => {
    // Check if this is a swap transaction
    const payload = tx.payload;
    if (!payload || payload.type !== "entry_function_payload") {
      return;
    }

    const functionPayload = payload as {
      function: string;
      type_arguments: string[];
      arguments: any[];
    };

    // Check if it's a Mosaic router swap function
    if (!functionPayload.function.includes("::router::swap")) {
      return;
    }

    const sender = tx.sender;
    
    // Only process transactions from tracked buyback wallets
    if (!isBuybackWallet(sender)) {
      return;
    }

    // Extract type arguments to determine swap direction
    const typeArgs = functionPayload.type_arguments || [];
    
    // Check if this is a USDC -> MOVE swap (buyback)
    const srcAsset = typeArgs[0] || "";
    const dstAsset = typeArgs[1] || "";
    
    const isUsdcToMove = 
      srcAsset.toLowerCase().includes("usdc") && 
      dstAsset.toLowerCase().includes("aptos_coin");
    
    if (!isUsdcToMove) {
      return;
    }

    // Extract amounts from transaction events
    let usdcAmount = 0;
    let moveAmount = 0;

    // Parse events to get actual swap amounts
    if (tx.events) {
      for (const event of tx.events) {
        const eventData = event.data as { amount?: string | number };
        // Look for coin withdraw events (USDC spent)
        if (event.type.toLowerCase().includes("withdraw") && event.type.toLowerCase().includes("usdc")) {
          usdcAmount = fromRawAmount(eventData?.amount || 0, TOKEN_DECIMALS.USDC);
        }
        // Look for coin deposit events (MOVE received)
        if (event.type.toLowerCase().includes("deposit") && event.type.toLowerCase().includes("aptoscoin")) {
          moveAmount = fromRawAmount(eventData?.amount || 0, TOKEN_DECIMALS.MOVE);
        }
      }
    }

    // Calculate effective price
    const pricePerMove = usdcAmount > 0 && moveAmount > 0 
      ? usdcAmount / moveAmount 
      : 0;

    // Log the buyback event
    ctx.eventLogger.emit("buyback", {
      distinctId: tx.hash,
      txHash: tx.hash,
      wallet: sender,
      timestamp: Number(tx.timestamp) / 1000,
      usdcAmount,
      moveAmount,
      pricePerMove,
      srcAsset,
      dstAsset,
      version: tx.version?.toString() || "0",
      success: tx.success,
    });

    // Emit metrics for dashboards
    ctx.meter.Counter("buyback_count").add(1, { wallet: sender });
    ctx.meter.Counter("buyback_usdc_total").add(usdcAmount, { wallet: sender });
    ctx.meter.Counter("buyback_move_total").add(moveAmount, { wallet: sender });
    ctx.meter.Gauge("buyback_price").record(pricePerMove, { wallet: sender });
  },
  { includeFailed: false }
);
