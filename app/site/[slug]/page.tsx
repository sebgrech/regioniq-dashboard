"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Loader2, MapPin, Building2, Sparkles, ExternalLink } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { createClient } from "@supabase/supabase-js"

// Components
import { AssetCatchmentMap } from "@/components/asset-catchment-map"
import { AssetEconomicContext } from "@/components/asset-economic-context"
import { NotableFlags } from "@/components/notable-flags"
import { MetricInteractionInsights } from "@/components/metric-interaction-insights"
import { GPComparisonSection } from "@/components/gp-comparison-section"
import { CompanyLogo } from "@/components/company-logo"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface SiteEvaluationData {
  id: string
  slug: string
  address: string
  postcode: string | null
  region_code: string
  region_name: string
  site_name: string | null
  brand: string | null
  brand_logo_url: string | null
  asset_class: string | null
  sq_ft: number | null
  notes: string | null
  created_at: string
}

// -----------------------------------------------------------------------------
// Supabase client for public access
// -----------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// -----------------------------------------------------------------------------
// Site Header Component
// -----------------------------------------------------------------------------

interface SiteHeaderProps {
  address: string
  postcode?: string | null
  regionName: string
  siteName?: string | null
  brand?: string | null
  brandLogoUrl?: string | null
  assetClass?: string | null
  sqFt?: number | null
  archetype?: string | null
}

