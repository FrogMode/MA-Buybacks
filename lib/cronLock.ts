/**
 * Distributed Cron Lock
 * 
 * Prevents multiple cron executions from running simultaneously.
 * Uses Supabase for distributed locking across Vercel instances.
 */

import { createClient, SupabaseClient } from "@supabase/supabase-js";

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;
  
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  
  if (!url || !key) {
    console.warn("[LOCK] Supabase not configured - using in-memory lock only");
    return null;
  }
  
  supabase = createClient(url, key);
  return supabase;
}

// Lock configuration
const LOCK_NAME = "twap_cron_execution";
const LOCK_TIMEOUT_MS = 120000; // 2 minutes - max execution time
const LOCK_MIN_INTERVAL_MS = 30000; // 30 seconds minimum between executions

interface CronLock {
  id: string;
  lock_name: string;
  locked_by: string;
  locked_at: number;
  expires_at: number;
}

/**
 * Attempt to acquire the cron lock
 * Returns a lock ID if successful, null if lock is held by another process
 */
export async function acquireCronLock(executionId: string): Promise<string | null> {
  const db = getSupabase();
  const now = Date.now();
  
  if (!db) {
    // Fallback to simple console warning - not safe for production
    console.warn("[LOCK] No database - lock not enforced!");
    return executionId;
  }

  try {
    // Try to get existing lock
    const { data: existingLock, error: fetchError } = await db
      .from("cron_locks")
      .select("*")
      .eq("lock_name", LOCK_NAME)
      .single();

    if (fetchError && fetchError.code !== "PGRST116") {
      // PGRST116 = not found, which is fine
      console.error("[LOCK] Error fetching lock:", fetchError);
      return null;
    }

    // Check if lock exists and is still valid
    if (existingLock) {
      const lock = existingLock as CronLock;
      
      // Check if lock has expired
      if (lock.expires_at > now) {
        // Lock is held by another process
        const holdTime = now - lock.locked_at;
        console.log(`[LOCK] Lock held by ${lock.locked_by} for ${holdTime}ms`);
        return null;
      }
      
      // Lock has expired - we can take it
      console.log(`[LOCK] Expired lock from ${lock.locked_by}, taking over`);
    }

    // Check minimum interval since last execution
    if (existingLock) {
      const lock = existingLock as CronLock;
      const timeSinceLastLock = now - lock.locked_at;
      if (timeSinceLastLock < LOCK_MIN_INTERVAL_MS) {
        console.log(`[LOCK] Too soon since last execution (${timeSinceLastLock}ms)`);
        return null;
      }
    }

    // Acquire lock using upsert with conflict resolution
    const lockData = {
      lock_name: LOCK_NAME,
      locked_by: executionId,
      locked_at: now,
      expires_at: now + LOCK_TIMEOUT_MS,
    };

    const { error: upsertError } = await db
      .from("cron_locks")
      .upsert(lockData, { 
        onConflict: "lock_name",
        ignoreDuplicates: false,
      });

    if (upsertError) {
      console.error("[LOCK] Error acquiring lock:", upsertError);
      return null;
    }

    // Verify we got the lock (another process might have beaten us)
    const { data: verifyLock, error: verifyError } = await db
      .from("cron_locks")
      .select("*")
      .eq("lock_name", LOCK_NAME)
      .eq("locked_by", executionId)
      .single();

    if (verifyError || !verifyLock) {
      console.log("[LOCK] Lost lock race to another process");
      return null;
    }

    console.log(`[LOCK] Acquired lock: ${executionId}`);
    return executionId;

  } catch (error) {
    console.error("[LOCK] Lock acquisition failed:", error);
    return null;
  }
}

/**
 * Release the cron lock
 */
export async function releaseCronLock(executionId: string): Promise<void> {
  const db = getSupabase();
  
  if (!db) return;

  try {
    // Only release if we hold the lock
    const { error } = await db
      .from("cron_locks")
      .delete()
      .eq("lock_name", LOCK_NAME)
      .eq("locked_by", executionId);

    if (error) {
      console.error("[LOCK] Error releasing lock:", error);
    } else {
      console.log(`[LOCK] Released lock: ${executionId}`);
    }
  } catch (error) {
    console.error("[LOCK] Lock release failed:", error);
  }
}

/**
 * Extend the lock timeout (for long-running operations)
 */
export async function extendCronLock(executionId: string, additionalMs: number = LOCK_TIMEOUT_MS): Promise<boolean> {
  const db = getSupabase();
  
  if (!db) return true;

  try {
    const newExpiry = Date.now() + additionalMs;
    
    const { error } = await db
      .from("cron_locks")
      .update({ expires_at: newExpiry })
      .eq("lock_name", LOCK_NAME)
      .eq("locked_by", executionId);

    if (error) {
      console.error("[LOCK] Error extending lock:", error);
      return false;
    }

    console.log(`[LOCK] Extended lock: ${executionId} until ${new Date(newExpiry).toISOString()}`);
    return true;
  } catch (error) {
    console.error("[LOCK] Lock extension failed:", error);
    return false;
  }
}

/**
 * Get current lock status (for debugging)
 */
export async function getCronLockStatus(): Promise<CronLock | null> {
  const db = getSupabase();
  
  if (!db) return null;

  try {
    const { data, error } = await db
      .from("cron_locks")
      .select("*")
      .eq("lock_name", LOCK_NAME)
      .single();

    if (error || !data) return null;
    return data as CronLock;
  } catch {
    return null;
  }
}

/**
 * SQL to create the cron_locks table:
 * 
 * CREATE TABLE cron_locks (
 *   id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
 *   lock_name VARCHAR(255) UNIQUE NOT NULL,
 *   locked_by VARCHAR(255) NOT NULL,
 *   locked_at BIGINT NOT NULL,
 *   expires_at BIGINT NOT NULL
 * );
 * 
 * CREATE INDEX idx_cron_locks_name ON cron_locks(lock_name);
 */
