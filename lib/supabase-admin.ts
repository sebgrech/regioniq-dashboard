import { createClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase client with service role privileges.
 * SERVER-ONLY! Never import this in client components.
 * 
 * Use this for admin operations like:
 * - Querying pipeline_runs table
 * - Generating signed URLs for private Storage buckets
 */
export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRole) {
    throw new Error(
      "Missing SUPABASE_SERVICE_ROLE_KEY environment variable. " +
      "Add it to your Vercel environment variables."
    )
  }

  return createClient(url, serviceRole, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

