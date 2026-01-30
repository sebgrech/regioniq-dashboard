import { createSupabaseAdminClient } from "@/lib/supabase-admin"

/**
 * Fallback admin emails (used if Supabase query fails or for client-side checks)
 */
const FALLBACK_ADMIN_EMAILS = [
  "slrgrech@hotmail.com",
]

// =============================================================================
// Server-side cache for authorized users
// =============================================================================

let cachedAuthorizedUsers: Map<string, string> | null = null
let cacheTime = 0
const CACHE_TTL = 60 * 1000 // 1 minute

/**
 * Refresh the cache of authorized users from Supabase
 */
async function refreshCache(): Promise<Map<string, string>> {
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from("authorized_users")
      .select("email, role")
    
    if (error) {
      console.error("Failed to fetch authorized users:", error)
      // Return fallback on error
      return new Map(FALLBACK_ADMIN_EMAILS.map(e => [e.toLowerCase(), "admin"]))
    }
    
    const userMap = new Map<string, string>()
    for (const user of data || []) {
      userMap.set(user.email.toLowerCase(), user.role)
    }
    
    // Always include fallback admins
    for (const email of FALLBACK_ADMIN_EMAILS) {
      if (!userMap.has(email.toLowerCase())) {
        userMap.set(email.toLowerCase(), "admin")
      }
    }
    
    cachedAuthorizedUsers = userMap
    cacheTime = Date.now()
    
    return userMap
  } catch (err) {
    console.error("Error refreshing authorized users cache:", err)
    return new Map(FALLBACK_ADMIN_EMAILS.map(e => [e.toLowerCase(), "admin"]))
  }
}

/**
 * Get cached authorized users, refreshing if stale
 */
async function getCachedUsers(): Promise<Map<string, string>> {
  const now = Date.now()
  if (!cachedAuthorizedUsers || now - cacheTime > CACHE_TTL) {
    return refreshCache()
  }
  return cachedAuthorizedUsers
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Check if an email belongs to an admin user (ASYNC - for server-side use)
 * Queries Supabase authorized_users table with caching.
 */
export async function isAdminEmailAsync(email: string | null | undefined): Promise<boolean> {
  if (!email) return false
  
  const users = await getCachedUsers()
  const role = users.get(email.toLowerCase())
  
  // Admin role or assets role both get admin access
  return role === "admin" || role === "assets"
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
 * Get user role from authorized_users table (ASYNC)
 */
export async function getUserRole(email: string | null | undefined): Promise<string | null> {
  if (!email) return null
  
  const users = await getCachedUsers()
  return users.get(email.toLowerCase()) || null
}

/**
 * Invalidate the cache (call after updating authorized_users table)
 */
export function invalidateAuthCache(): void {
  cachedAuthorizedUsers = null
  cacheTime = 0
}

