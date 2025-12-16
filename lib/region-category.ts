/**
 * Determines the region category based on economic indicators
 * Returns category label, emoji, and color classes
 */

export interface RegionCategory {
  label: string
  emoji: string
  colorClass: string
  description: string
}

interface IndicatorScores {
  populationGrowth: number // YoY change %
  gvaGrowth: number // YoY change %
  incomeGrowth: number // YoY change %
  employmentGrowth: number // YoY change %
  gvaPerCapita?: number // Optional: GVA per capita for high-value determination
}

export function getRegionCategory(scores: IndicatorScores): RegionCategory {
  const { populationGrowth, gvaGrowth, incomeGrowth, employmentGrowth, gvaPerCapita } = scores

  // Calculate average growth rate
  const avgGrowth = (populationGrowth + gvaGrowth + incomeGrowth + employmentGrowth) / 4

  // High-Growth Cluster: All metrics positive, strong average growth (>2%)
  if (avgGrowth > 2 && populationGrowth > 0 && gvaGrowth > 0 && incomeGrowth > 0 && employmentGrowth > 0) {
    return {
      label: "High-Growth Cluster",
      emoji: "🚀",
      colorClass: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
      description: "Strong growth across all key economic indicators with above-average momentum.",
    }
  }

  // High-Value Core: High GVA per capita or strong income, moderate growth
  if ((gvaPerCapita && gvaPerCapita > 30000) || (incomeGrowth > 1.5 && avgGrowth > 0.5)) {
    return {
      label: "High-Value Core",
      emoji: "🏛️",
      colorClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
      description: "Established economic center with high productivity and value generation.",
    }
  }

  // Emerging Potential: Mixed indicators but positive trajectory
  if (avgGrowth > 0 && (gvaGrowth > 1 || incomeGrowth > 1)) {
    return {
      label: "Emerging Potential",
      emoji: "🌱",
      colorClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
      description: "Showing positive economic momentum with potential for further development.",
    }
  }

  // Underperforming: Negative average growth or multiple declining indicators
  if (avgGrowth < -0.5 || (populationGrowth < 0 && gvaGrowth < 0)) {
    return {
      label: "Underperforming",
      emoji: "📉",
      colorClass: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
      description: "Facing economic challenges with declining indicators across key metrics.",
    }
  }

  // Mature & Stable: Default for regions with stable, moderate performance
  return {
    label: "Mature & Stable",
    emoji: "⚖️",
    colorClass: "bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300",
    description: "Established region with stable economic performance and moderate growth.",
  }
}

