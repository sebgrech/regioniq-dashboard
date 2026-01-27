"use client"

import { useState, useCallback, useMemo } from "react"
import Image from "next/image"
import { Building2 } from "lucide-react"
import { cn } from "@/lib/utils"

export interface CompanyLogoProps {
  /** Company domain (e.g., "nike.com") or company name for lookup */
  domain?: string | null
  /** Optional company name to search by (uses /name/ endpoint) */
  name?: string | null
  /** Size in pixels (used for width and height) */
  size?: number
  /** Additional CSS classes */
  className?: string
  /** Alt text for the image */
  alt?: string
  /** Whether to show a fallback icon on error */
  showFallback?: boolean
  /** Custom fallback element */
  fallback?: React.ReactNode
}

/**
 * Normalizes a company name to a domain-like format for Logo.dev lookup.
 * Handles common patterns like "Tesco Plc" -> "tesco.com"
 */
function normalizeToDomain(input: string): string {
  let cleaned = input.trim().toLowerCase()
  
  // Remove common suffixes
  cleaned = cleaned
    .replace(/\s+(plc|ltd|limited|inc|corp|corporation|llc|llp|group|holdings)\.?$/i, "")
    .replace(/\s+&\s+/g, "-") // "A & B" -> "a-b"
    .replace(/['']/g, "") // Remove apostrophes
    .replace(/\s+/g, "") // Remove spaces
  
  // If it already looks like a domain, use it
  if (cleaned.includes(".")) {
    return cleaned
  }
  
  // Append .com as default TLD
  return `${cleaned}.com`
}

/**
 * CompanyLogo - Displays a company logo using Logo.dev API
 * 
 * Uses the Logo.dev image CDN to fetch logos by domain name.
 * Falls back to a building icon if the logo cannot be loaded.
 */
export function CompanyLogo({
  domain,
  name,
  size = 32,
  className,
  alt,
  showFallback = true,
  fallback,
}: CompanyLogoProps) {
  const [hasError, setHasError] = useState(false)
  
  const handleError = useCallback(() => {
    setHasError(true)
  }, [])
  
  // Determine the lookup value - prefer domain, fall back to normalized name
  const lookupDomain = useMemo(() => {
    if (domain) {
      // Clean up domain - remove protocol and www
      let cleaned = domain.trim().toLowerCase()
      cleaned = cleaned.replace(/^https?:\/\//, "")
      cleaned = cleaned.replace(/^www\./, "")
      cleaned = cleaned.split("/")[0].split("?")[0]
      return cleaned
    }
    if (name) {
      return normalizeToDomain(name)
    }
    return null
  }, [domain, name])
  
  const imageUrl = useMemo(() => {
    if (!lookupDomain) return null
    
    const token = process.env.NEXT_PUBLIC_LOGO_DEV_TOKEN
    if (!token) {
      console.warn("Logo.dev: NEXT_PUBLIC_LOGO_DEV_TOKEN is not configured")
      return null
    }
    
    // Use retina for crisp display, WebP for performance
    const params = new URLSearchParams({
      token,
      format: "webp",
      size: String(Math.min(size * 2, 256)), // Request 2x for retina, max 256
    })
    
    return `https://img.logo.dev/${lookupDomain}?${params.toString()}`
  }, [lookupDomain, size])
  
  // No lookup value - show nothing or fallback
  if (!lookupDomain || !imageUrl) {
    return showFallback ? (
      fallback ?? (
        <div 
          className={cn(
            "flex items-center justify-center rounded-md bg-muted/50",
            className
          )}
          style={{ width: size, height: size }}
        >
          <Building2 className="h-1/2 w-1/2 text-muted-foreground/50" />
        </div>
      )
    ) : null
  }
  
  // Show fallback on error
  if (hasError) {
    return showFallback ? (
      fallback ?? (
        <div 
          className={cn(
            "flex items-center justify-center rounded-md bg-muted/50",
            className
          )}
          style={{ width: size, height: size }}
        >
          <Building2 className="h-1/2 w-1/2 text-muted-foreground/50" />
        </div>
      )
    ) : null
  }
  
  return (
    <Image
      src={imageUrl}
      alt={alt ?? `${lookupDomain} logo`}
      width={size}
      height={size}
      className={cn("rounded-md object-contain", className)}
      onError={handleError}
      unoptimized // Logo.dev already optimizes
    />
  )
}
