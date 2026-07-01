// Centralized environment variable resolver for Supabase configuration.
// This module is the single source of truth for all Supabase env vars.
// It resolves variables from VITE_* sources (available everywhere via Vite build-time replacement)
// with fallback to process.env for runtime configuration.
//
// WHY THIS EXISTS:
// - VITE_* vars are baked into the client bundle at build time (import.meta.env)
// - VITE_* vars are also available on the server via import.meta.env (Vite replaces them statically)
// - Non-VITE vars (SUPABASE_URL, etc.) are only available if explicitly set in process.env
// - By centralizing here, you only need to define VITE_* vars in .env, and all server/client
//   code automatically gets the values without manual duplication.
//
// DEPLOYMENT: Just ensure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY are set.
// The service role key (VITE_SUPABASE_SERVICE_ROLE_KEY) is optional for client builds.

export function getSupabaseUrl(): string {
  // Try VITE_ prefixed (build-time injected), then process.env fallback
  const url = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  if (!url) {
    throw new Error(
      'Missing Supabase URL. Set VITE_SUPABASE_URL in .env or SUPABASE_URL in environment.'
    );
  }
  return url;
}

export function getSupabasePublishableKey(): string {
  // Try VITE_ prefixed (build-time injected), then process.env fallback
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!key) {
    throw new Error(
      'Missing Supabase publishable key. Set VITE_SUPABASE_PUBLISHABLE_KEY in .env or SUPABASE_PUBLISHABLE_KEY in environment.'
    );
  }
  return key;
}

export function getSupabaseServiceRoleKey(): string {
  // Service role key is server-only, never exposed to client bundle.
  // Try VITE_ prefixed first (for build-time injection), then process.env fallback.
  const key = import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error(
      'Missing Supabase service role key. Set VITE_SUPABASE_SERVICE_ROLE_KEY in .env or SUPABASE_SERVICE_ROLE_KEY in environment.'
    );
  }
  return key;
}

// Convenience object for destructuring
export const supabaseEnv = {
  get url() { return getSupabaseUrl(); },
  get publishableKey() { return getSupabasePublishableKey(); },
  get serviceRoleKey() { return getSupabaseServiceRoleKey(); },
};
