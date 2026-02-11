"use client"

import { useState, useCallback, useEffect } from "react"
import { useRouter } from "next/navigation"
import { MapPin, Check, Loader2, Plus, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"

// =============================================================================
// Constants
// =============================================================================

const ASSET_CLASSES = [
  "Retail",
  "F&B",
  "Office",
  "Industrial",
  "Residential",
  "Leisure",
  "Mixed Use",
  "Other",
]

/** Consumer email domains — don't auto-populate brand for these */
const CONSUMER_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "outlook.com",
  "hotmail.com",
  "hotmail.co.uk",
  "live.com",
  "icloud.com",
  "me.com",
  "aol.com",
  "protonmail.com",
  "proton.me",
  "mail.com",
  "msn.com",
])

// =============================================================================
// Props
// =============================================================================

interface AddSiteSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** User email for auto-populating brand/logo */
  userEmail?: string | null
}

// =============================================================================
// Component
// =============================================================================

export function AddSiteSheet({ open, onOpenChange, userEmail }: AddSiteSheetProps) {
  const router = useRouter()

  // ── Form state ───────────────────────────────────────────────────────
  const [postcode, setPostcode] = useState("")
  const [address, setAddress] = useState("")
  const [siteName, setSiteName] = useState("")
  const [headline, setHeadline] = useState("")
  const [assetClass, setAssetClass] = useState("")
  const [sqFt, setSqFt] = useState("")

  // ── Postcode lookup state ────────────────────────────────────────────
  const [regionCode, setRegionCode] = useState("")
  const [regionName, setRegionName] = useState("")
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [lookupLoading, setLookupLoading] = useState(false)
  const [lookupError, setLookupError] = useState<string | null>(null)
  const [lookupSuccess, setLookupSuccess] = useState(false)

  // ── Submission state ─────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)

  // ── Auto-populate brand from email ───────────────────────────────────
  const emailDomain = userEmail?.split("@")[1]?.toLowerCase() ?? null
  const isConsumerEmail = emailDomain ? CONSUMER_DOMAINS.has(emailDomain) : true
  const autoBrand = !isConsumerEmail && emailDomain
    ? emailDomain.split(".")[0].charAt(0).toUpperCase() + emailDomain.split(".")[0].slice(1)
    : null

  // ── Reset form when sheet opens ──────────────────────────────────────
  useEffect(() => {
    if (open) {
      setPostcode("")
      setAddress("")
      setSiteName("")
      setHeadline("")
      setAssetClass("")
      setSqFt("")
      setRegionCode("")
      setRegionName("")
      setLat(null)
      setLng(null)
      setLookupLoading(false)
      setLookupError(null)
      setLookupSuccess(false)
      setSubmitting(false)
      setSubmitError(null)
      setSubmitSuccess(false)
    }
  }, [open])

  // ── Postcode lookup ──────────────────────────────────────────────────
  const lookupPostcode = useCallback(async () => {
    if (!postcode.trim()) {
      setLookupError("Please enter a postcode")
      return
    }

    setLookupLoading(true)
    setLookupError(null)
    setLookupSuccess(false)

    try {
      const res = await fetch(
        `/api/postcode-lookup?postcode=${encodeURIComponent(postcode)}`
      )
      const data = await res.json()

      if (!res.ok) {
        setLookupError(data.error || "Postcode not found")
        return
      }

      setRegionCode(data.region_code)
      setRegionName(data.region_name)
      setLat(data.latitude ?? null)
      setLng(data.longitude ?? null)
      setLookupSuccess(true)

      if (data.warning) {
        setLookupError(data.warning)
      }
    } catch {
      setLookupError("Failed to lookup postcode")
    } finally {
      setLookupLoading(false)
    }
  }, [postcode])

  // ── Handle Enter key on postcode ─────────────────────────────────────
  const handlePostcodeKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        lookupPostcode()
      }
    },
    [lookupPostcode]
  )

  // ── Submit ───────────────────────────────────────────────────────────
  const handleSubmit = async () => {
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

    try {
      const res = await fetch("/api/portfolio/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          address: address.trim(),
          postcode: postcode.trim() || null,
          region_code: regionCode,
          region_name: regionName,
          site_name: siteName.trim() || null,
          headline: headline.trim() || null,
          brand: autoBrand || null,
          brand_logo_url: !isConsumerEmail ? emailDomain : null,
          asset_class: assetClass || null,
          sq_ft: sqFt ? parseInt(sqFt, 10) : null,
          lat,
          lng,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || "Failed to add site")
        return
      }

      setSubmitSuccess(true)

      // Brief success animation, then close and refresh
      setTimeout(() => {
        onOpenChange(false)
        router.refresh()
      }, 600)
    } catch {
      setSubmitError("Something went wrong. Please try again.")
    } finally {
      setSubmitting(false)
    }
  }

  const canSubmit = lookupSuccess && address.trim().length > 0 && !submitting && !submitSuccess

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Add a site</SheetTitle>
          <SheetDescription>
            Enter a postcode to get started. We&apos;ll match it to a region and unlock metrics, forecasts and signals.
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 px-8 pb-8 space-y-8">
          {/* ────────────────────────────────────────────────────────────
              Step 1: Location (the hero moment)
          ──────────────────────────────────────────────────────────── */}
          <div className="space-y-5">
            <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
              Location
            </div>

            {/* Postcode input + lookup */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">
                Postcode
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
                  onKeyDown={handlePostcodeKeyDown}
                  placeholder="e.g., M1 1AD"
                  className={cn(
                    "flex-1 px-4 py-3 rounded-xl border bg-background text-foreground text-base",
                    "placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                    "transition-all duration-200",
                    lookupSuccess && "border-emerald-500/40 ring-1 ring-emerald-500/20"
                  )}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={lookupPostcode}
                  disabled={lookupLoading || !postcode.trim()}
                  className={cn(
                    "px-5 py-3 rounded-xl font-medium text-sm transition-all duration-200",
                    "disabled:opacity-40 disabled:cursor-not-allowed",
                    lookupSuccess
                      ? "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20"
                      : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.98]"
                  )}
                >
                  {lookupLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : lookupSuccess ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    "Lookup"
                  )}
                </button>
              </div>

              {/* Region result — slides in on success */}
              {lookupSuccess && regionName && (
                <div
                  className="flex items-center gap-2.5 px-4 py-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10"
                  style={{ animation: "riq-slideUp 300ms ease-out" }}
                >
                  <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-emerald-500/10">
                    <MapPin className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{regionName}</p>
                    <p className="text-xs text-muted-foreground">{regionCode}</p>
                  </div>
                </div>
              )}

              {/* Error */}
              {lookupError && !lookupSuccess && (
                <div className="flex items-center gap-2 text-sm text-amber-500">
                  <AlertCircle className="h-4 w-4 flex-shrink-0" />
                  <span>{lookupError}</span>
                </div>
              )}
            </div>

            {/* Address — appears after postcode succeeds (progressive disclosure) */}
            {lookupSuccess && (
              <div
                className="space-y-2"
                style={{ animation: "riq-slideUp 300ms ease-out 100ms both" }}
              >
                <label className="text-sm font-medium text-foreground">
                  Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g., Unit 23, Bon Accord Centre"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-background text-foreground text-base",
                    "placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                    "transition-all duration-200"
                  )}
                  autoFocus
                />
              </div>
            )}
          </div>

          {/* ────────────────────────────────────────────────────────────
              Step 2: Details (appears after address is entered)
          ──────────────────────────────────────────────────────────── */}
          {lookupSuccess && address.trim().length > 0 && (
            <div
              className="space-y-5"
              style={{ animation: "riq-slideUp 300ms ease-out" }}
            >
              <div className="text-xs font-medium uppercase tracking-widest text-muted-foreground/60">
                Details
              </div>

              {/* Site name */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Site name{" "}
                  <span className="text-muted-foreground/50 font-normal">optional</span>
                </label>
                <input
                  type="text"
                  value={siteName}
                  onChange={(e) => setSiteName(e.target.value)}
                  placeholder="e.g., Oxford Street Flagship"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-background text-foreground text-base",
                    "placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                    "transition-all duration-200"
                  )}
                />
              </div>

              {/* Description / headline */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Description{" "}
                  <span className="text-muted-foreground/50 font-normal">optional</span>
                </label>
                <textarea
                  value={headline}
                  onChange={(e) => setHeadline(e.target.value)}
                  placeholder="e.g., Heritage office at Albert Square, fully-furnished floors 3-9k sq ft, flex workspace"
                  rows={2}
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-background text-foreground text-base resize-none",
                    "placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                    "transition-all duration-200"
                  )}
                />
              </div>

              {/* Asset class — pill selector */}
              <div className="space-y-2.5">
                <label className="text-sm font-medium text-foreground">
                  Asset class{" "}
                  <span className="text-muted-foreground/50 font-normal">optional</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  {ASSET_CLASSES.map((cls) => (
                    <button
                      key={cls}
                      type="button"
                      onClick={() => setAssetClass(assetClass === cls ? "" : cls)}
                      className={cn(
                        "px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-150",
                        "border",
                        assetClass === cls
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-transparent text-muted-foreground border-border/60 hover:border-foreground/20 hover:text-foreground"
                      )}
                    >
                      {cls}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sq ft */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-foreground">
                  Size (sq ft){" "}
                  <span className="text-muted-foreground/50 font-normal">optional</span>
                </label>
                <input
                  type="number"
                  value={sqFt}
                  onChange={(e) => setSqFt(e.target.value)}
                  placeholder="e.g., 2,500"
                  className={cn(
                    "w-full px-4 py-3 rounded-xl border bg-background text-foreground text-base",
                    "placeholder:text-muted-foreground/40",
                    "focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50",
                    "transition-all duration-200"
                  )}
                />
              </div>
            </div>
          )}

          {/* ────────────────────────────────────────────────────────────
              Submit area
          ──────────────────────────────────────────────────────────── */}
          {lookupSuccess && (
            <div
              className="space-y-3 pt-2"
              style={{ animation: "riq-slideUp 300ms ease-out 200ms both" }}
            >
              {/* Error */}
              {submitError && (
                <div className="px-4 py-3 rounded-xl bg-red-500/5 border border-red-500/15 text-red-500 text-sm">
                  {submitError}
                </div>
              )}

              {/* CTA */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className={cn(
                  "w-full py-3.5 rounded-xl font-semibold text-base transition-all duration-200",
                  "disabled:opacity-40 disabled:cursor-not-allowed",
                  submitSuccess
                    ? "bg-emerald-500 text-white"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 active:scale-[0.99] shadow-sm"
                )}
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Adding...
                  </span>
                ) : submitSuccess ? (
                  <span className="flex items-center justify-center gap-2">
                    <Check className="h-4 w-4" />
                    Added
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    <Plus className="h-4 w-4" />
                    Add to Portfolio
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {/* Slide-up animation */}
        <style jsx global>{`
          @keyframes riq-slideUp {
            0% {
              transform: translateY(8px);
              opacity: 0;
            }
            100% {
              transform: translateY(0);
              opacity: 1;
            }
          }
        `}</style>
      </SheetContent>
    </Sheet>
  )
}
