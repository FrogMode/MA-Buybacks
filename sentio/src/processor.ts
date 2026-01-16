import { AptosModulesProcessor, AptosContext, AptosNetwork } from "@sentio/sdk/aptos"
import type { UserTransactionResponse } from "@aptos-labs/ts-sdk";

// Mosaic Router contract address on Movement mainnet
const MOSAIC_ROUTER = "0x3f7399a0d3d646ce94ee0badf16c4c3f3c656fe3a5e142e83b5ebc011aa8b3d";

// Token addresses
const USDC_ADDRESS = "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39";
const MOVE_ADDRESS = "0x1::aptos_coin::AptosCoin";

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
 * Check if asset is USDC
 */
function isUsdcAsset(asset: string): boolean {
  return asset.toLowerCase() === USDC_ADDRESS.toLowerCase();
}

/**
 * Check if asset is MOVE
 */
function isMoveAsset(asset: string): boolean {
  return asset.toLowerCase().includes("aptos_coin");
}

// Define the SwapEvent data structure
interface SwapEventData {
  sender: string;
  receiver: string;
  input_asset: string;
  output_asset: string;
  input_amount: string;
  output_amount: string;
  timestamp: string;
  extra_data?: string;
}

/**
 * Process Mosaic router swap events
 */
AptosModulesProcessor.bind({
  address: MOSAIC_ROUTER,
  network: AptosNetwork.MOVEMENT_MAIN_NET,
  // Start from version 58000000 to speed up indexing (first TWAP swaps are around 58535191)
  startVersion: 58000000n,
}).onTransaction(
  async (tx: UserTransactionResponse, ctx: AptosContext) => {
    // Skip failed transactions
    if (!tx.success) {
      return;
    }

    // Look for SwapEvent from Mosaic router
    if (!tx.events) {
      return;
    }

    for (const event of tx.events) {
      // Check if this is a Mosaic SwapEvent
      if (!event.type.includes(`${MOSAIC_ROUTER}::router::SwapEvent`)) {
        continue;
      }

      const eventData = event.data as SwapEventData;
      const sender = eventData.sender;

      // Only process transactions from tracked buyback wallets
      if (!isBuybackWallet(sender)) {
        continue;
      }

      // Check if this is a USDC -> MOVE swap (buyback)
      const inputAsset = eventData.input_asset;
      const outputAsset = eventData.output_asset;

      const isUsdcToMove = isUsdcAsset(inputAsset) && isMoveAsset(outputAsset);

      if (!isUsdcToMove) {
        // Skip non-buyback swaps (e.g., MOVE -> USDC would be a sell)
        continue;
      }

      // Parse amounts
      const usdcAmount = fromRawAmount(eventData.input_amount, TOKEN_DECIMALS.USDC);
      const moveAmount = fromRawAmount(eventData.output_amount, TOKEN_DECIMALS.MOVE);

      // Calculate effective price
      const pricePerMove = usdcAmount > 0 && moveAmount > 0 
        ? usdcAmount / moveAmount 
        : 0;

      // Log the buyback event
      ctx.eventLogger.emit("buyback", {
        distinctId: tx.hash,
        txHash: tx.hash,
        wallet: sender,
        timestamp: Number(eventData.timestamp),
        usdcAmount,
        moveAmount,
        pricePerMove,
        inputAsset,
        outputAsset,
        version: tx.version?.toString() || "0",
        success: tx.success,
      });

      // Emit metrics for dashboards
      ctx.meter.Counter("buyback_count").add(1, { wallet: sender });
      ctx.meter.Counter("buyback_usdc_total").add(usdcAmount, { wallet: sender });
      ctx.meter.Counter("buyback_move_total").add(moveAmount, { wallet: sender });
      ctx.meter.Gauge("buyback_price").record(pricePerMove, { wallet: sender });
    }
  },
  { includeFailed: false }
);
