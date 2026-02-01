import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * Fallback admin emails (used if Supabase query fails or for client-side checks)
 */
const FALLBACK_ADMIN_EMAILS = [
  "slrgrech@hotmail.com",
]

// =============================================================================
// Server-side cache for users with assets access
// =============================================================================

let cachedAssetsUsers: Set<string> | null = null
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

/**
 * Refresh the cache of users with assets access from allowed_emails table
 */
async function refreshCache(): Promise<Set<string>> {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("allowed_emails")
      .select("email")
      .eq("assets_access", true)
    
    if (error) {
      console.error("Failed to fetch allowed_emails:", error)
      // Return fallback on error
      return new Set(FALLBACK_ADMIN_EMAILS.map(e => e.toLowerCase()))
    }
    
    const userSet = new Set<string>()
    for (const user of data || []) {
      userSet.add(user.email.toLowerCase())
    }
    
    // Always include fallback admins
    for (const email of FALLBACK_ADMIN_EMAILS) {
      userSet.add(email.toLowerCase())
    }
    
    cachedAssetsUsers = userSet
    cacheTime = Date.now()
    
    return userSet
  } catch (err) {
    console.error("Error refreshing assets access cache:", err)
    return new Set(FALLBACK_ADMIN_EMAILS.map(e => e.toLowerCase()))
  }
}

/**
 * Get cached users with assets access, refreshing if stale
 */
async function getCachedAssetsUsers(): Promise<Set<string>> {
  const now = Date.now()
  if (!cachedAssetsUsers || now - cacheTime > CACHE_TTL) {
    return refreshCache()
  }
  return cachedAssetsUsers
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if an email has assets access (ASYNC - for server-side use)
 * Queries Supabase allowed_emails table with caching.
 */
export async function isAdminEmailAsync(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  
  const users = await getCachedAssetsUsers()
  return users.has(email.toLowerCase())
}

/**
 * Check if an email belongs to an admin user (SYNC - for client-side use)
 * Uses fallback list only. For accurate checks, use isAdminEmailAsync on server.
 * 
 * @deprecated Prefer isAdminEmailAsync for server-side checks
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalizedEmail = email.toLowerCase()
  return FALLBACK_ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalizedEmail)
}

/**
 * Invalidate the cache (call after updating allowed_emails table)
 */
export function invalidateAuthCache(): void {
  cachedAssetsUsers = null
  cacheTime = 0
}

