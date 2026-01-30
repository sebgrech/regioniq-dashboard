import { NextResponse } from "next/server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { isAdminEmailAsync } from "@/lib/admin"

/**
 * Server-side guard that requires the user to be an admin.
 * Checks against the authorized_users Supabase table.
 * Returns 401 if not authenticated, 403 if not an admin.
 */
export async function requireAdmin() {
  const supabase = await createSupabaseServerClient()
  const { data, error } = await supabase.auth.getUser()

  if (error || !data.user) {
    return {
      user: null,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const isAdmin = await isAdminEmailAsync(data.user.email)
  if (!isAdmin) {
    return {
      user: null,
      response: NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      ),
    }
  }

  return { user: data.user, response: null }
}

