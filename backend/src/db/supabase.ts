import { createClient, SupabaseClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * Validates database configuration and initializes the Supabase client.
 * In production (NODE_ENV === 'production'), missing or placeholder credentials
 * cause a fatal error to prevent silent in-memory fallback.
 *
 * Pass explicit string values to override env vars (useful in tests).
 * Pass the sentinel USE_ENV (undefined) to read from process.env (default behavior).
 */
export const USE_ENV = undefined as undefined;

export function validateAndInitSupabase(
  url?: string | null,
  key?: string | null,
  nodeEnv?: string | null
): SupabaseClient | null {
  // Resolve actual values: null/undefined → read from env
  const resolvedUrl = (url === null || url === undefined)
    ? process.env.SUPABASE_URL
    : url;
  const resolvedKey = (key === null || key === undefined)
    ? (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY)
    : key;
  const resolvedEnv = (nodeEnv === null || nodeEnv === undefined)
    ? process.env.NODE_ENV
    : nodeEnv;

  const isProduction = resolvedEnv === 'production';
  const hasValidConfig = Boolean(
    resolvedUrl &&
    resolvedKey &&
    resolvedUrl.trim().length > 0 &&
    resolvedKey.trim().length > 0 &&
    !resolvedUrl.includes('your-project')
  );

  if (isProduction && !hasValidConfig) {
    throw new Error(
      '[FATAL] Production database configuration error: Missing or placeholder SUPABASE_URL or SUPABASE_ANON_KEY/SUPABASE_SERVICE_ROLE_KEY. Production must not run with local in-memory fallback.'
    );
  }

  if (hasValidConfig) {
    try {
      const isServiceRole = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && resolvedKey === process.env.SUPABASE_SERVICE_ROLE_KEY);
      const client = createClient(resolvedUrl!, resolvedKey!, {
        auth: { persistSession: false }
      });
      console.log(`[DB] Supabase client initialized successfully using ${isServiceRole ? 'SERVICE_ROLE_KEY (RLS bypass enabled)' : 'ANON_KEY (requires 002_rls_policies.sql applied in Supabase)'}.`);
      return client;
    } catch (err: any) {
      if (isProduction) {
        throw new Error(`[FATAL] Failed to initialize Supabase client in production: ${err.message}`);
      }
      console.warn('[DB] Failed to initialize Supabase client:', err.message);
      return null;
    }
  }

  console.log('[DB] Supabase credentials not found in environment. Running with local fallback store.');
  return null;
}

export let supabase: SupabaseClient | null = validateAndInitSupabase();
