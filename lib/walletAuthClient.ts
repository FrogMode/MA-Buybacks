/**
 * Client-side Wallet Authentication
 * 
 * Used to sign messages proving wallet ownership before
 * making authenticated API requests.
 */

// Message prefix must match server-side
const AUTH_MESSAGE_PREFIX = "MA-Buybacks Auth:";

export interface AuthPayload {
  address: string;
  action: string;
  sessionId?: string;
  timestamp: number;
  nonce: string;
}

export interface SignedAuth {
  payload: AuthPayload;
  signature: string;
  publicKey: string;
}

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Create the message to be signed
 */
export function createAuthMessage(
  action: string,
  sessionId?: string
): { message: string; payload: Omit<AuthPayload, "address"> } {
  const timestamp = Date.now();
  const nonce = generateNonce();
  
  const message = `${AUTH_MESSAGE_PREFIX}\nAction: ${action}\nSession: ${sessionId || "N/A"}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
  
  return {
    message,
    payload: {
      action,
      sessionId,
      timestamp,
      nonce,
    },
  };
}

/**
 * Sign an authentication message using the wallet
 * 
 * @param signMessage - The signMessage function from wallet adapter
 * @param address - The wallet address
 * @param action - The action being performed (e.g., "confirm_deposit", "cancel_session")
 * @param sessionId - The session ID (optional)
 * @returns The signed auth payload to include in API requests
 */
export async function signAuthMessage(
  signMessage: (message: { message: string; nonce: string }) => Promise<{ signature: string; fullMessage: string }>,
  address: string,
  action: string,
  sessionId?: string
): Promise<SignedAuth> {
  const { message, payload } = createAuthMessage(action, sessionId);
  
  try {
    // Sign the message using the wallet
    const result = await signMessage({
      message,
      nonce: payload.nonce,
    });

    // The wallet adapter returns signature as hex string
    // We need to also get the public key - it's derived from the address
    // For Aptos, we may need to get it differently
    
    return {
      payload: {
        ...payload,
        address,
      },
      signature: result.signature,
      // Note: The public key should be retrieved from the wallet
      // This is a placeholder - actual implementation depends on wallet adapter
      publicKey: "", // Will be filled by wallet adapter
    };
  } catch (error) {
    console.error("[AUTH] Failed to sign message:", error);
    throw new Error("Failed to sign authentication message");
  }
}

/**
 * Alternative: Create auth for wallets that don't support signMessage
 * This creates a signature by signing a transaction that won't be submitted
 * 
 * For now, we'll fall back to the simple (insecure) method and log a warning
 */
export function createSimpleAuth(
  address: string,
  action: string,
  sessionId?: string
): { userAddress: string; timestamp: number } {
  console.warn("[AUTH] Using simple auth - wallet signing not available");
  return {
    userAddress: address,
    timestamp: Date.now(),
  };
}
