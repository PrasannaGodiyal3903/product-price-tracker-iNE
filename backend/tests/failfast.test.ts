import { describe, it, expect } from 'vitest';
import { validateAndInitSupabase } from '../src/db/supabase';

// These tests validate the fail-fast startup behavior of validateAndInitSupabase.
// We pass ALL THREE arguments explicitly so env vars are NEVER used as fallback.
describe('Production Fail-Fast Database Configuration Guard', () => {
  it('should throw fatal error in production if SUPABASE_URL is empty string', () => {
    // Explicit empty string - NOT undefined which would trigger env var fallback
    expect(() => {
      validateAndInitSupabase('', 'some-valid-key', 'production');
    }).toThrow(/Production database configuration error/);
  });

  it('should throw fatal error in production if SUPABASE_KEY is empty string', () => {
    expect(() => {
      validateAndInitSupabase('https://valid.supabase.co', '', 'production');
    }).toThrow(/Production database configuration error/);
  });

  it('should throw fatal error in production if placeholder URL is used', () => {
    expect(() => {
      validateAndInitSupabase('https://your-project.supabase.co', 'some-key', 'production');
    }).toThrow(/Production database configuration error/);
  });

  it('should throw when both URL and key are empty in production', () => {
    expect(() => {
      validateAndInitSupabase('', '', 'production');
    }).toThrow(/Production database configuration error/);
  });

  it('should return null in development when credentials are empty (LOCAL_FALLBACK)', () => {
    const devClient = validateAndInitSupabase('', '', 'development');
    expect(devClient).toBeNull();
  });

  it('should return null in test environment when credentials are empty (LOCAL_FALLBACK)', () => {
    const testClient = validateAndInitSupabase('', '', 'test');
    expect(testClient).toBeNull();
  });

  it('production must never silently use LOCAL_FALLBACK (both variants)', () => {
    expect(() => validateAndInitSupabase('', '', 'production')).toThrow();
    expect(() => validateAndInitSupabase('https://your-project.supabase.co', '', 'production')).toThrow();
  });
});
