"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Loader2, MapPin, Building2, Check, AlertCircle } from "lucide-react"
import { createClient } from "@supabase/supabase-js"

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// Asset class options
const ASSET_CLASSES = [
  "Retail",
  "F&B",
  "Office",
  "Industrial",
  "Residential",
  "Leisure",
  "Mixed Use",
  "Other"
]

// Generate slug from address
function generateSlug(siteName: string, address: string): string {
  const base = siteName || address
  return base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 80)
}

export default function NewSiteEvaluationPage() {
  const router = useRouter()
  
  // Form state
  const [address, setAddress] = useState("")
  const [postcode, setPostcode] = useState("")
  const [siteName, setSiteName] = useState("")
  const [brand, setBrand] = useState("")
  const [brandLogoUrl, setBrandLogoUrl] = useState("")
  const [assetClass, setAssetClass] = useState("")
  const [sqFt, setSqFt] = useState("")
  const [notes, setNotes] = useState("")
  
  // Region lookup state
  const [regionCode, setRegionCode] = useState("")
  const [regionName, setRegionName] = useState("")
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupSuccess, setLookupSuccess] = useState(false)
  
  // Submission state
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Postcode lookup
  const lookupPostcode = useCallback(async () => {
    if (!postcode.trim()) {
      setLookupError("Please enter a postcode")
      return
    }

    setLookupLoading(true)
    setLookupError(null)
    setLookupSuccess(false)

    try {
      const response = await fetch(`/api/postcode-lookup?postcode=${encodeURIComponent(postcode)}`)
      const data = await response.json()

      if (!response.ok) {
        setLookupError(data.error || "Postcode lookup failed")
        return
      }

      setRegionCode(data.region_code)
      setRegionName(data.region_name)
      setLookupSuccess(true)
      
      if (data.warning) {
        setLookupError(data.warning)
      }
    } catch (error) {
      setLookupError("Failed to lookup postcode")
    } finally {
      setLookupLoading(false)
    }
  }, [postcode])

  // Form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!address.trim()) {
      setSubmitError("Address is required")
      return
    }
    
    if (!regionCode || !regionName) {
      setSubmitError("Please lookup a valid postcode first")
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    const slug = generateSlug(siteName, address)

    try {
      const { data, error } = await supabase
        .from("site_evaluations")
        .insert({
          slug,
          address: address.trim(),
          postcode: postcode.trim() || null,
          region_code: regionCode,
          region_name: regionName,
          site_name: siteName.trim() || null,
          brand: brand.trim() || null,
          brand_logo_url: brandLogoUrl.trim() || null,
          asset_class: assetClass || null,
          sq_ft: sqFt ? parseInt(sqFt, 10) : null,
          notes: notes.trim() || null
        })
        .select()
        .single()

      if (error) {
        if (error.code === "23505") {
          setSubmitError("A site with this address already exists")
        } else {
          setSubmitError(error.message)
        }
        return
      }

      // Redirect to the new site evaluation page
      router.push(`/site/${slug}`)
    } catch (error) {
      setSubmitError("Failed to create site evaluation")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        {/* Back link */}
        <Link
          href="/admin/assets"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Assets
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-foreground mb-2">
            New Site Evaluation
          </h1>
          <p className="text-muted-foreground">
            Create a site evaluation for location planning. Enter the postcode to auto-detect the region.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Postcode + Lookup */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Postcode *
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={postcode}
                onChange={(e) => {
                  setPostcode(e.target.value.toUpperCase())
                  setLookupSuccess(false)
                  setLookupError(null)
                }}
                placeholder="e.g., AB25 1HQ"
                className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
              <button
                type="button"
                onClick={lookupPostcode}
                disabled={lookupLoading}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
              >
                {lookupLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : lookupSuccess ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <MapPin className="h-4 w-4" />
                )}
                Lookup
              </button>
            </div>
            
            {/* Region result */}
            {lookupSuccess && regionName && (
              <div className="flex items-center gap-2 text-sm text-emerald-500">
                <Check className="h-4 w-4" />
                <span>Region: <strong>{regionName}</strong> ({regionCode})</span>
              </div>
            )}
            
            {lookupError && (
              <div className="flex items-center gap-2 text-sm text-amber-500">
                <AlertCircle className="h-4 w-4" />
                <span>{lookupError}</span>
              </div>
            )}
          </div>

          {/* Address */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Address *
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="e.g., Unit 23, Bon Accord Centre, Aberdeen"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              required
            />
          </div>

          {/* Site Name (optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Site Name <span className="text-muted-foreground">(optional)</span>
            </label>
            <input
              type="text"
              value={siteName}
              onChange={(e) => setSiteName(e.target.value)}
              placeholder="e.g., TUI Aberdeen Bon Accord"
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
            <p className="text-xs text-muted-foreground">
              A friendly name for this site. If blank, the address will be used.
            </p>
          </div>

          {/* Brand */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Brand <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                placeholder="e.g., TUI, GAIL's"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Logo Domain <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={brandLogoUrl}
                onChange={(e) => setBrandLogoUrl(e.target.value)}
                placeholder="e.g., tui.com"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Asset Class + Sq Ft */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Asset Class <span className="text-muted-foreground">(optional)</span>
              </label>
              <select
                value={assetClass}
                onChange={(e) => setAssetClass(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              >
                <option value="">Select...</option>
                {ASSET_CLASSES.map((cls) => (
                  <option key={cls} value={cls}>{cls}</option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Size (sq ft) <span className="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="number"
                value={sqFt}
                onChange={(e) => setSqFt(e.target.value)}
                placeholder="e.g., 2500"
                className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">
              Notes <span className="text-muted-foreground">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes about this site evaluation..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
            />
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-sm">
              {submitError}
            </div>
          )}

          {/* Submit button */}
          <div className="flex items-center gap-4 pt-4">
            <button
              type="submit"
              disabled={submitting || !regionCode}
              className="px-6 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Building2 className="h-4 w-4" />
                  Create Site Evaluation
                </>
              )}
            </button>
            <Link
              href="/admin/assets"
              className="px-4 py-2.5 rounded-lg border border-border text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>

        {/* Preview slug */}
        {(siteName || address) && (
          <div className="mt-6 p-4 rounded-lg bg-muted/30 border border-border/30">
            <p className="text-xs text-muted-foreground mb-1">Preview URL</p>
            <code className="text-sm text-foreground">
              /site/{generateSlug(siteName, address) || "..."}
            </code>
          </div>
        )}
      </div>
    </div>
  )
}
