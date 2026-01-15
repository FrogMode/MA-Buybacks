/**
 * Executor Wallet Management
 * 
 * This module manages the backend-controlled wallet that executes TWAP trades
 * on behalf of users. Users deposit USDC, the executor swaps, and MOVE is
 * returned to the user's wallet.
 * 
 * All transactions use Shinami Gas Station for gasless execution.
 * 
 * SECURITY: The executor private key must be stored securely in environment variables.
 */

import { 
  Account, 
  Ed25519PrivateKey, 
  Aptos, 
  AptosConfig, 
  Network,
  Hex
} from "@aptos-labs/ts-sdk";
import { getGasStationClient, isGasStationConfigured } from "./shinami";

// Movement Mainnet configuration
const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";

// Token addresses
const USDC_ADDRESS = "0x83121c9f9b0527d1f056e21a950d6bf3b9e9e2e8353d0e95ccea726713cbea39";
const MOVE_ADDRESS = "0xa"; // Native MOVE

// Lazy-initialized executor account
let executorAccount: Account | null = null;
let aptosClient: Aptos | null = null;

/**
 * Get the Aptos client (singleton)
 */
export function getAptosClient(): Aptos {
  if (!aptosClient) {
    const config = new AptosConfig({
      network: Network.CUSTOM,
      fullnode: MOVEMENT_RPC,
    });
    aptosClient = new Aptos(config);
  }
  return aptosClient;
}

/**
 * Get the executor account (singleton)
 * The private key is loaded from EXECUTOR_PRIVATE_KEY environment variable
 */
export function getExecutorAccount(): Account {
  if (!executorAccount) {
    const privateKeyHex = process.env.EXECUTOR_PRIVATE_KEY;
    
    if (!privateKeyHex) {
      throw new Error("EXECUTOR_PRIVATE_KEY environment variable not set");
    }

    try {
      // Clean the input - remove any whitespace or newlines
      const cleanedKey = privateKeyHex.trim();
      
      // Support multiple formats:
      // 1. ed25519-priv-0x... (SDK format)
      // 2. 0x... (raw hex with prefix)
      // 3. ... (raw hex without prefix)
      let privateKey: Ed25519PrivateKey;
      
      if (cleanedKey.startsWith("ed25519-priv-")) {
        // SDK format - pass directly
        privateKey = new Ed25519PrivateKey(cleanedKey);
      } else {
        // Raw hex format - ensure 0x prefix
        const hexKey = cleanedKey.startsWith("0x") ? cleanedKey : `0x${cleanedKey}`;
        privateKey = new Ed25519PrivateKey(hexKey);
      }
      
      executorAccount = Account.fromPrivateKey({ privateKey });
      console.log(`[EXECUTOR] Wallet initialized: ${executorAccount.accountAddress.toString()}`);
    } catch (error) {
      // Don't leak key details in error messages
      console.error("[EXECUTOR] Failed to initialize wallet:", error);
      throw new Error("Invalid executor wallet configuration");
    }
  }
  
  return executorAccount;
}

/**
 * Get the executor wallet address
 */
export function getExecutorAddress(): string {
  return getExecutorAccount().accountAddress.toString();
}

/**
 * Check if executor wallet is configured
 */
export function isExecutorConfigured(): boolean {
  return !!process.env.EXECUTOR_PRIVATE_KEY;
}

/**
 * Get executor wallet balances
 */
export async function getExecutorBalances(): Promise<{ move: number; usdc: number }> {
  const aptos = getAptosClient();
  const address = getExecutorAddress();
  
  let moveBalance = 0;
  let usdcBalance = 0;

  try {
    // Get MOVE balance (native coin)
    const resources = await aptos.getAccountResources({ accountAddress: address });
    const coinStore = resources.find(
      (r) => r.type === "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>"
    );
    if (coinStore) {
      moveBalance = parseInt((coinStore.data as any).coin.value, 10) / 1e8;
    }
  } catch (error) {
    console.error("Failed to get MOVE balance:", error);
  }

  try {
    // Get USDC balance via GraphQL indexer
    const query = `
      query GetFungibleAssetBalances($address: String!, $asset: String!) {
        current_fungible_asset_balances(
          where: {
            owner_address: {_eq: $address},
            asset_type: {_eq: $asset}
          }
        ) {
          amount
          asset_type
        }
      }
    `;

    const response = await fetch("https://indexer.mainnet.movementnetwork.xyz/v1/graphql", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { address, asset: USDC_ADDRESS },
      }),
    });

    const data = await response.json();
    if (data.data?.current_fungible_asset_balances?.[0]) {
      usdcBalance = parseInt(data.data.current_fungible_asset_balances[0].amount, 10) / 1e6;
    }
  } catch (error) {
    console.error("Failed to get USDC balance:", error);
  }

  return { move: moveBalance, usdc: usdcBalance };
}

/**
 * Submit a sponsored transaction using Shinami Gas Station
 * Falls back to regular submission if Gas Station is not configured
 */
