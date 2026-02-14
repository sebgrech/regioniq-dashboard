import { METRICS, type Metric } from "@/lib/metrics.config"
import { TrendingUp } from "lucide-react"

export const DTRE_GVA_PER_JOB_METRIC: Metric = {
  id: "gva_per_job",
  title: "GVA per Job",
  shortTitle: "GVA per Job",
  unit: "£",
  icon: TrendingUp,
  decimals: 0,
  color: "hsl(var(--chart-2))",
  showInDashboard: false,
}

export const DTRE_MAP_METRICS: Metric[] = METRICS.some((m) => m.id === DTRE_GVA_PER_JOB_METRIC.id)
  ? METRICS
  : [...METRICS, DTRE_GVA_PER_JOB_METRIC]
