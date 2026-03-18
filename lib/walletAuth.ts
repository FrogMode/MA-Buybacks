/**
 * Wallet Authentication Module
 * 
 * Provides cryptographic verification of wallet ownership via signed messages.
 * This prevents address spoofing attacks where attackers claim to own wallets they don't.
 */

import { 
  Ed25519Signature, 
  Ed25519PublicKey,
  Hex 
} from "@aptos-labs/ts-sdk";
import nacl from "tweetnacl";

// Message prefix for all signed auth messages
const AUTH_MESSAGE_PREFIX = "MA-Buybacks Auth:";

// Signature expiry time (5 minutes)
const SIGNATURE_EXPIRY_MS = 5 * 60 * 1000;

// Nonce tracking to prevent replay (in-memory, should use Redis in production)
const usedNonces = new Map<string, number>();
const NONCE_CLEANUP_INTERVAL_MS = 60 * 1000;

// Cleanup old nonces periodically
setInterval(() => {
  const cutoff = Date.now() - SIGNATURE_EXPIRY_MS * 2;
  for (const [nonce, timestamp] of usedNonces.entries()) {
    if (timestamp < cutoff) {
      usedNonces.delete(nonce);
    }
  }
}, NONCE_CLEANUP_INTERVAL_MS);

export interface AuthPayload {
  address: string;
  action: string;
  sessionId?: string;
  timestamp: number;
  nonce: string;
}

export interface SignedAuth {
  payload: AuthPayload;
  signature: string; // Hex-encoded signature
  publicKey: string; // Hex-encoded public key
}

/**
 * Generate a message to be signed by the user's wallet
 */
export function generateAuthMessage(
  action: string,
  sessionId?: string
): { message: string; payload: AuthPayload } {
  const timestamp = Date.now();
  const nonce = generateNonce();
  
  const payload: AuthPayload = {
    address: "", // Will be filled by frontend
    action,
    sessionId,
    timestamp,
    nonce,
  };
  
  const message = `${AUTH_MESSAGE_PREFIX}\nAction: ${action}\nSession: ${sessionId || "N/A"}\nTimestamp: ${timestamp}\nNonce: ${nonce}`;
  
  return { message, payload };
}

/**
 * Verify a signed authentication message
 */
export function verifyWalletSignature(auth: SignedAuth): {
  valid: boolean;
  error?: string;
  address?: string;
} {
  try {
    const { payload, signature, publicKey } = auth;
    
    // 1. Check timestamp is recent
    const age = Date.now() - payload.timestamp;
    if (age > SIGNATURE_EXPIRY_MS) {
      return { valid: false, error: "Signature expired" };
    }
    if (age < 0) {
      return { valid: false, error: "Timestamp in future" };
    }
    
    // 2. Check nonce hasn't been used
    if (usedNonces.has(payload.nonce)) {
      return { valid: false, error: "Nonce already used" };
    }
    
    // 3. Reconstruct the message
    const message = `${AUTH_MESSAGE_PREFIX}\nAction: ${payload.action}\nSession: ${payload.sessionId || "N/A"}\nTimestamp: ${payload.timestamp}\nNonce: ${payload.nonce}`;
    const messageBytes = new TextEncoder().encode(message);
    
    // 4. Verify signature
    const signatureBytes = Hex.fromHexString(signature).toUint8Array();
    const publicKeyBytes = Hex.fromHexString(publicKey).toUint8Array();
    
    const isValid = nacl.sign.detached.verify(
      messageBytes,
      signatureBytes,
      publicKeyBytes
    );
    
    if (!isValid) {
      return { valid: false, error: "Invalid signature" };
    }
    
    // 5. Derive address from public key and verify it matches claimed address
    const derivedAddress = deriveAddressFromPublicKey(publicKeyBytes);
    if (derivedAddress.toLowerCase() !== payload.address.toLowerCase()) {
      return { valid: false, error: "Address mismatch" };
    }
    
    // 6. Mark nonce as used
    usedNonces.set(payload.nonce, Date.now());
    
    return { valid: true, address: derivedAddress };
    
  } catch (error) {
    console.error("[AUTH] Signature verification failed:", error);
    return { valid: false, error: "Verification failed" };
  }
}

/**
 * Derive Aptos address from Ed25519 public key
 */
function deriveAddressFromPublicKey(publicKeyBytes: Uint8Array): string {
  // For Ed25519, address = SHA3-256(pubkey || 0x00)
  // The 0x00 is the single-key auth key suffix
  const crypto = require("crypto");
  const data = Buffer.concat([
    Buffer.from(publicKeyBytes),
    Buffer.from([0x00])
  ]);
  const hash = crypto.createHash("sha3-256").update(data).digest();
  return "0x" + hash.toString("hex");
}

/**
 * Generate a random nonce
 */
function generateNonce(): string {
  const bytes = new Uint8Array(16);
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Node.js fallback
    require("crypto").randomFillSync(bytes);
  }
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Simple auth for development/testing
 * In production, always use verifyWalletSignature
 */
export function verifySimpleAuth(
  claimedAddress: string,
  sessionOwnerAddress: string
): boolean {
  // This is the INSECURE current behavior - just string comparison
  // TODO: Remove this once frontend supports wallet signatures
  return claimedAddress.toLowerCase() === sessionOwnerAddress.toLowerCase();
}
