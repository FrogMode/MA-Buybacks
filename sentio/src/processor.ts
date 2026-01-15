import { AptosContext, AptosResourcesContext } from "@sentio/sdk/aptos";

// Mosaic Router contract address on Movement mainnet
const MOSAIC_ROUTER = "0xede23ef215f0594e658b148c2a391b1523335ab01495d8637e076ec510c6ec3c";

// Token addresses
const TOKENS = {
  MOVE: "0x1::aptos_coin::AptosCoin",
  USDC: "0xbae207659db88bea0cbead6da0ed00aac12edcdda169e591cd41c94180b46f3b::usdc::USDC",
} as const;

// Token decimals
const TOKEN_DECIMALS = {
  MOVE: 8,
  USDC: 6,
} as const;

// Buyback wallet addresses to track (can be updated via Sentio dashboard)
// These are placeholder addresses - update with actual buyback wallet addresses
const BUYBACK_WALLETS: string[] = [
  // Add your buyback wallet addresses here
  // Example: "0x1234567890abcdef..."
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
  // If no wallets configured, track all swaps (for testing)
  if (BUYBACK_WALLETS.length === 0) {
    return true;
  }
  return BUYBACK_WALLETS.some(
    (wallet) => wallet.toLowerCase() === address.toLowerCase()
  );
}

/**
 * Process Mosaic router swap events
 * Listens to swap function calls and extracts buyback data
 */
export const processor = AptosContext.bind({
  address: MOSAIC_ROUTER,
  network: "movement_mainnet",
  startVersion: 0n, // Start from the beginning, or set to a specific version
})
  // Handle swap transactions
  .onTransaction(
    async (tx, ctx) => {
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
        srcAsset.includes("usdc") && dstAsset.includes("aptos_coin");
      
      if (!isUsdcToMove) {
        // Not a buyback swap, skip
        return;
      }

      // Extract amounts from transaction events
      let usdcAmount = 0;
      let moveAmount = 0;

      // Parse events to get actual swap amounts
      if (tx.events) {
        for (const event of tx.events) {
          // Look for coin withdraw events (USDC spent)
          if (event.type.includes("::coin::WithdrawEvent") && event.type.includes("usdc")) {
            usdcAmount = fromRawAmount(event.data?.amount || 0, TOKEN_DECIMALS.USDC);
          }
          // Look for coin deposit events (MOVE received)
          if (event.type.includes("::coin::DepositEvent") && event.type.includes("AptosCoin")) {
            moveAmount = fromRawAmount(event.data?.amount || 0, TOKEN_DECIMALS.MOVE);
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
        timestamp: Number(tx.timestamp) / 1000, // Convert to seconds
        usdcAmount,
        moveAmount,
        pricePerMove,
        srcAsset,
        dstAsset,
        version: tx.version?.toString() || "0",
        success: tx.success,
      });

      // Also emit metrics for dashboards
      ctx.meter.Counter("buyback_count").add(1, {
        wallet: sender,
      });
      
      ctx.meter.Counter("buyback_usdc_total").add(usdcAmount, {
        wallet: sender,
      });
      
      ctx.meter.Counter("buyback_move_total").add(moveAmount, {
        wallet: sender,
      });

      ctx.meter.Gauge("buyback_price").record(pricePerMove, {
        wallet: sender,
      });
    },
    {
      // Filter for successful transactions only
      includeFailed: false,
    }
  );

// Export for Sentio
export { processor as default };