async function submitSponsoredTransaction(
  aptos: Aptos,
  executor: Account,
  txData: {
    function: `${string}::${string}::${string}`;
    typeArguments: string[];
    functionArguments: any[];
  }
): Promise<string> {
  const useSponsorship = isGasStationConfigured();
  
  // Build transaction with fee payer if sponsorship is available
  const transaction = await aptos.transaction.build.simple({
    sender: executor.accountAddress,
    withFeePayer: useSponsorship,
    data: txData,
  });

  if (useSponsorship) {
    console.log("[EXECUTOR] Using Shinami Gas Station for sponsorship");
    
    // Get fee payer signature from Shinami
    const gasStationClient = getGasStationClient();
    const feePayerAuth = await gasStationClient.sponsorTransaction(transaction);
    
    // Sign with executor
    const senderAuth = aptos.transaction.sign({
      signer: executor,
      transaction,
    });

    // Submit with both signatures
    const pendingTx = await aptos.transaction.submit.simple({
      transaction,
      senderAuthenticator: senderAuth,
      feePayerAuthenticator: feePayerAuth,
    });

    // Wait for confirmation
    const result = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    if (!result.success) {
      throw new Error(`Transaction failed: ${result.vm_status}`);
    }

    return pendingTx.hash;
  } else {
    console.log("[EXECUTOR] Gas Station not configured, using regular transaction");
    
    // Regular transaction (executor pays gas)
    const senderAuth = aptos.transaction.sign({
      signer: executor,
      transaction,
    });

    const pendingTx = await aptos.transaction.submit.simple({
      transaction,
      senderAuthenticator: senderAuth,
    });

    const result = await aptos.waitForTransaction({
      transactionHash: pendingTx.hash,
    });

    if (!result.success) {
      throw new Error(`Transaction failed: ${result.vm_status}`);
    }

    return pendingTx.hash;
  }
}

/**
 * Transfer MOVE tokens from executor wallet to user
 * Uses Shinami Gas Station for gasless execution
 */
export async function transferMoveToUser(
  userAddress: string,
  amount: number // Human-readable amount (e.g., 100 MOVE)
): Promise<string> {
  const aptos = getAptosClient();
  const executor = getExecutorAccount();
  
  const rawAmount = Math.floor(amount * 1e8); // Convert to raw units (8 decimals)
  
  console.log(`[EXECUTOR] Transferring ${amount} MOVE to ${userAddress}`);
  
  const txHash = await submitSponsoredTransaction(aptos, executor, {
    function: "0x1::aptos_account::transfer",
    typeArguments: [],
    functionArguments: [userAddress, rawAmount.toString()],
  });

  console.log(`[EXECUTOR] Transfer complete: ${txHash}`);
  return txHash;
}

/**
 * Execute a swap on Mosaic using the executor wallet
 * Uses Shinami Gas Station for gasless execution
 */
export async function executeSwap(
  amountUsdc: number, // Human-readable USDC amount
  userAddress: string, // Where to send the MOVE
  slippageBps: number = 100
): Promise<{ swapTxHash: string; transferTxHash: string; moveReceived: number }> {
  const aptos = getAptosClient();
  const executor = getExecutorAccount();
  
  const MOSAIC_API_URL = "https://api.mosaic.ag/v1";
  const MOSAIC_API_KEY = process.env.MOSAIC_API_KEY;

  if (!MOSAIC_API_KEY) {
    throw new Error("MOSAIC_API_KEY not configured");
  }

  console.log(`[EXECUTOR] Executing swap: ${amountUsdc} USDC -> MOVE for ${userAddress}`);

  // 1. Get quote from Mosaic
  const rawAmount = Math.floor(amountUsdc * 1e6).toString(); // USDC has 6 decimals
  const quoteUrl = new URL(`${MOSAIC_API_URL}/quote`);
  quoteUrl.searchParams.set("srcAsset", USDC_ADDRESS);
  quoteUrl.searchParams.set("dstAsset", MOVE_ADDRESS);
  quoteUrl.searchParams.set("amount", rawAmount);
  quoteUrl.searchParams.set("sender", executor.accountAddress.toString());
  quoteUrl.searchParams.set("slippage", slippageBps.toString());

  console.log(`[EXECUTOR] Fetching Mosaic quote...`);

  const quoteResponse = await fetch(quoteUrl.toString(), {
    headers: {
      "X-API-Key": MOSAIC_API_KEY,
      "Accept": "application/json",
    },
  });

  if (!quoteResponse.ok) {
    const errorText = await quoteResponse.text();
    throw new Error(`Mosaic quote failed: ${quoteResponse.status} - ${errorText}`);
  }

  const quoteData = await quoteResponse.json();
  if (quoteData.code !== 0) {
    throw new Error(`Mosaic error: ${quoteData.message}`);
  }

  const expectedMoveOut = parseInt(quoteData.data.dstAmount, 10) / 1e8;
  const txPayload = quoteData.data.tx;

  console.log(`[EXECUTOR] Quote received: ${amountUsdc} USDC -> ${expectedMoveOut.toFixed(4)} MOVE`);

  // 2. Execute the swap with sponsored gas
  const swapTxHash = await submitSponsoredTransaction(aptos, executor, {
    function: txPayload.function as `${string}::${string}::${string}`,
    typeArguments: txPayload.typeArguments,
    functionArguments: txPayload.functionArguments,
  });

  console.log(`[EXECUTOR] Swap complete: ${swapTxHash}`);

  // 3. Transfer MOVE to user (also sponsored)
  // Keep a tiny buffer (0.1%) in case of rounding
  const transferAmount = expectedMoveOut * 0.999;
  const transferTxHash = await transferMoveToUser(userAddress, transferAmount);

  console.log(`[EXECUTOR] Full execution complete - Swap: ${swapTxHash}, Transfer: ${transferTxHash}`);

  return {
    swapTxHash,
    transferTxHash,
    moveReceived: expectedMoveOut,
  };
}

/**
 * Generate a new executor wallet (for initial setup)
 * Returns the private key - store this securely!
 */
export function generateNewExecutorWallet(): { address: string; privateKey: string } {
  const privateKey = Ed25519PrivateKey.generate();
  const account = Account.fromPrivateKey({ privateKey });
  
  return {
    address: account.accountAddress.toString(),
    privateKey: Hex.fromHexInput(privateKey.toUint8Array()).toString(),
  };
}
