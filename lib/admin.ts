/**
 * Admin configuration.
 * Add or remove emails here to control admin access.
 */
export const ADMIN_EMAILS = [
  "slrgrech@hotmail.com",
]

/**
 * Check if an email belongs to an admin user.
 * Case-insensitive comparison.
 */
export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false
  const normalizedEmail = email.toLowerCase()
  return ADMIN_EMAILS.some((adminEmail) => adminEmail.toLowerCase() === normalizedEmail)
}

