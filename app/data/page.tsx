"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { ArrowLeft, Loader2, Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataExplorer } from "@/components/data-explorer"
import { METRICS, type Scenario } from "@/lib/metrics.config"
import { getSearchParam, getSearchParamNumber } from "@/lib/utils"

// Map UI metric ids -> Supabase metric_id
type DbMetricId = "emp_total_jobs" | "gdhi_per_head_gbp" | "nominal_gva_mn_gbp" | "population_total"
const METRIC_ID_MAP: Record<string, DbMetricId> = {
  employment: "emp_total_jobs",
  income: "gdhi_per_head_gbp",
  gva: "nominal_gva_mn_gbp",
  population: "population_total",
}

function DataPageContent() {
  const searchParams = useSearchParams()

  const region = getSearchParam(searchParams, "region", "UKI")
  // Support multiple regions from URL (comma-separated)
  const regionsParam = getSearchParam(searchParams, "regions", "")
  const year = getSearchParamNumber(searchParams, "year", 2024)
  const scenario = getSearchParam(searchParams, "scenario", "baseline") as Scenario
  // Allow pre-selecting a metric via URL, default to GVA as primary economic indicator
  const metricParam = getSearchParam(searchParams, "metric", "nominal_gva_mn_gbp")

  const selectedMetric = METRICS.find((m) => m.id === metricParam)

  // Map to database metric ID
  const dbMetricId: DbMetricId = METRIC_ID_MAP[metricParam] ?? (metricParam as DbMetricId)

  return (
    <div className="min-h-screen bg-background">
      {/* Header - matches Catchment/Analysis page layout */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="w-full px-6 py-2 flex items-center">
          {/* Logo */}
          <div className="relative h-12 w-12 flex-shrink-0">
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

          <div className="flex items-center gap-3 ml-3">
            <Button variant="ghost" size="sm" asChild className="h-8 px-3">
              <Link href={`/dashboard?region=${region}&year=${year}${scenario !== "baseline" ? `&scenario=${scenario}` : ""}`}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Dashboard
              </Link>
            </Button>

            <div className="h-8 w-px bg-border" />

            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <h1 className="text-lg font-semibold">Data Explorer</h1>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        <DataExplorer
          metricId={dbMetricId}
          region={region}
          regions={regionsParam || undefined}
          year={year}
          scenario={scenario}
          title={selectedMetric?.title ?? "Regional Data"}
        />
      </div>
    </div>
  )
}

export default function DataPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">Loading Data Explorer...</span>
          </div>
        </div>
      }
    >
      <DataPageContent />
    </Suspense>
  )
}
