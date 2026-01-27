"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Loader2, Sparkles, ExternalLink } from "lucide-react"
import { ThemeToggle } from "@/components/ui/theme-toggle"
import { REGIONS, type Scenario } from "@/lib/metrics.config"
import { fetchSeries, type DataPoint } from "@/lib/data-service"
import { createClient } from "@supabase/supabase-js"

// Components
import { AssetHeader } from "@/components/asset-header"
import { AssetLocationMap } from "@/components/asset-location-map"
import { AssetEconomicContext, AssetComparisonCharts } from "@/components/asset-economic-context"
import { NotableFlags } from "@/components/notable-flags"
import { MetricInteractionInsights } from "@/components/metric-interaction-insights"

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

interface AssetPageData {
  id: string
  slug: string
  address: string
  postcode: string | null
  region_code: string
  region_name: string
  asset_type: string | null
  asset_class: string | null
  broker: string | null
  broker_contact: {
    name?: string
    email?: string
    phone?: string
  } | null
  headline: string | null
  price_guidance: string | null
  yield: string | null
  sq_ft: number | null
  tenant: string | null
  lease_expiry: string | null
  key_stats: string[] | null
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
// Main Content Component
// -----------------------------------------------------------------------------

function AssetPageContent() {
  const params = useParams()
  const slug = params.slug as string

  const [asset, setAsset] = useState<AssetPageData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Metrics data for NotableFlags and Patterns
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

  // Fetch asset metadata
  useEffect(() => {
    const fetchAsset = async () => {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from("asset_pages")
        .select("*")
        .eq("slug", slug)
        .single()

      if (fetchError || !data) {
        setError("Asset not found")
        setLoading(false)
        return
      }

      setAsset(data as AssetPageData)
      setLoading(false)
    }

    fetchAsset()
  }, [slug])

  // Fetch metrics data once we have the asset
  useEffect(() => {
    if (!asset) return

    const loadAllMetrics = async () => {
      setMetricsLoading(true)
      try {
        // Map region_code to the UI code used by fetchSeries
        // The region_code in asset_pages is the DB code (e.g., E06000055)
        // We need to find the matching UI code from REGIONS
        const uiRegion = REGIONS.find(r => r.dbCode === asset.region_code)
        const regionCode = uiRegion?.code ?? asset.region_code

        const categoryMetricIds = [
          "population_total",
          "nominal_gva_mn_gbp",
          "gdhi_per_head_gbp",
          "emp_total_jobs",
        ] as const

        const categoryMetrics = await Promise.all(
          categoryMetricIds.map(async (metricId) => ({
            metricId,
            data: await fetchSeries({ metricId, region: regionCode, scenario }),
          }))
        )

        setAllMetricsData(categoryMetrics)
      } catch (err) {
        console.error("Failed to load metrics:", err)
      } finally {
        setMetricsLoading(false)
      }
    }

    loadAllMetrics()
  }, [asset, scenario])
  
  // Fetch archetype for header badge
  useEffect(() => {
    if (!asset) return
    
    const fetchArchetype = async () => {
      try {
        const uiRegion = REGIONS.find(r => r.dbCode === asset.region_code)
        const regionCode = uiRegion?.code ?? asset.region_code
        
        const response = await fetch("/api/region-insights", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ regionCode, year, scenario }),
        })
        
        if (response.ok) {
          const data = await response.json()
          if (data?.ui?.bucketLabel) {
            setArchetype(data.ui.bucketLabel)
          }
        }
      } catch (err) {
        console.error("Failed to fetch archetype:", err)
      }
    }
    
