"use client"

import { useState, useEffect, Suspense } from "react"
import { useParams } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { Loader2, ExternalLink, Building2, BarChart3, ShoppingBag, Briefcase, Home, Dumbbell, Warehouse, UtensilsCrossed, User } from "lucide-react"
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
import { inferTenantSector, SECTOR_LABELS, type TenantSector } from "@/lib/tenant-sector"
import { CompanyLogo } from "@/components/company-logo"

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
    domain?: string
  } | null
  headline: string | null
  price_guidance: string | null
  yield: string | null
  sq_ft: number | null
  tenant: string | null
  tenant_logo_url: string | null
  portfolio_owner: string | null
  lease_expiry: string | null
  key_stats: string[] | null
  created_at: string
  page_type: 'sell_side' | 'buy_side' | null
}

// -----------------------------------------------------------------------------
// Supabase client for public access
// -----------------------------------------------------------------------------

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// -----------------------------------------------------------------------------
// Sector Icon Component
// -----------------------------------------------------------------------------

function SectorIcon({ sector, className }: { sector: TenantSector; className?: string }) {
  switch (sector) {
    case "retail":
      return <ShoppingBag className={className} />
    case "office":
      return <Briefcase className={className} />
    case "residential":
      return <Home className={className} />
    case "leisure":
      return <Dumbbell className={className} />
    case "industrial":
      return <Warehouse className={className} />
    case "f_and_b":
      return <UtensilsCrossed className={className} />
    default:
      return <Building2 className={className} />
  }
}

// -----------------------------------------------------------------------------
// GP Header Component (simplified, no broker info)
// -----------------------------------------------------------------------------

interface GPHeaderProps {
  address: string
  postcode?: string | null
  regionName: string
  assetType?: string | null
  assetClass?: string | null
  headline?: string | null
  priceGuidance?: string | null
  yieldInfo?: string | null
  sqFt?: number | null
  tenant?: string | null
  tenantLogoUrl?: string | null
  portfolioOwner?: string | null
  archetype?: string | null
  tenantSector?: TenantSector
}