function SiteHeader({
  address,
  postcode,
  regionName,
  siteName,
  brand,
  brandLogoUrl,
  assetClass,
  sqFt,
  archetype,
}: SiteHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50 h-full min-h-[260px]">
      <div className="relative p-6 md:p-8 h-full flex flex-col">
        {/* Top row: Asset class badge + Archetype + Brand */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {assetClass && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-medium">
                <Building2 className="h-3 w-3" />
                {assetClass}
              </span>
            )}
            {archetype && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-medium animate-in fade-in-0 slide-in-from-left-2 duration-500">
                {archetype}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium">
              <Sparkles className="h-3 w-3" />
              Economic Profile
            </span>
          </div>
          
          {brand && (
            <div className="flex items-center gap-2">
              <CompanyLogo 
                domain={brandLogoUrl}
                name={brand}
                size={40}
                showFallback={true}
                className="rounded-lg"
              />
              <div>
                <div className="text-xs text-muted-foreground">Brand</div>
                <div className="text-sm font-semibold text-foreground">{brand}</div>
              </div>
            </div>
          )}
        </div>

        {/* Site name or address as hero */}
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-2">
          {siteName || address}
        </h1>
        
        {/* Location line */}
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <MapPin className="h-4 w-4 text-cyan-400" />
          <span>{regionName}</span>
          {postcode && (
            <>
              <span className="text-muted-foreground/40">·</span>
              <span className="font-mono text-sm">{postcode}</span>
            </>
          )}
        </div>

        {/* Address if site name is different */}
        {siteName && siteName !== address && (
          <p className="text-sm text-muted-foreground">{address}</p>
        )}

        {/* Spacer to push metrics to bottom */}
        <div className="flex-grow" />

        {/* Quick metrics */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border/30 mt-4">
          {sqFt && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase">Size</span>
              <span className="text-sm font-medium text-foreground">{sqFt.toLocaleString()} sq ft</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Main Content Component
// -----------------------------------------------------------------------------

function SitePageContent() {
  const params = useParams()
  const slug = params.slug as string

  const [site, setSite] = useState<SiteEvaluationData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Metrics data for NotableFlags and MetricInteractionInsights
  const [allMetricsData, setAllMetricsData] = useState<{
    metricId: string
    data: DataPoint[]
  }[]>([])
  const [metricsLoading, setMetricsLoading] = useState(true)
  
  // Archetype for header badge
  const [archetype, setArchetype] = useState<string | null>(null)

  // Current year for analysis
  const year = new Date().getFullYear()
  const scenario: Scenario = "baseline"

  // Fetch site evaluation data
  useEffect(() => {
    const fetchSite = async () => {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("site_evaluations")
        .select("*")
        .eq("slug", slug)
        .single()

      if (fetchError || !data) {
        setError("Site evaluation not found")
        setLoading(false)
        return
      }

      setSite(data as SiteEvaluationData)
      setLoading(false)
    }

    if (slug) {
      fetchSite()
    }
  }, [slug])

  // Fetch metrics data for NotableFlags and MetricInteractionInsights
  useEffect(() => {
    const fetchMetrics = async () => {
      if (!site) return
      
      setMetricsLoading(true)

      const metricsToFetch = [
        "population_total",
        "nominal_gva_mn_gbp",
        "gdhi_per_head_gbp",
        "emp_total_jobs"
      ]

      const results = await Promise.all(
        metricsToFetch.map(async (metricId) => {
          try {
            const data = await fetchSeries({
              metricId,
              region: site.region_code,
              scenario
            })
            return { metricId, data }
          } catch {
            return { metricId, data: [] }
          }
        })
      )

      setAllMetricsData(results)
      setMetricsLoading(false)
    }

    fetchMetrics()
  }, [site, scenario])

  // Fetch archetype for header badge
  useEffect(() => {
    const fetchArchetype = async () => {
      if (!site) return

      try {
        const response = await fetch("/api/region-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            regionCode: site.region_code,
            year,
            scenario
          })
        })

        if (response.ok) {
          const data = await response.json()
          if (data.placeCharacter?.archetype?.label) {
            setArchetype(data.placeCharacter.archetype.label)
          }
        }
      } catch {
        // Ignore archetype fetch errors
      }
    }

    fetchArchetype()
  }, [site, year, scenario])

  // Convert region code for UI
  const uiRegionCode = site 
    ? REGIONS.find(r => r.dbCode === site.region_code)?.code ?? site.region_code
    : ""

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading site evaluation...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !site) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-foreground mb-2">Site Not Found</h1>
          <p className="text-muted-foreground mb-4">{error || "This site evaluation does not exist."}</p>
          <Link href="/" className="text-primary hover:underline">
            Return Home
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Logo + RegionIQ text */}
            <Link href="https://regioniq.io" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 flex-shrink-0">
                <Image
                  src="/x.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain dark:hidden"
                  priority
                />
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain hidden dark:block"
                  priority
                />
              </div>
              <span className="text-lg font-bold text-foreground tracking-tight">RegionIQ</span>
            </Link>

            <div className="h-6 w-px bg-border/60" />

            {/* Economic Profile label */}
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-400" />
              <span className="text-lg font-semibold text-foreground">Economic Profile</span>
            </div>

            {/* Region badge */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <span className="text-base font-semibold text-foreground">{site.region_name}</span>
            </div>
          </div>
          
          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="https://regioniq.io"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Get full access
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl bg-background">
        {/* Site Header + Map - Side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Site Header - takes 3/5 on desktop */}
          <div className="lg:col-span-3">
            <SiteHeader
              address={site.address}
              postcode={site.postcode}
              regionName={site.region_name}
              siteName={site.site_name}
              brand={site.brand}
              brandLogoUrl={site.brand_logo_url}
              assetClass={site.asset_class}
              sqFt={site.sq_ft}
              archetype={archetype}
            />
          </div>
          
          {/* Interactive Catchment Map - takes 2/5 on desktop */}
          {(site.postcode || site.address) && (
            <div className="lg:col-span-2">
              <AssetCatchmentMap 
                postcode={site.postcode} 
                address={site.address}
                year={year}
                scenario={scenario}
                className="h-[260px] lg:h-full lg:min-h-[260px]"
              />
            </div>
          )}
        </div>
        
        {/* Economic Context Section */}
        <div className="mt-8 rounded-2xl bg-muted/30 border border-border/30 p-6">
          <AssetEconomicContext
            regionCode={uiRegionCode}
            regionName={site.region_name}
            year={year}
            scenario={scenario}
            ladCode={site.region_code}
            assetType={site.asset_class}
            hideCharts
          />
          
          {/* Regional Comparison Charts */}
          <div className="mt-6 pt-6 border-t border-border/30">
            <GPComparisonSection
              regionCode={uiRegionCode}
              regionName={site.region_name}
              year={year}
              scenario={scenario}
            />
          </div>
        </div>

        {/* Selected Economic Indicators */}
        <div className="mt-8">
          <p className="text-sm text-muted-foreground/70 mb-3 font-medium">
            Selected economic indicators
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <NotableFlags
              regionCode={uiRegionCode}
              regionName={site.region_name}
              year={year}
              allMetricsData={allMetricsData}
              isLoading={metricsLoading || allMetricsData.length === 0}
              minimal
            />

            <MetricInteractionInsights
              allMetricsData={allMetricsData}
              year={year}
              regionName={site.region_name}
              currentMetricId="population_total"
              isLoading={metricsLoading || allMetricsData.length === 0}
              minimal
            />
          </div>
        </div>

        {/* Notes section if present */}
        {site.notes && (
          <div className="mt-8 p-4 rounded-xl bg-muted/30 border border-border/30">
            <h3 className="text-sm font-medium text-muted-foreground uppercase mb-2">Notes</h3>
            <p className="text-sm text-foreground">{site.notes}</p>
          </div>
        )}

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-border/30 text-center">
          <p className="text-xs text-muted-foreground">
            Site evaluation powered by{" "}
            <Link href="https://regioniq.io" className="text-primary hover:underline">
              RegionIQ
            </Link>
            {" "}· Economic data and forecasts for UK regions
          </p>
        </div>
      </main>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Page Export
// -----------------------------------------------------------------------------

export default function SitePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    }>
      <SitePageContent />
    </Suspense>
  )
}