    fetchArchetype()
  }, [asset, year, scenario])

  // Get UI region code for components
  const uiRegionCode = asset
    ? REGIONS.find(r => r.dbCode === asset.region_code)?.code ?? asset.region_code
    : ""

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading asset analysis...</span>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !asset) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="text-6xl opacity-20">404</div>
          <h1 className="text-xl font-semibold">Asset not found</h1>
          <p className="text-muted-foreground">
            The asset page you&apos;re looking for doesn&apos;t exist or has been removed.
          </p>
          <Link 
            href="https://regioniq.io" 
            className="inline-flex items-center gap-2 text-primary hover:underline"
          >
            Visit RegionIQ
            <ExternalLink className="h-4 w-4" />
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header - Prominent branding */}
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

            {/* Asset Analysis - larger text */}
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-purple-400" />
              <span className="text-lg font-semibold text-foreground">Asset Analysis</span>
            </div>
          </div>

          {/* Theme toggle + CTA */}
          <div className="hidden sm:flex items-center gap-3">
            <ThemeToggle />
            <Link
              href="https://regioniq.io"
              className="inline-flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Get full access
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8 max-w-5xl">
        {/* Asset Header + Map - Side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Asset Header - takes 3/5 on desktop */}
          <div className="lg:col-span-3">
            <AssetHeader
              address={asset.address}
              postcode={asset.postcode}
              regionName={asset.region_name}
              assetType={asset.asset_type}
              assetClass={asset.asset_class}
              broker={asset.broker}
              brokerContact={asset.broker_contact}
              headline={asset.headline}
              priceGuidance={asset.price_guidance}
              yieldInfo={asset.yield}
              sqFt={asset.sq_ft}
              tenant={asset.tenant}
              leaseExpiry={asset.lease_expiry}
              keyStats={asset.key_stats}
              archetype={archetype}
            />
          </div>
          
          {/* Location Map - takes 2/5 on desktop */}
          {asset.postcode && (
            <div className="lg:col-span-2">
              <AssetLocationMap 
                postcode={asset.postcode} 
                address={asset.address}
                className="h-[280px] lg:h-full lg:min-h-[320px]"
              />
            </div>
          )}
        </div>
        
        {/* Economic Context Section - tinted background for visual cohesion */}
        <div className="bg-muted/10 -mx-4 px-4 pt-8 pb-4 md:-mx-8 md:px-8 mt-6 rounded-t-2xl">
          {/* Prose-style economic context */}
          <AssetEconomicContext
            regionCode={uiRegionCode}
            regionName={asset.region_name}
            year={year}
            scenario={scenario}
            ladCode={asset.region_code}
            assetType={asset.asset_type}
            tenant={asset.tenant}
            yieldInfo={asset.yield}
            hideCharts
          />
          
          {/* Selected economic indicators - quieter, appendix-grade */}
          <div className="mt-6 pt-4 border-t border-border/20">
            <p className="text-sm text-muted-foreground/70 mb-3 font-medium">
              Selected economic indicators
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <NotableFlags
                regionCode={uiRegionCode}
                regionName={asset.region_name}
                year={year}
                allMetricsData={allMetricsData}
                isLoading={metricsLoading || allMetricsData.length === 0}
                minimal
              />

              <MetricInteractionInsights
                allMetricsData={allMetricsData}
                year={year}
                regionName={asset.region_name}
                currentMetricId="population_total"
                isLoading={metricsLoading || allMetricsData.length === 0}
                minimal
              />
            </div>
          </div>
          
          {/* Regional Comparison Charts - below indicators (temporarily hidden) */}
          {/* 
          <div className="mt-8 pt-6 border-t border-border/20">
            <AssetComparisonCharts
              regionCode={uiRegionCode}
              regionName={asset.region_name}
              year={year}
              scenario={scenario}
            />
          </div>
          */}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-6">
        <div className="container mx-auto px-4 py-6 max-w-5xl">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="relative h-8 w-8">
                <Image
                  src="/Frame 11.png"
                  alt="RegionIQ"
                  fill
                  className="object-contain"
                />
              </div>
              <div className="text-sm">
                <span className="text-muted-foreground">Economic intelligence by </span>
                <Link href="https://regioniq.io" className="font-medium text-foreground hover:text-primary transition-colors">
                  RegionIQ
                </Link>
              </div>
            </div>

            <div className="text-xs text-muted-foreground">
              Data updated {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

// -----------------------------------------------------------------------------
// Page Export with Suspense
// -----------------------------------------------------------------------------

export default function AssetPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-muted-foreground">Loading...</span>
          </div>
        </div>
      }
    >
      <AssetPageContent />
    </Suspense>
  )
}