function GPHeader({
  address,
  postcode,
  regionName,
  assetType,
  assetClass,
  headline,
  priceGuidance,
  yieldInfo,
  sqFt,
  tenant,
  tenantLogoUrl,
  portfolioOwner,
  archetype,
  tenantSector,
}: GPHeaderProps) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-card/50 backdrop-blur-sm border border-border/50">
      <div className="relative p-6 md:p-8">
        {/* Top row: Asset type badge + Sector + Archetype */}
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-2">
            {assetClass && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-purple-500/15 text-purple-300 text-xs font-medium">
                <Building2 className="h-3 w-3" />
                {assetClass}
              </span>
            )}
            {tenantSector && tenantSector !== "other" && assetClass?.toLowerCase() !== SECTOR_LABELS[tenantSector].toLowerCase() && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-400 text-xs font-medium">
                <SectorIcon sector={tenantSector} className="h-3 w-3" />
                {SECTOR_LABELS[tenantSector]}
              </span>
            )}
            {archetype && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cyan-500/15 text-cyan-400 text-xs font-medium animate-in fade-in-0 slide-in-from-left-2 duration-500">
                {archetype}
              </span>
            )}
            {assetType && assetType !== assetClass && (
              <span className="text-xs text-muted-foreground">{assetType}</span>
            )}
          </div>
          
          {/* Economic Profile indicator */}
          <div className="flex items-center justify-center">
            <span className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 text-xs font-medium text-center">
              <BarChart3 className="h-3 w-3" />
              Economic Profile
            </span>
          </div>
        </div>

        {/* Address as hero */}
        <h1 className="text-2xl md:text-3xl font-semibold text-foreground tracking-tight mb-2">
          {address}
        </h1>
        
        {/* Location line */}
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Building2 className="h-4 w-4" />
          <span>{regionName}</span>
          {postcode && (
            <>
              <span className="text-border">·</span>
              <span className="text-xs font-mono">{postcode}</span>
            </>
          )}
        </div>

        {/* Headline */}
        {headline && (
          <p className="text-base text-muted-foreground leading-relaxed mb-4">
            {headline}
          </p>
        )}

        {/* Key metrics row */}
        <div className="flex flex-wrap items-center gap-4 pt-4 border-t border-border/30">
          {priceGuidance && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase">Guide</span>
              <span className="text-lg font-semibold text-foreground">{priceGuidance}</span>
            </div>
          )}
          {yieldInfo && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase">Yield</span>
              <span className="text-lg font-semibold text-primary">{yieldInfo}</span>
            </div>
          )}
          {sqFt && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground uppercase">Size</span>
              <span className="text-sm font-medium text-foreground">{sqFt.toLocaleString()} sq ft</span>
            </div>
          )}
          {(tenant || tenantLogoUrl) && (
            <div className="flex items-center gap-2">
              <CompanyLogo 
                domain={tenantLogoUrl}
                name={tenant || portfolioOwner} 
                size={40} 
                showFallback={true}
                fallback={
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <User className="h-4 w-4 text-purple-400" />
                  </div>
                }
                className="rounded-lg"
              />
              <div>
                <div className="text-xs text-muted-foreground">{tenant ? "Tenant" : "Portfolio"}</div>
                <div className="text-sm font-semibold text-foreground">{tenant || portfolioOwner}</div>
              </div>
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

function GPPageContent() {
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

  // Fetch asset metadata (try asset_pages first, then portfolio_assets)
  useEffect(() => {
    const fetchAsset = async () => {
      setLoading(true)
      setError(null)

      // First try asset_pages (OM-based deals)
      const { data: dealData, error: dealError } = await supabase
        .from("asset_pages")
        .select("*")
        .eq("slug", slug)
        .single()

      if (dealData && !dealError) {
        setAsset(dealData as AssetPageData)
        setLoading(false)
        return
      }

      // If not found, try portfolio_assets
      const { data: portfolioData, error: portfolioError } = await supabase
        .from("portfolio_assets")
        .select("*")
        .eq("slug", slug)
        .single()

      if (portfolioData && !portfolioError) {
        // Map portfolio asset to AssetPageData format
        setAsset({
          ...portfolioData,
          broker: null,
          broker_contact: null,
          price_guidance: null,
          yield: null,
          tenant: portfolioData.tenant ?? null,
          tenant_logo_url: portfolioData.tenant_logo_url ?? null,
          portfolio_owner: portfolioData.portfolio_owner ?? null,
          lease_expiry: null,
          key_stats: null,
          page_type: null,
        } as AssetPageData)
        setLoading(false)
        return
      }

      setError("Asset not found")
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

  // Infer tenant sector from tenant name
  const tenantSector = asset ? inferTenantSector(asset.tenant) : "other"

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-muted-foreground">Loading economic profile...</span>
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
      {/* Header - Buy-side branding */}
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

            {/* Economic Profile - larger text */}
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-purple-400" />
              <span className="text-lg font-semibold text-foreground">Economic Profile</span>
            </div>

            {/* Broker logo (if available) */}
            {asset.broker && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="opacity-60">via</span>
                <CompanyLogo 
                  domain={asset.broker_contact?.domain}
                  name={asset.broker} 
                  size={36} 
                  showFallback={false}
                  className="rounded-md grayscale opacity-70 hover:grayscale-0 hover:opacity-100 transition-all"
                />
              </div>
            )}

            {/* Region badge */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Building2 className="h-4 w-4 text-primary" />
              </div>
              <span className="text-base font-semibold text-foreground">{asset.region_name}</span>
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
      <main className="container mx-auto px-4 py-8 max-w-5xl bg-background">
        {/* Asset Header + Map - Side by side on desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* GP Header - takes 3/5 on desktop */}
          <div className="lg:col-span-3">
            <GPHeader
              address={asset.address}
              postcode={asset.postcode}
              regionName={asset.region_name}
              assetType={asset.asset_type}
              assetClass={asset.asset_class}
              headline={asset.headline}
              priceGuidance={asset.price_guidance}
              yieldInfo={asset.yield}
              sqFt={asset.sq_ft}
              tenant={asset.tenant}
              tenantLogoUrl={asset.tenant_logo_url}
              portfolioOwner={asset.portfolio_owner}
              archetype={archetype}
              tenantSector={tenantSector}
            />
          </div>
          
          {/* Interactive Catchment Map - takes 2/5 on desktop */}
          {/* Map shows if postcode OR address is available */}
          {(asset.postcode || asset.address) && (
            <div className="lg:col-span-2">
              <AssetCatchmentMap 
                postcode={asset.postcode} 
                address={asset.address}
                year={year}
                scenario={scenario}
                className="h-[280px] lg:h-full lg:min-h-[320px]"
              />
            </div>
          )}
        </div>

        {/* Regional Comparison Charts - HERO POSITION for GP view */}
        <div className="mt-8">
          <GPComparisonSection
            regionCode={uiRegionCode}
            regionName={asset.region_name}
            year={year}
            scenario={scenario}
            leaseExpiry={asset.lease_expiry}
            assetClass={asset.asset_class}
          />
        </div>
        
        {/* Economic Context Section */}
        <div className="bg-muted/10 -mx-4 px-4 pt-8 pb-4 md:-mx-8 md:px-8 mt-8 rounded-t-2xl">
          {/* Prose-style economic context */}
          <AssetEconomicContext
            regionCode={uiRegionCode}
            regionName={asset.region_name}
            year={year}
            scenario={scenario}
            ladCode={asset.region_code}
            assetType={asset.asset_type}
            assetClass={asset.asset_class}
            tenant={asset.tenant}
            yieldInfo={asset.yield}
            hideCharts
            tenantSector={tenantSector}
          />
          
          {/* Selected economic indicators */}
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
                <span className="text-muted-foreground">Economic profile by </span>
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

export default function GPPage() {
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
      <GPPageContent />
    </Suspense>
  )
}
