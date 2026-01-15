/**
 * Shinami Gas Station Client
 * Server-side only - handles transaction sponsorship for gasless transactions
 * https://docs.shinami.com/developer-guides/movement/tutorials/gas-station-backend-only
 */

import { GasStationClient } from "@shinami/clients/aptos";

// Shinami API configuration
const SHINAMI_GAS_STATION_API_KEY = process.env.SHINAMI_GAS_STATION_API_KEY;

// Movement Mainnet RPC
export const MOVEMENT_RPC = "https://mainnet.movementnetwork.xyz/v1";

// Lazy-initialized Gas Station client
let gasStationClient: GasStationClient | null = null;

/**
 * Get the Shinami Gas Station client (singleton)
 */
export function getGasStationClient(): GasStationClient {
  if (!SHINAMI_GAS_STATION_API_KEY) {
    throw new Error("SHINAMI_GAS_STATION_API_KEY not configured");
  }

  if (!gasStationClient) {
    gasStationClient = new GasStationClient(SHINAMI_GAS_STATION_API_KEY);
  }

  return gasStationClient;
}

/**
 * Check if Shinami Gas Station is configured
 */
export function isGasStationConfigured(): boolean {
  return !!SHINAMI_GAS_STATION_API_KEY;
}
